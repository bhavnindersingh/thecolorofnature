import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODOO_WEBHOOK_SECRET = Deno.env.get("ODOO_WEBHOOK_SECRET")!;

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

// ─── Event logger ────────────────────────────────────────────────────────────

async function logEvent(
    supabase: ReturnType<typeof createClient>,
    event_type: string,
    entity_type: string,
    entity_id: string | null,
    details: Record<string, unknown> = {},
    actor = "odoo_webhook",
) {
    await supabase
        .from("event_log")
        .insert({ event_type, entity_type, entity_id, details, actor });
}

// ─── Payload types ────────────────────────────────────────────────────────────

interface PickingDonePayload {
    event: "picking_done";
    picking_id: number;
    picking_name: string;
    sale_order_id: number;
    state: string;
    date_done: string | null;
}

interface OrderCancelledPayload {
    event: "order_cancelled";
    sale_order_id: number;
}

interface StockUpdatePayload {
    event: "stock_update";
    products: Array<{ odoo_variant_id: number; quantity: number }>;
}

interface FullProductSyncPayload {
    event: "full_product_sync";
}

type WebhookPayload =
    | PickingDonePayload
    | OrderCancelledPayload
    | StockUpdatePayload
    | FullProductSyncPayload;

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handlePickingDone(
    supabase: ReturnType<typeof createClient>,
    payload: PickingDonePayload,
) {
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, status, odoo_order_id")
        .eq("odoo_order_id", payload.sale_order_id)
        .single();

    if (orderErr || !order) {
        console.warn(`Webhook: No order found for odoo_order_id=${payload.sale_order_id}`);
        await logEvent(supabase, "webhook.picking_done_unmatched", "order", null, {
            sale_order_id: payload.sale_order_id,
            picking_name: payload.picking_name,
        });
        return json({ success: false, message: "No matching order found" });
    }

    if (order.status === "delivered") {
        return json({ success: true, message: "Order already delivered" });
    }

    const { error: updateErr } = await supabase
        .from("orders")
        .update({
            status: "delivered",
            odoo_picking_name: payload.picking_name,
            delivered_at: payload.date_done
                ? new Date(payload.date_done).toISOString()
                : new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

    if (updateErr) {
        console.error("Webhook: Failed to update order:", updateErr);
        return json({ error: updateErr.message }, 500);
    }

    await logEvent(supabase, "webhook.picking_done", "order", order.id, {
        picking_id: payload.picking_id,
        picking_name: payload.picking_name,
        sale_order_id: payload.sale_order_id,
        date_done: payload.date_done,
        previous_status: order.status,
    });

    return json({ success: true, order_id: order.id, message: "Order marked as delivered" });
}

async function handleOrderCancelled(
    supabase: ReturnType<typeof createClient>,
    payload: OrderCancelledPayload,
) {
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, status")
        .eq("odoo_order_id", payload.sale_order_id)
        .single();

    if (orderErr || !order) {
        console.warn(`Webhook: No order found for odoo_order_id=${payload.sale_order_id}`);
        await logEvent(supabase, "webhook.order_cancelled_unmatched", "order", null, {
            sale_order_id: payload.sale_order_id,
        });
        return json({ success: false, message: "No matching order found" });
    }

    if (order.status === "cancelled") {
        return json({ success: true, message: "Order already cancelled" });
    }

    const { error: updateErr } = await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);

    if (updateErr) {
        console.error("Webhook: Failed to cancel order:", updateErr);
        return json({ error: updateErr.message }, 500);
    }

    await logEvent(supabase, "webhook.order_cancelled", "order", order.id, {
        sale_order_id: payload.sale_order_id,
        previous_status: order.status,
    });

    return json({ success: true, order_id: order.id, message: "Order marked as cancelled" });
}

async function handleStockUpdate(
    supabase: ReturnType<typeof createClient>,
    payload: StockUpdatePayload,
) {
    if (!payload.products?.length) {
        return json({ success: true, message: "No products in payload" });
    }

    const updates = payload.products.map((p) =>
        supabase
            .from("product_variants")
            .update({ stock_quantity: p.quantity })
            .eq("odoo_variant_id", p.odoo_variant_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error).map((r) => r.error!.message);

    if (errors.length) {
        console.error("Webhook: Stock update errors:", errors);
    }

    await supabase.rpc("recalculate_product_stock");

    await logEvent(supabase, "webhook.stock_update", "product_sync", null, {
        products_updated: payload.products.length,
        errors: errors.length > 0 ? errors : undefined,
    });

    return json({
        success: true,
        products_updated: payload.products.length,
        errors: errors.length,
    });
}

async function handleFullProductSync(
    supabase: ReturnType<typeof createClient>,
) {
    // Delegate to the existing sync-products edge function — it handles
    // products, variants, images, and removal of delisted products.
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/sync-products`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
    });

    const result = await resp.json().catch(() => ({}));

    await logEvent(supabase, "webhook.full_product_sync", "product_sync", null, {
        triggered_by: "odoo_scheduled_action",
        sync_result: result,
    });

    return json({ success: true, message: "Full product sync triggered", result });
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    const secret = authHeader?.replace("Bearer ", "").trim();
    if (!secret || secret !== ODOO_WEBHOOK_SECRET) {
        return json({ error: "Unauthorized" }, 401);
    }

    try {
        const payload = (await req.json()) as WebhookPayload;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        if (payload.event === "picking_done") return await handlePickingDone(supabase, payload);
        if (payload.event === "order_cancelled") return await handleOrderCancelled(supabase, payload);
        if (payload.event === "stock_update") return await handleStockUpdate(supabase, payload);
        if (payload.event === "full_product_sync") return await handleFullProductSync(supabase);

        return json({ error: `Unknown event: ${(payload as WebhookPayload).event}` }, 400);
    } catch (err) {
        console.error("odoo-webhook error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
