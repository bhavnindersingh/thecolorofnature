import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ODOO_URL = Deno.env.get("ODOO_URL")!;
const ODOO_DB = Deno.env.get("ODOO_DB")!;
const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME")!;
const ODOO_API_KEY = Deno.env.get("ODOO_API_KEY")!;
const ODOO_WEB_WAREHOUSE_ID = parseInt(Deno.env.get("ODOO_WEB_WAREHOUSE_ID") || "6");

// ─── XML-RPC Helpers ─────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toXmlValue(value: unknown): string {
  if (typeof value === "string") return `<string>${escapeXml(value)}</string>`;
  if (typeof value === "number" && Number.isInteger(value)) return `<int>${value}</int>`;
  if (typeof value === "number") return `<double>${value}</double>`;
  if (typeof value === "boolean") return `<boolean>${value ? 1 : 0}</boolean>`;
  if (value === null || value === undefined) return `<nil/>`;
  if (Array.isArray(value)) {
    return `<array><data>${value.map((v) => `<value>${toXmlValue(v)}</value>`).join("")}</data></array>`;
  }
  if (typeof value === "object") {
    const members = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `<member><name>${k}</name><value>${toXmlValue(v)}</value></member>`)
      .join("");
    return `<struct>${members}</struct>`;
  }
  return `<nil/>`;
}

function toParam(value: unknown): string {
  return `<param><value>${toXmlValue(value)}</value></param>`;
}

async function xmlrpcCall(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${params.map(toParam).join("")}</params>
</methodCall>`;

  let resp: Response;
  try {
    resp = await fetch(`${ODOO_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Odoo server did not respond within 15 seconds — is it running?");
    }
    throw new Error(`Odoo server unreachable: ${(err as Error).message}`);
  }

  const xml = await resp.text();
  return parseXmlRpcResponse(xml);
}

function parseXmlRpcResponse(xml: string): unknown {
  const faultMatch = xml.match(/<fault>[\s\S]*?<string>([\s\S]*?)<\/string>/);
  if (faultMatch) throw new Error(`Odoo Fault: ${faultMatch[1]}`);

  const paramsMatch = xml.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/);
  if (!paramsMatch) throw new Error("Invalid XML-RPC response");
  return parseXmlValue(paramsMatch[1].trim());
}

function parseXmlValue(xml: string): unknown {
  let m = xml.match(/^<(?:int|i4)>([-\d]+)<\/(?:int|i4)>$/);
  if (m) return parseInt(m[1]);

  m = xml.match(/^<double>([-\d.]+)<\/double>$/);
  if (m) return parseFloat(m[1]);

  m = xml.match(/^<boolean>([01])<\/boolean>$/);
  if (m) return m[1] === "1";

  m = xml.match(/^<string>([\s\S]*?)<\/string>$/);
  if (m) return m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  if (xml.match(/^<nil\s*\/?>$/)) return null;

  m = xml.match(/^<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>$/);
  if (m) {
    const values: unknown[] = [];
    const valueRegex = /<value>([\s\S]*?)<\/value>/g;
    let vm;
    while ((vm = valueRegex.exec(m[1])) !== null) {
      values.push(parseXmlValue(vm[1].trim()));
    }
    return values;
  }

  m = xml.match(/^<struct>([\s\S]*?)<\/struct>$/);
  if (m) {
    const obj: Record<string, unknown> = {};
    const memberRegex = /<member>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let mm;
    while ((mm = memberRegex.exec(m[1])) !== null) {
      obj[mm[1].trim()] = parseXmlValue(mm[2].trim());
    }
    return obj;
  }

  return xml;
}

// ─── Odoo Auth ────────────────────────────────────────────────────────────────

async function getOdooUid(): Promise<number> {
  const uid = await xmlrpcCall("/xmlrpc/2/common", "authenticate", [
    ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {},
  ]);
  if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
  return uid;
}

async function odooExecute(uid: number, model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<unknown> {
  const params: unknown[] = [ODOO_DB, uid, ODOO_API_KEY, model, method, args];
  if (kwargs) params.push(kwargs);
  return xmlrpcCall("/xmlrpc/2/object", "execute_kw", params);
}

// ─── Action: Sync Order to Odoo ──────────────────────────────────────────────

interface OrderPayload {
  supabase_order_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  items: Array<{
    odoo_variant_id: number;  // product.product ID (variant level)
    quantity: number;
    price: number;
  }>;
}

async function handleSyncOrder(payload: OrderPayload) {
  const uid = await getOdooUid();

  // 1. Ensure customer exists in Odoo (upsert by email)
  const email = payload.customer_email;
  const existingPartners = await odooExecute(uid, "res.partner", "search", [
    [["email", "=", email]],
  ]) as number[];

  let partnerId = existingPartners.length > 0 ? existingPartners[0] : null;

  if (!partnerId) {
    partnerId = await odooExecute(uid, "res.partner", "create", [{
      name: payload.customer_name || email,
      email,
      phone: payload.customer_phone || false,
      customer_rank: 1,
    }]) as number;
  }

  // 2. Create Sale Order in Odoo (assigned to WHWE warehouse)
  const orderId = await odooExecute(uid, "sale.order", "create", [{
    partner_id: partnerId,
    client_order_ref: payload.supabase_order_id,
    warehouse_id: ODOO_WEB_WAREHOUSE_ID,
  }]) as number;

  // 3. Add order lines (using product.product / variant IDs)
  for (const item of payload.items) {
    await odooExecute(uid, "sale.order.line", "create", [{
      order_id: orderId,
      product_id: item.odoo_variant_id,  // product.product ID
      product_uom_qty: item.quantity,
      price_unit: item.price,
    }]);
  }

  // 4. Confirm the Sale Order → triggers stock reservation & delivery order
  await odooExecute(uid, "sale.order", "action_confirm", [[orderId]]);

  return { success: true, odoo_order_id: orderId, partner_id: partnerId };
}

// ─── Action: Cancel Order in Odoo ────────────────────────────────────────────

interface CancelPayload {
  odoo_order_id: number;
}

async function handleCancelOrder(payload: CancelPayload) {
  const uid = await getOdooUid();

  // Check current order status
  const orders = await odooExecute(uid, "sale.order", "search_read", [
    [["id", "=", payload.odoo_order_id]],
  ], { fields: ["state", "name"] }) as Array<{ id: number; state: string; name: string }>;

  if (orders.length === 0) {
    throw new Error(`Order ${payload.odoo_order_id} not found in Odoo`);
  }

  const order = orders[0];

  // Can only cancel if in draft or sale state
  if (order.state === "cancel") {
    return { success: true, message: "Order already cancelled", odoo_order_id: order.id };
  }

  if (order.state === "done") {
    throw new Error(`Order ${order.name} is already locked/done. Use return instead.`);
  }

  // Cancel the order
  await odooExecute(uid, "sale.order", "action_cancel", [[payload.odoo_order_id]]);

  return { success: true, message: `Order ${order.name} cancelled`, odoo_order_id: order.id };
}

// ─── Action: Return Order (create reverse stock picking) ─────────────────────

interface ReturnPayload {
  odoo_order_id: number;
  items?: Array<{
    odoo_variant_id: number;
    quantity: number;
  }>;
}

async function handleReturnOrder(payload: ReturnPayload) {
  const uid = await getOdooUid();

  // 1. Find the delivery (stock.picking) for this sale order
  const pickings = await odooExecute(uid, "stock.picking", "search_read", [
    [["origin", "like", `SO`], ["sale_id", "=", payload.odoo_order_id], ["state", "=", "done"]],
  ], { fields: ["id", "name", "state"] }) as Array<{ id: number; name: string; state: string }>;

  if (pickings.length === 0) {
    // Try finding by sale order name
    const orders = await odooExecute(uid, "sale.order", "search_read", [
      [["id", "=", payload.odoo_order_id]],
    ], { fields: ["name", "picking_ids"] }) as Array<{ id: number; name: string; picking_ids: number[] }>;

    if (orders.length === 0 || orders[0].picking_ids.length === 0) {
      throw new Error(`No delivered pickings found for order ${payload.odoo_order_id}`);
    }

    // Find done pickings from the order's picking_ids
    const donePicks = await odooExecute(uid, "stock.picking", "search_read", [
      [["id", "in", orders[0].picking_ids], ["state", "=", "done"]],
    ], { fields: ["id", "name", "state"] }) as Array<{ id: number; name: string; state: string }>;

    if (donePicks.length === 0) {
      throw new Error(`No completed deliveries found for order ${orders[0].name}`);
    }

    pickings.push(...donePicks);
  }

  const pickingId = pickings[0].id;

  // 2. Create the return wizard
  const returnWizardId = await odooExecute(uid, "stock.return.picking", "create", [{
    picking_id: pickingId,
  }]) as number;

  // 3. Execute the return (creates a new incoming picking)
  const result = await odooExecute(uid, "stock.return.picking", "create_returns", [[returnWizardId]]);

  return {
    success: true,
    message: `Return created for picking ${pickings[0].name}`,
    result,
  };
}

// ─── Action: Get Products (simple listing) ───────────────────────────────────

async function handleGetProducts() {
  const uid = await getOdooUid();
  const products = await odooExecute(uid, "product.template", "search_read", [
    [["sale_ok", "=", true], ["active", "=", true]],
  ], {
    fields: ["name", "list_price", "categ_id", "type"],
    limit: 50,
  });
  return products;
}

// ─── Main Server ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    let result: unknown;
    switch (action) {
      case "sync_order":
        result = await handleSyncOrder(payload as OrderPayload);
        break;
      case "cancel_order":
        result = await handleCancelOrder(payload as CancelPayload);
        break;
      case "return_order":
        result = await handleReturnOrder(payload as ReturnPayload);
        break;
      case "get_products":
        result = await handleGetProducts();
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
