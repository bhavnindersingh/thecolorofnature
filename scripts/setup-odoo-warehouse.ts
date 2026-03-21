/**
 * One-time setup script: Create "Online Shop TCON" warehouse in Odoo.
 *
 * Run from the repo root:
 *   deno run --allow-net --allow-env --allow-read scripts/setup-odoo-warehouse.ts
 *
 * Reads ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY from .env
 * (or export them as shell env vars before running).
 */

import { load } from "https://deno.land/std@0.210.0/dotenv/mod.ts";

// Load .env from repo root
await load({ export: true, envPath: ".env" });

const ODOO_URL      = Deno.env.get("ODOO_URL")!;
const ODOO_DB       = Deno.env.get("ODOO_DB")!;
const ODOO_USERNAME = Deno.env.get("ODOO_USERNAME")!;
const ODOO_API_KEY  = Deno.env.get("ODOO_API_KEY")!;

const SOURCE_WAREHOUSE_ID = 6; // WHWE — replenishment source

// ─── XML-RPC (copied from existing edge functions) ────────────────────────────

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

  const resp = await fetch(`${ODOO_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });
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
    while ((vm = valueRegex.exec(m[1])) !== null) values.push(parseXmlValue(vm[1].trim()));
    return values;
  }
  m = xml.match(/^<struct>([\s\S]*?)<\/struct>$/);
  if (m) {
    const obj: Record<string, unknown> = {};
    const memberRegex = /<member>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let mm;
    while ((mm = memberRegex.exec(m[1])) !== null) obj[mm[1].trim()] = parseXmlValue(mm[2].trim());
    return obj;
  }
  return xml;
}

async function getUid(): Promise<number> {
  const uid = await xmlrpcCall("/xmlrpc/2/common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
  if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
  return uid;
}

async function execute(uid: number, model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>): Promise<unknown> {
  const params: unknown[] = [ODOO_DB, uid, ODOO_API_KEY, model, method, args];
  if (kwargs) params.push(kwargs);
  return xmlrpcCall("/xmlrpc/2/object", "execute_kw", params);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("Connecting to Odoo:", ODOO_URL, "DB:", ODOO_DB);
const uid = await getUid();
console.log("Authenticated as uid:", uid);

// 1. Check if warehouse already exists
const existing = await execute(uid, "stock.warehouse", "search_read",
  [[["name", "=", "Online Shop TCON"]]],
  { fields: ["id", "name", "lot_stock_id"], limit: 1 }
) as Array<{ id: number; name: string; lot_stock_id: [number, string] }>;

if (existing.length > 0) {
  const wh = existing[0];
  console.log("\nWarehouse already exists!");
  console.log(`  Warehouse ID : ${wh.id}`);
  console.log(`  Location ID  : ${wh.lot_stock_id[0]}  (${wh.lot_stock_id[1]})`);
  console.log("\nPaste into .env:");
  console.log(`  ODOO_WEB_WAREHOUSE_ID=${wh.id}`);
  console.log(`  ODOO_WEB_LOCATION_ID=${wh.lot_stock_id[0]}`);
  Deno.exit(0);
}

// 2. Create the warehouse
console.log("\nCreating warehouse 'Online Shop TCON' (code: OSTCON)...");
const warehouseId = await execute(uid, "stock.warehouse", "create", [{
  name: "Online Shop TCON",
  code: "OSTCON",
}]) as number;
console.log("  Created warehouse ID:", warehouseId);

// 3. Enable resupply from WHWE (ID 6)
// This makes Odoo auto-create the replenishment route + pull rule
console.log(`\nLinking resupply from WHWE (ID ${SOURCE_WAREHOUSE_ID})...`);
await execute(uid, "stock.warehouse", "write", [
  [warehouseId],
  { resupply_wh_ids: [[4, SOURCE_WAREHOUSE_ID]] },
]);
console.log("  Resupply route created.");

// 4. Read back the internal stock location
const warehouseData = await execute(uid, "stock.warehouse", "read",
  [[warehouseId]],
  { fields: ["id", "name", "lot_stock_id"] }
) as Array<{ id: number; name: string; lot_stock_id: [number, string] }>;

const wh = warehouseData[0];
const locationId = wh.lot_stock_id[0];
const locationName = wh.lot_stock_id[1];

// 5. Print results
console.log("\n========================================");
console.log("SUCCESS — Online Shop TCON warehouse ready");
console.log("========================================");
console.log(`  Warehouse : ${wh.name}  (ID: ${wh.id})`);
console.log(`  Location  : ${locationName}  (ID: ${locationId})`);
console.log("\nUpdate your .env with:");
console.log(`  ODOO_WEB_WAREHOUSE_ID=${wh.id}`);
console.log(`  ODOO_WEB_LOCATION_ID=${locationId}`);
console.log("\nNext steps in Odoo UI:");
console.log("  1. Inventory → Replenishment → Reordering Rules");
console.log("     Add a min/max rule per product for location:", locationName);
console.log("  2. Redeploy Supabase edge functions so they pick up the new env vars.");
