/**
 * Setup script: "Online Shop" tag + OSTCON reorder rules
 *
 * Run from repo root:
 *   node scripts/setup-ostcon-tag-and-rules.mjs
 *
 * What it does:
 *   1. Creates the "Online Shop" product tag in Odoo (if not present)
 *   2. Finds all products with that tag
 *   3. Finds the WHWE→OSTCON replenishment route
 *   4. Creates reorder rules at OSTCON/Stock for each tagged variant
 *
 * Safe to re-run — skips existing rules.
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) { console.error("No .env found at", envPath); process.exit(1); }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const ODOO_URL      = process.env.ODOO_URL;
const ODOO_DB       = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY  = process.env.ODOO_API_KEY;
const OSTCON_LOCATION_ID = 92; // OSTCON/Stock
const WHWE_LOCATION_ID   = 74; // WHWE/Stock (for finding available stock)

// ─── JSON-RPC helpers (same as setup-odoo-warehouse.mjs) ─────────────────────

let _rpcId = 1;

function jsonPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Bad JSON: " + data.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function jsonrpc(service, method, args) {
  const resp = await jsonPost(`${ODOO_URL}/jsonrpc`, {
    jsonrpc: "2.0", method: "call", id: _rpcId++,
    params: { service, method, args },
  });
  if (resp.error) throw new Error(`Odoo: ${JSON.stringify(resp.error)}`);
  return resp.result;
}

async function getUid() {
  const uid = await jsonrpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
  if (!uid || typeof uid !== "number") throw new Error("Auth failed");
  return uid;
}

async function x(uid, model, method, args, kwargs = {}) {
  return jsonrpc("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("Connecting to Odoo:", ODOO_URL);
const uid = await getUid();
console.log("Authenticated. uid:", uid);

// ── 1. Find or create "Online Shop" product tag ───────────────────────────────
console.log('\n[1] Looking for "Online Shop" product tag...');
let tags = await x(uid, "product.tag", "search_read",
  [[["name", "=", "Online Shop"]]],
  { fields: ["id", "name"], limit: 1 }
);

let tagId;
if (tags.length > 0) {
  tagId = tags[0].id;
  console.log(`    Found existing tag. ID: ${tagId}`);
} else {
  tagId = await x(uid, "product.tag", "create", [{ name: "Online Shop" }]);
  console.log(`    Created new tag "Online Shop". ID: ${tagId}`);
}

console.log(`
    ┌─────────────────────────────────────────────────────────────────┐
    │  HOW TO TAG PRODUCTS IN ODOO                                    │
    │                                                                 │
    │  1. Go to: Odoo → Inventory or Sales → Products                │
    │  2. Open any product you want in the online store              │
    │  3. In the product form → "General Information" tab            │
    │     → "Tags" field → add "Online Shop"                         │
    │  4. Save the product                                           │
    │  5. Re-run this script to create reorder rules automatically   │
    └─────────────────────────────────────────────────────────────────┘
`);

// ── 2. Find tagged products ───────────────────────────────────────────────────
console.log('[2] Finding products tagged "Online Shop"...');
const taggedTemplates = await x(uid, "product.template", "search_read",
  [[["tag_ids", "in", [tagId]], ["active", "=", true]]],
  { fields: ["id", "name", "product_variant_ids"] }
);
console.log(`    Found ${taggedTemplates.length} tagged products.`);

if (taggedTemplates.length === 0) {
  console.log("\n    No products tagged yet. Tag products in Odoo first, then re-run this script.");
  process.exit(0);
}

taggedTemplates.forEach((t, i) => {
  console.log(`    ${i + 1}. [${t.id}] ${t.name}  (${t.product_variant_ids.length} variant(s))`);
});

// ── 3. Find WHWE→OSTCON replenishment route ───────────────────────────────────
console.log("\n[3] Finding OSTCON replenishment route...");
const routes = await x(uid, "stock.route", "search_read",
  [[["name", "ilike", "OSTCON"]]],
  { fields: ["id", "name"] }
);

let routeId = null;
if (routes.length > 0) {
  routeId = routes[0].id;
  console.log(`    Route: "${routes[0].name}" (ID: ${routeId})`);
} else {
  console.log("    WARNING: No OSTCON route found. Reorder rules will be created without a route.");
  console.log("    In Odoo: Inventory → Configuration → Warehouses → OSTCON → check 'Resupply from WHWE'");
}

// ── 4. Collect all variant IDs from tagged templates ─────────────────────────
const allVariantIds = taggedTemplates.flatMap(t => t.product_variant_ids);
console.log(`\n[4] Fetching ${allVariantIds.length} variants for tagged products...`);

const variants = await x(uid, "product.product", "search_read",
  [[["id", "in", allVariantIds], ["active", "=", true]]],
  { fields: ["id", "name", "default_code"] }
);
console.log(`    Fetched ${variants.length} active variants.`);

// ── 5. Find existing reorder rules at OSTCON/Stock ───────────────────────────
console.log("\n[5] Checking existing reorder rules at OSTCON/Stock...");
const existingRules = await x(uid, "stock.warehouse.orderpoint", "search_read",
  [[["location_id", "=", OSTCON_LOCATION_ID]]],
  { fields: ["id", "product_id"] }
);
const existingVariantIds = new Set(existingRules.map(r => r.product_id[0]));
console.log(`    ${existingRules.length} rules already exist at OSTCON/Stock.`);

// ── 6. Create reorder rules for variants that don't have one ─────────────────
const toCreate = variants.filter(v => !existingVariantIds.has(v.id));
console.log(`\n[6] Creating reorder rules for ${toCreate.length} new variants...`);

let created = 0;
let failed = 0;
for (const v of toCreate) {
  try {
    const rule = {
      product_id: v.id,
      location_id: OSTCON_LOCATION_ID,
      product_min_qty: 1,
      product_max_qty: 5,
    };
    if (routeId) rule.route_id = routeId;
    await x(uid, "stock.warehouse.orderpoint", "create", [rule]);
    created++;
    console.log(`    ✓ [${v.id}] ${v.name}${v.default_code ? ' (' + v.default_code + ')' : ''}`);
  } catch (e) {
    failed++;
    console.error(`    ✗ [${v.id}] ${v.name} — ${e.message}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n========================================");
console.log("DONE");
console.log("========================================");
console.log(`  Tag "Online Shop"  : ID ${tagId}`);
console.log(`  Tagged products    : ${taggedTemplates.length}`);
console.log(`  Variants total     : ${variants.length}`);
console.log(`  Rules already existed : ${existingRules.length}`);
console.log(`  Rules created      : ${created}`);
if (failed > 0) console.log(`  Rules failed       : ${failed}`);
console.log(`\nNext steps:`);
console.log(`  1. In Odoo: validate replenishment transfers (Inventory → Transfers)`);
console.log(`     to move stock from WHWE into OSTCON/Stock`);
console.log(`  2. Redeploy sync-products edge function:`);
console.log(`     npx supabase functions deploy sync-products`);
console.log(`  3. Trigger a product sync to refresh the website catalogue.`);
