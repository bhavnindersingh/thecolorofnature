import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ODOO_URL = Deno.env.get("ODOO_URL")!;
const ODOO_DB = Deno.env.get("ODOO_DB")!;
const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME")!;
const ODOO_API_KEY = Deno.env.get("ODOO_API_KEY")!;

// ─── XML-RPC Helper ───────────────────────────────────────────────────────────

function xmlrpcCall(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${params.map(toXml).join("")}</params>
</methodCall>`;

  return fetch(`${ODOO_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  })
    .then((r) => r.text())
    .then(parseXmlResponse);
}

function toXml(value: unknown): string {
  if (typeof value === "string") return `<param><value><string>${value}</string></value></param>`;
  if (typeof value === "number" && Number.isInteger(value)) return `<param><value><int>${value}</int></value></param>`;
  if (typeof value === "boolean") return `<param><value><boolean>${value ? 1 : 0}</boolean></value></param>`;
  if (Array.isArray(value)) return `<param><value><array><data>${value.map((v) => `<value>${innerXml(v)}</value>`).join("")}</data></array></value></param>`;
  if (typeof value === "object" && value !== null) {
    const members = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `<member><name>${k}</name><value>${innerXml(v)}</value></member>`)
      .join("");
    return `<param><value><struct>${members}</struct></value></param>`;
  }
  return `<param><value><nil/></value></param>`;
}

function innerXml(value: unknown): string {
  if (typeof value === "string") return `<string>${value}</string>`;
  if (typeof value === "number" && Number.isInteger(value)) return `<int>${value}</int>`;
  if (typeof value === "boolean") return `<boolean>${value ? 1 : 0}</boolean>`;
  if (Array.isArray(value)) return `<array><data>${value.map((v) => `<value>${innerXml(v)}</value>`).join("")}</data></array>`;
  if (typeof value === "object" && value !== null) {
    const members = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `<member><name>${k}</name><value>${innerXml(v)}</value></member>`)
      .join("");
    return `<struct>${members}</struct>`;
  }
  return `<nil/>`;
}

function parseXmlResponse(xml: string): unknown {
  const match = xml.match(/<value>([\s\S]*?)<\/value>/);
  if (!match) throw new Error("Invalid XML-RPC response");
  const intMatch = match[1].match(/<int>(\d+)<\/int>/);
  if (intMatch) return parseInt(intMatch[1]);
  const strMatch = match[1].match(/<string>([\s\S]*?)<\/string>/);
  if (strMatch) return strMatch[1];
  return match[1];
}

// ─── Odoo Auth ────────────────────────────────────────────────────────────────

async function getOdooUid(): Promise<number> {
  const uid = await xmlrpcCall("/xmlrpc/2/common", "authenticate", [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ]);
  if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
  return uid;
}

async function odooExecute(uid: number, model: string, method: string, args: unknown[]): Promise<unknown> {
  return xmlrpcCall("/xmlrpc/2/object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
  ]);
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function handleNewOrder(payload: Record<string, unknown>) {
  const uid = await getOdooUid();

  // 1. Ensure customer exists in Odoo (upsert by email)
  const email = payload.customer_email as string;
  let [partnerId] = (await odooExecute(uid, "res.partner", "search", [[["email", "=", email]]]) as number[]);

  if (!partnerId) {
    partnerId = await odooExecute(uid, "res.partner", "create", [{
      name: payload.customer_name,
      email,
      customer_rank: 1,
    }]) as number;
  }

  // 2. Create Sale Order in Odoo
  const orderId = await odooExecute(uid, "sale.order", "create", [{
    partner_id: partnerId,
    client_order_ref: payload.supabase_order_id,
  }]) as number;

  // 3. Add order lines
  const items = payload.items as Array<{ odoo_product_id: number; quantity: number; price: number }>;
  for (const item of items) {
    await odooExecute(uid, "sale.order.line", "create", [{
      order_id: orderId,
      product_id: item.odoo_product_id,
      product_uom_qty: item.quantity,
      price_unit: item.price,
    }]);
  }

  return { success: true, odoo_order_id: orderId };
}

async function handleGetProducts() {
  const uid = await getOdooUid();
  const products = await odooExecute(uid, "product.template", "search_read", [
    [["sale_ok", "=", true], ["active", "=", true]],
  ]);
  // attach keyword args as 6th param
  return products;
}

// ─── Main Serve ───────────────────────────────────────────────────────────────

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
        result = await handleNewOrder(payload);
        break;
      case "get_products":
        result = await handleGetProducts();
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
