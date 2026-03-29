import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, buildOrderConfirmationEmail } from "../_shared/email.ts";

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ─── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ─── Internal function caller (same pattern as admin/index.ts) ───────────────

async function callFunction(name: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    return resp.json();
}

// ─── Event logger ────────────────────────────────────────────────────────────

async function logEvent(
    supabase: ReturnType<typeof createClient>,
    event_type: string,
    entity_type: string,
    entity_id: string | null,
    details: Record<string, unknown> = {},
    actor = "system",
) {
    await supabase
        .from("event_log")
        .insert({ event_type, entity_type, entity_id, details, actor });
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Extract user JWT from Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return json({ error: "Missing authorization" }, 401);

        const token = authHeader.replace("Bearer ", "").trim();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Verify the JWT and get user
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const {
            data: { user },
            error: authErr,
        } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: "Unauthorized" }, 401);

        const { order_id } = await req.json();
        if (!order_id)
            return json({ error: "order_id is required" }, 400);

        // 1. Fetch the order and verify ownership
        const { data: order, error: orderErr } = await supabase
            .from("orders")
            .select(
                `
                id, user_id, status, odoo_order_id,
                order_items (
                    quantity, unit_price,
                    product:products (
                        name,
                        product_variants ( id, odoo_variant_id, stock_quantity )
                    )
                )
            `,
            )
            .eq("id", order_id)
            .single();

        if (orderErr || !order)
            return json({ error: "Order not found" }, 404);
        if (order.user_id !== user.id)
            return json({ error: "Not your order" }, 403);
        if (order.status !== "pending")
            return json(
                { error: `Order status is '${order.status}', expected 'pending'` },
                400,
            );

        // 1b. Stock validation — reject if any item exceeds available stock
        type StockItem = {
            quantity: number;
            product: { name: string; product_variants: Array<{ id: number; stock_quantity: number }> } | null;
        };
        const stockErrors: string[] = [];
        for (const item of order.order_items as StockItem[]) {
            if (!item.product) continue;
            const totalStock = item.product.product_variants.reduce(
                (s, v) => s + v.stock_quantity, 0,
            );
            if (item.quantity > totalStock) {
                stockErrors.push(
                    totalStock === 0
                        ? `${item.product.name} is out of stock`
                        : `${item.product.name}: only ${totalStock} available, ordered ${item.quantity}`,
                );
            }
        }
        if (stockErrors.length > 0) {
            return json({ error: stockErrors.join(". ") }, 400);
        }

        // 2. Mark as paid (dummy payment)
        const paymentId = `dummy_${Date.now()}`;
        await supabase
            .from("orders")
            .update({
                status: "paid",
                payment_intent_id: paymentId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", order_id);

        await logEvent(
            supabase,
            "order.payment_confirmed",
            "order",
            order_id,
            { payment_intent_id: paymentId },
            "customer",
        );

        // 3. Get customer info for Odoo
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, first_name, last_name")
            .eq("id", user.id)
            .single();

        const customerName =
            profile?.full_name ??
            ([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email);

        // 4. Build items for Odoo sync
        type OrderItem = {
            quantity: number;
            unit_price: number;
            product: {
                product_variants: Array<{ odoo_variant_id: number | null }>;
            } | null;
        };

        const odooItems = (order.order_items as OrderItem[])
            .map((item) => ({
                odoo_variant_id:
                    item.product?.product_variants?.[0]?.odoo_variant_id ?? null,
                quantity: item.quantity,
                price: item.unit_price,
            }))
            .filter((i) => i.odoo_variant_id != null);

        let odooOrderId: number | null = null;
        let odooError: string | null = null;

        // 5. Sync to Odoo
        if (odooItems.length > 0) {
            try {
                const syncResult = (await callFunction("sync-to-odoo", {
                    action: "sync_order",
                    payload: {
                        supabase_order_id: order_id,
                        customer_email: user.email,
                        customer_name: customerName,
                        items: odooItems,
                    },
                })) as {
                    success: boolean;
                    odoo_order_id?: number;
                    error?: string;
                };

                if (syncResult.success && syncResult.odoo_order_id) {
                    odooOrderId = syncResult.odoo_order_id;
                } else {
                    odooError = syncResult.error ?? "sync-to-odoo returned no order ID";
                }
            } catch (err) {
                odooError = (err as Error).message;
            }
        } else {
            odooError = "No items with valid Odoo variant IDs";
        }

        // 6. Update order with Odoo result
        const updateFields: Record<string, unknown> = {
            status: "processing",
            updated_at: new Date().toISOString(),
        };
        if (odooOrderId) {
            updateFields.odoo_order_id = odooOrderId;
        }

        await supabase.from("orders").update(updateFields).eq("id", order_id);

        await logEvent(
            supabase,
            odooOrderId ? "order.odoo_synced" : "order.odoo_sync_failed",
            "order",
            order_id,
            {
                odoo_order_id: odooOrderId,
                error: odooError,
            },
            "system",
        );

        // 7. Send order confirmation email
        try {
            const itemsForEmail = (order.order_items as Array<{
                quantity: number; unit_price: number;
                product: { name?: string } | null;
            }>).map((i) => ({
                name: i.product?.name ?? "Item",
                quantity: i.quantity,
                unit_price: i.unit_price,
            }));
            const total = itemsForEmail.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            const { subject, html } = buildOrderConfirmationEmail(
                customerName as string,
                order_id.slice(0, 8).toUpperCase(),
                itemsForEmail,
                total,
            );
            await sendEmail(user.email!, subject, html);
        } catch (emailErr) {
            console.error("Order confirmation email failed:", emailErr);
        }

        return json({
            success: true,
            odoo_order_id: odooOrderId,
            odoo_error: odooError,
        });
    } catch (err) {
        console.error("confirm-order error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
