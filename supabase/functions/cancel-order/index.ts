import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, buildOrderCancelledEmail } from "../_shared/email.ts";

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

// ─── Internal function caller ────────────────────────────────────────────────

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
    actor = "customer",
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
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return json({ error: "Missing authorization" }, 401);

        const token = authHeader.replace("Bearer ", "").trim();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Verify JWT and get user
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const {
            data: { user },
            error: authErr,
        } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: "Unauthorized" }, 401);

        const { order_id } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        // Fetch order and verify ownership
        const { data: order, error: orderErr } = await supabase
            .from("orders")
            .select("id, user_id, status, odoo_order_id")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.user_id !== user.id) return json({ error: "Not your order" }, 403);

        const cancellable = ["pending", "paid", "processing"];
        if (!cancellable.includes(order.status)) {
            return json(
                { error: `Cannot cancel: order status is '${order.status}'` },
                400,
            );
        }

        // Cancel in Odoo if synced (non-blocking — still cancel locally if Odoo fails)
        let odooError: string | null = null;
        if (order.odoo_order_id) {
            try {
                const result = (await callFunction("sync-to-odoo", {
                    action: "cancel_order",
                    payload: { odoo_order_id: order.odoo_order_id },
                })) as { success: boolean; error?: string };

                if (!result.success) {
                    odooError = result.error ?? "Odoo cancel returned failure";
                }
            } catch (err) {
                odooError = (err as Error).message;
            }
        }

        // Update order status to cancelled
        await supabase
            .from("orders")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", order_id);

        await logEvent(supabase, "order.cancelled", "order", order_id, {
            cancelled_by: "customer",
            odoo_order_id: order.odoo_order_id,
            odoo_error: odooError,
        });

        // Send cancellation email
        try {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, first_name")
                .eq("id", user.id)
                .single();
            const customerName = profile?.full_name ?? profile?.first_name ?? "Customer";
            const orderRef = order_id.slice(0, 8).toUpperCase();
            const { subject, html } = buildOrderCancelledEmail(customerName, orderRef, null);
            await sendEmail(user.email!, subject, html);
        } catch (emailErr) {
            console.error("Cancellation email failed:", emailErr);
        }

        return json({ success: true, odoo_error: odooError });
    } catch (err) {
        console.error("cancel-order error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
