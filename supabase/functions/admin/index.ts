import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────────

const ADMIN_PIN = Deno.env.get("ADMIN_PIN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ─── Internal function caller ─────────────────────────────────────────────────

async function callFunction(name: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    return resp.json();
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function listOrders(supabase: ReturnType<typeof createClient>, filter?: string) {
    let query = supabase
        .from("orders")
        .select(`
            id, status, total_amount, shipping_address, odoo_order_id,
            tracking_number, carrier, estimated_delivery, odoo_picking_name,
            created_at, updated_at, user_id,
            order_items (
                id, quantity, unit_price,
                product:products ( id, name, image_url )
            ),
            return_requests ( id, status, reason, admin_note, odoo_return_id, created_at ),
            profile:profiles ( full_name, first_name, last_name, phone, odoo_partner_id )
        `)
        .order("created_at", { ascending: false });

    if (filter === "failed_odoo") {
        query = query.is("odoo_order_id", null).in("status", ["paid", "processing"]);
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    // Batch-fetch customer emails from auth.users
    const uniqueUserIds = [...new Set((orders ?? []).map((o: { user_id: string }) => o.user_id).filter(Boolean))];
    let emailMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
        const { data: emails } = await supabase.rpc("get_user_emails", { user_ids: uniqueUserIds });
        if (emails) {
            emailMap = new Map((emails as Array<{ id: string; email: string }>).map((e) => [e.id, e.email]));
        }
    }

    const enriched = (orders ?? []).map((o: { user_id: string }) => ({
        ...o,
        customer_email: emailMap.get(o.user_id) ?? null,
    }));

    return enriched;
}

async function updateOrderStatus(
    supabase: ReturnType<typeof createClient>,
    order_id: string,
    status: string,
    note?: string,
) {
    const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", order_id);
    if (error) throw new Error(error.message);

    // Trigger auto-log is via DB trigger, but insert a manual note if provided
    if (note) {
        await supabase.from("order_status_history").insert({
            order_id,
            status,
            note,
            changed_by: "admin",
        });
    }

    return { success: true, order_id };
}

async function updateTracking(
    supabase: ReturnType<typeof createClient>,
    order_id: string,
    tracking_number: string,
    carrier: string,
    estimated_delivery?: string,
) {
    const { error } = await supabase
        .from("orders")
        .update({
            tracking_number,
            carrier,
            estimated_delivery: estimated_delivery ?? null,
            status: "shipped",
            updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);
    if (error) throw new Error(error.message);
    return { success: true };
}

async function pushToOdoo(supabase: ReturnType<typeof createClient>, order_id: string) {
    // Fetch order with items and variant IDs
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select(`
            id, user_id, odoo_order_id,
            order_items (
                quantity, unit_price,
                product:products (
                    product_variants ( odoo_variant_id )
                )
            )
        `)
        .eq("id", order_id)
        .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Order not found");
    if (order.odoo_order_id) return { success: true, message: "Already synced", odoo_order_id: order.odoo_order_id };

    // Get customer email
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(order.user_id);
    if (userErr || !user) throw new Error("Could not fetch customer user");

    // Get customer name from profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", order.user_id)
        .single();
    const customerName =
        profile?.full_name ??
        ([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email);

    // Build items — take first variant per order item
    type OrderItem = {
        quantity: number;
        unit_price: number;
        product: { product_variants: Array<{ odoo_variant_id: number | null }> } | null;
    };
    const items = (order.order_items as OrderItem[])
        .map((item) => ({
            odoo_variant_id: item.product?.product_variants?.[0]?.odoo_variant_id ?? null,
            quantity: item.quantity,
            price: item.unit_price,
        }))
        .filter((i) => i.odoo_variant_id != null);

    if (items.length === 0) throw new Error("No items with valid Odoo variant IDs");

    // Call sync-to-odoo
    const syncResult = await callFunction("sync-to-odoo", {
        action: "sync_order",
        payload: {
            supabase_order_id: order.id,
            customer_email: user.email,
            customer_name: customerName,
            items,
        },
    }) as { success: boolean; odoo_order_id?: number; error?: string };

    if (!syncResult.success) throw new Error(syncResult.error ?? "sync-to-odoo failed");

    // Write odoo_order_id back (sync-to-odoo doesn't do this)
    if (syncResult.odoo_order_id) {
        await supabase
            .from("orders")
            .update({ odoo_order_id: syncResult.odoo_order_id, status: "processing", updated_at: new Date().toISOString() })
            .eq("id", order_id);
    }

    return { success: true, odoo_order_id: syncResult.odoo_order_id };
}

async function cancelOrder(supabase: ReturnType<typeof createClient>, order_id: string) {
    const { data: order, error } = await supabase
        .from("orders")
        .select("odoo_order_id, status")
        .eq("id", order_id)
        .single();
    if (error || !order) throw new Error(error?.message ?? "Order not found");

    if (order.odoo_order_id) {
        const result = await callFunction("sync-to-odoo", {
            action: "cancel_order",
            payload: { odoo_order_id: order.odoo_order_id },
        }) as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error ?? "Odoo cancel failed");
    }

    await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order_id);

    return { success: true };
}

async function handleReturn(
    supabase: ReturnType<typeof createClient>,
    return_request_id: string,
    action: "approve" | "reject",
    admin_note?: string,
) {
    const { data: returnReq, error } = await supabase
        .from("return_requests")
        .select("id, order_id, orders ( odoo_order_id )")
        .eq("id", return_request_id)
        .single();
    if (error || !returnReq) throw new Error(error?.message ?? "Return request not found");

    if (action === "reject") {
        await supabase
            .from("return_requests")
            .update({ status: "rejected", admin_note: admin_note ?? null })
            .eq("id", return_request_id);
        return { success: true };
    }

    // Approve
    type ReturnReqWithOrder = { orders: { odoo_order_id: number | null } | null };
    const odooOrderId = (returnReq as unknown as ReturnReqWithOrder).orders?.odoo_order_id ?? null;
    let odooReturnId: number | null = null;

    if (odooOrderId) {
        const result = await callFunction("sync-to-odoo", {
            action: "return_order",
            payload: { odoo_order_id: odooOrderId },
        }) as { success: boolean; result?: { res_id?: number }; error?: string };
        if (result.success) {
            odooReturnId = result.result?.res_id ?? null;
        }
    }

    await supabase
        .from("return_requests")
        .update({
            status: "approved",
            admin_note: admin_note ?? null,
            odoo_return_id: odooReturnId,
        })
        .eq("id", return_request_id);

    return { success: true, odoo_return_id: odooReturnId };
}

async function syncProducts() {
    const result = await callFunction("sync-products", {});
    return result;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // ── PIN validation ──
    const pin = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
    if (!pin || pin !== ADMIN_PIN) {
        return json({ error: "Unauthorized" }, 401);
    }

    try {
        const { action, payload = {} } = await req.json();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        switch (action) {
            case "validate_pin":
                return json({ success: true });

            case "list_orders":
                return json({ success: true, orders: await listOrders(supabase, payload.filter) });

            case "update_order_status":
                return json(await updateOrderStatus(supabase, payload.order_id, payload.status, payload.note));

            case "update_tracking":
                return json(await updateTracking(
                    supabase,
                    payload.order_id,
                    payload.tracking_number,
                    payload.carrier,
                    payload.estimated_delivery,
                ));

            case "push_to_odoo":
                return json(await pushToOdoo(supabase, payload.order_id));

            case "cancel_order":
                return json(await cancelOrder(supabase, payload.order_id));

            case "handle_return":
                return json(await handleReturn(supabase, payload.return_request_id, payload.action, payload.admin_note));

            case "sync_products":
                return json(await syncProducts());

            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        console.error("Admin function error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
