import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
    const val = Deno.env.get(name);
    if (!val) throw new Error(`Missing required env var: ${name}`);
    return val;
}

const ODOO_URL = requireEnv("ODOO_URL");
const ODOO_DB = requireEnv("ODOO_DB");
const ODOO_USERNAME = requireEnv("ODOO_USERNAME");
const ODOO_API_KEY = requireEnv("ODOO_API_KEY");
const _odooLocationRaw = requireEnv("ODOO_WEB_LOCATION_ID");
const ODOO_WEB_LOCATION_ID = parseInt(_odooLocationRaw, 10);
if (isNaN(ODOO_WEB_LOCATION_ID)) throw new Error(`ODOO_WEB_LOCATION_ID must be a number, got: "${_odooLocationRaw}"`);

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const ODOO_WEBHOOK_SECRET = requireEnv("ODOO_WEBHOOK_SECRET");

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

// ─── JSON-RPC Helpers (same as sync-products) ─────────────────────────────────

let _rpcId = 1;

async function jsonrpc(service: string, method: string, args: unknown[]): Promise<unknown> {
    const resp = await fetch(`${ODOO_URL}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: _rpcId++, params: { service, method, args } }),
    });
    const result = await resp.json();
    if (result.error) throw new Error(`Odoo: ${JSON.stringify(result.error.data?.message ?? result.error)}`);
    return result.result;
}

async function getOdooUid(): Promise<number> {
    const uid = await jsonrpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
    if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
    return uid;
}

async function odooExecute(uid: number, model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<unknown> {
    return jsonrpc("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs ?? {}]);
}

// ─── Event logger ─────────────────────────────────────────────────────────────

async function logEvent(
    supabase: ReturnType<typeof createClient>,
    event_type: string,
    entity_type: string,
    entity_id: string | null,
    details: Record<string, unknown> = {},
) {
    await supabase.from("event_log").insert({ event_type, entity_type, entity_id, details, actor: "odoo_poll" });
}

// ─── Poll handlers ────────────────────────────────────────────────────────────

async function pollDeliveries(supabase: ReturnType<typeof createClient>, uid: number, cutoff: string) {
    const pickings = await odooExecute(uid, "stock.picking", "search_read", [
        [["state", "=", "done"], ["sale_id", "!=", false], ["date_done", ">=", cutoff]],
    ], { fields: ["id", "name", "sale_id", "date_done"] }) as Array<{
        id: number; name: string; sale_id: [number, string]; date_done: string;
    }>;

    let updated = 0;
    for (const picking of pickings) {
        const saleOrderId = picking.sale_id[0];
        const { data: order } = await supabase
            .from("orders")
            .select("id, status")
            .eq("odoo_order_id", saleOrderId)
            .single();

        if (!order || order.status === "delivered") continue;

        await supabase.from("orders").update({
            status: "delivered",
            odoo_picking_name: picking.name,
            delivered_at: new Date(picking.date_done).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", order.id);

        await logEvent(supabase, "poll.order_delivered", "order", order.id, {
            picking_id: picking.id,
            picking_name: picking.name,
            sale_order_id: saleOrderId,
        });
        updated++;
    }
    return { checked: pickings.length, updated };
}

async function pollCancellations(supabase: ReturnType<typeof createClient>, uid: number, cutoff: string) {
    const orders = await odooExecute(uid, "sale.order", "search_read", [
        [["state", "=", "cancel"], ["write_date", ">=", cutoff]],
    ], { fields: ["id"] }) as Array<{ id: number }>;

    let updated = 0;
    for (const odooOrder of orders) {
        const { data: order } = await supabase
            .from("orders")
            .select("id, status")
            .eq("odoo_order_id", odooOrder.id)
            .single();

        if (!order || order.status === "cancelled") continue;

        await supabase.from("orders").update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
        }).eq("id", order.id);

        await logEvent(supabase, "poll.order_cancelled", "order", order.id, {
            sale_order_id: odooOrder.id,
        });
        updated++;
    }
    return { checked: orders.length, updated };
}

async function pollStock(supabase: ReturnType<typeof createClient>, uid: number) {
    const quants = await odooExecute(uid, "stock.quant", "search_read", [
        [["location_id", "=", ODOO_WEB_LOCATION_ID]],
    ], { fields: ["product_id", "quantity"] }) as Array<{
        product_id: [number, string]; quantity: number;
    }>;

    // Build map: odoo variant id → quantity
    const stockMap = new Map<number, number>();
    for (const q of quants) {
        const variantId = q.product_id[0];
        stockMap.set(variantId, (stockMap.get(variantId) ?? 0) + q.quantity);
    }

    // Zero out all variants first, then set positive stock
    const updates = Array.from(stockMap.entries()).map(([odoo_variant_id, quantity]) =>
        supabase.from("product_variants")
            .update({ stock_quantity: Math.max(0, Math.floor(quantity)) })
            .eq("odoo_variant_id", odoo_variant_id)
    );
    await Promise.all(updates);

    // Zero out variants not in the stock map
    await supabase.from("product_variants")
        .update({ stock_quantity: 0 })
        .not("odoo_variant_id", "in", `(${Array.from(stockMap.keys()).join(",") || "0"})`);

    await supabase.rpc("recalculate_product_stock");

    await logEvent(supabase, "poll.stock_updated", "product_sync", null, {
        variants_with_stock: stockMap.size,
    });

    return { variants_updated: stockMap.size };
}

async function triggerProductSync() {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/sync-products`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => resp.statusText);
        throw new Error(`sync-products returned ${resp.status}: ${text}`);
    }
    return resp.json();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Auth via webhook secret (same secret used by odoo-webhook)
    const secret = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
    if (!secret || secret !== ODOO_WEBHOOK_SECRET) {
        return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: Record<string, unknown> = {};
    const errors: string[] = [];

    try {
        const uid = await getOdooUid();
        const cutoff = new Date(Date.now() - 60 * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .substring(0, 19);

        // 1. Deliveries
        try {
            results.deliveries = await pollDeliveries(supabase, uid, cutoff);
        } catch (e) {
            errors.push(`deliveries: ${(e as Error).message}`);
        }

        // 2. Cancellations
        try {
            results.cancellations = await pollCancellations(supabase, uid, cutoff);
        } catch (e) {
            errors.push(`cancellations: ${(e as Error).message}`);
        }

        // 3. Stock
        try {
            results.stock = await pollStock(supabase, uid);
        } catch (e) {
            errors.push(`stock: ${(e as Error).message}`);
        }

        // 4. Full product sync (products, variants, images)
        try {
            results.product_sync = await triggerProductSync();
        } catch (e) {
            errors.push(`product_sync: ${(e as Error).message}`);
        }

        await logEvent(supabase, "poll.completed", "product_sync", null, { results, errors });

        return json({ success: true, results, errors });
    } catch (err) {
        console.error("odoo-poll error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
