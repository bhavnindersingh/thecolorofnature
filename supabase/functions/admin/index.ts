import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, buildReturnApprovalEmail } from "../_shared/email.ts";

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

// ─── Event Logger ─────────────────────────────────────────────────────────────

async function logEvent(
    supabase: ReturnType<typeof createClient>,
    event_type: string,
    entity_type: string,
    entity_id: string | null,
    details: Record<string, unknown> = {},
    actor = "admin",
) {
    await supabase
        .from("event_log")
        .insert({ event_type, entity_type, entity_id, details, actor });
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
            return_requests ( id, status, reason, admin_note, return_instructions, odoo_return_id, created_at, updated_at ),
            profile:profiles ( full_name, first_name, last_name, phone, odoo_partner_id )
        `)
        .order("created_at", { ascending: false });

    if (filter === "failed_odoo") {
        query = query.is("odoo_order_id", null).in("status", ["paid", "processing"]);
    }

    if (filter === "pending_returns") {
        query = query.not("return_requests", "is", null);
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
    // Get old status for logging
    const { data: oldOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order_id)
        .single();

    const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", order_id);
    if (error) throw new Error(error.message);

    if (note) {
        await supabase.from("order_status_history").insert({
            order_id,
            status,
            note,
            changed_by: "admin",
        });
    }

    await logEvent(supabase, "order.status_changed", "order", order_id, {
        old_status: oldOrder?.status,
        new_status: status,
        note,
    });

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

    await logEvent(supabase, "order.tracking_updated", "order", order_id, {
        tracking_number,
        carrier,
        estimated_delivery,
    });

    return { success: true };
}

async function pushToOdoo(supabase: ReturnType<typeof createClient>, order_id: string) {
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

    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(order.user_id);
    if (userErr || !user) throw new Error("Could not fetch customer user");

    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", order.user_id)
        .single();
    const customerName =
        profile?.full_name ??
        ([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email);

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

    if (syncResult.odoo_order_id) {
        await supabase
            .from("orders")
            .update({ odoo_order_id: syncResult.odoo_order_id, status: "processing", updated_at: new Date().toISOString() })
            .eq("id", order_id);
    }

    await logEvent(supabase, "order.odoo_synced", "order", order_id, {
        odoo_order_id: syncResult.odoo_order_id,
    });

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

    await logEvent(supabase, "order.cancelled", "order", order_id, {
        had_odoo_order: !!order.odoo_order_id,
    });

    return { success: true };
}

// ─── Return Handling (multi-step) ────────────────────────────────────────────

async function handleReturn(
    supabase: ReturnType<typeof createClient>,
    return_request_id: string,
    action: "approve" | "reject",
    admin_note?: string,
    return_instructions?: string,
) {
    const { data: returnReq, error } = await supabase
        .from("return_requests")
        .select("id, order_id, user_id, orders ( odoo_order_id )")
        .eq("id", return_request_id)
        .single();
    if (error || !returnReq) throw new Error(error?.message ?? "Return request not found");

    if (action === "reject") {
        await supabase
            .from("return_requests")
            .update({ status: "rejected", admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
            .eq("id", return_request_id);

        await logEvent(supabase, "return.rejected", "return", return_request_id, {
            order_id: returnReq.order_id,
            admin_note,
        });

        return { success: true };
    }

    // Approve — send email with return instructions, do NOT create Odoo return yet
    await supabase
        .from("return_requests")
        .update({
            status: "approved",
            admin_note: admin_note ?? null,
            return_instructions: return_instructions ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", return_request_id);

    // Send email to customer
    let emailSent = false;
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(returnReq.user_id);
        if (user?.email && return_instructions) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, first_name")
                .eq("id", returnReq.user_id)
                .single();
            const customerName = profile?.full_name ?? profile?.first_name ?? "Customer";
            const orderRef = returnReq.order_id.slice(0, 8).toUpperCase();

            const { subject, html } = buildReturnApprovalEmail(customerName, orderRef, return_instructions);
            await sendEmail(user.email, subject, html);
            emailSent = true;
        }
    } catch (emailErr) {
        console.error("Failed to send return approval email:", emailErr);
    }

    await logEvent(supabase, "return.approved", "return", return_request_id, {
        order_id: returnReq.order_id,
        admin_note,
        return_instructions,
        email_sent: emailSent,
    });

    return { success: true, email_sent: emailSent };
}

async function markReturnReceived(
    supabase: ReturnType<typeof createClient>,
    return_request_id: string,
) {
    const { data: returnReq, error } = await supabase
        .from("return_requests")
        .select("id, order_id, status, orders ( odoo_order_id )")
        .eq("id", return_request_id)
        .single();
    if (error || !returnReq) throw new Error(error?.message ?? "Return request not found");
    if (returnReq.status !== "item_shipped") {
        throw new Error(`Cannot mark as received: current status is '${returnReq.status}', expected 'item_shipped'`);
    }

    // NOW create the Odoo return (stock.return.picking)
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
            status: "item_received",
            odoo_return_id: odooReturnId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", return_request_id);

    await logEvent(supabase, "return.item_received", "return", return_request_id, {
        order_id: returnReq.order_id,
        odoo_return_id: odooReturnId,
    });

    return { success: true, odoo_return_id: odooReturnId };
}

async function completeReturn(
    supabase: ReturnType<typeof createClient>,
    return_request_id: string,
) {
    const { data: returnReq, error } = await supabase
        .from("return_requests")
        .select("id, order_id, status")
        .eq("id", return_request_id)
        .single();
    if (error || !returnReq) throw new Error(error?.message ?? "Return request not found");
    if (returnReq.status !== "item_received") {
        throw new Error(`Cannot complete: current status is '${returnReq.status}', expected 'item_received'`);
    }

    await supabase
        .from("return_requests")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", return_request_id);

    await logEvent(supabase, "return.completed", "return", return_request_id, {
        order_id: returnReq.order_id,
    });

    return { success: true };
}

// ─── Event Log Listing ───────────────────────────────────────────────────────

async function listEvents(
    supabase: ReturnType<typeof createClient>,
    entity_type?: string,
    entity_id?: string,
    limit = 50,
    offset = 0,
) {
    let query = supabase
        .from("event_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

async function syncProducts(supabase: ReturnType<typeof createClient>) {
    const result = await callFunction("sync-products", {});

    await logEvent(supabase, "product_sync.completed", "product_sync", null, {
        result,
    });

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
                return json(await handleReturn(
                    supabase,
                    payload.return_request_id,
                    payload.action,
                    payload.admin_note,
                    payload.return_instructions,
                ));

            case "mark_return_received":
                return json(await markReturnReceived(supabase, payload.return_request_id));

            case "complete_return":
                return json(await completeReturn(supabase, payload.return_request_id));

            case "list_events":
                return json({
                    success: true,
                    events: await listEvents(
                        supabase,
                        payload.entity_type,
                        payload.entity_id,
                        payload.limit,
                        payload.offset,
                    ),
                });

            case "sync_products":
                return json(await syncProducts(supabase));

            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        console.error("Admin function error:", err);
        return json({ error: (err as Error).message }, 500);
    }
});
