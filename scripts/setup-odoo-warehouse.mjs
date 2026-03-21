/**
 * One-time setup script: Create "Online Shop TCON" warehouse in Odoo.
 *
 * Run from the repo root:
 *   node scripts/setup-odoo-warehouse.mjs
 *
 * Reads ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY from .env
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
  if (!fs.existsSync(envPath)) {
    console.error("No .env file found at", envPath);
    process.exit(1);
  }
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

if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error("Missing one of: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY in .env");
  process.exit(1);
}

const SOURCE_WAREHOUSE_ID = 6; // WHWE — replenishment source

// ─── JSON-RPC Helper ──────────────────────────────────────────────────────────
// Uses /jsonrpc endpoint — same auth and execute_kw API as XML-RPC,
// but returns plain JSON so no custom parser is needed.

let _rpcId = 1;

function jsonPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Bad JSON response: " + data.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function jsonrpc(service, method, args) {
  const resp = await jsonPost(`${ODOO_URL}/jsonrpc`, {
    jsonrpc: "2.0",
    method: "call",
    id: _rpcId++,
    params: { service, method, args },
  });
  if (resp.error) throw new Error(`Odoo error: ${JSON.stringify(resp.error)}`);
  return resp.result;
}

async function getUid() {
  const uid = await jsonrpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]);
  if (!uid || typeof uid !== "number") throw new Error("Authentication failed — check credentials in .env");
  return uid;
}

async function execute(uid, model, method, args, kwargs = {}) {
  return jsonrpc("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("Connecting to Odoo:", ODOO_URL, "/ DB:", ODOO_DB);
const uid = await getUid();
console.log("Authenticated. uid:", uid);

// 1. Check if warehouse already exists
const existing = await execute(uid, "stock.warehouse", "search_read",
  [[["name", "=", "Online Shop TCON"]]],
  { fields: ["id", "name"], limit: 1 }
);

let warehouseId;

if (existing.length > 0) {
  warehouseId = existing[0].id;
  console.log(`\nWarehouse already exists (ID: ${warehouseId}). Fetching stock location...`);
} else {
  // 2. Create the warehouse
  console.log("\nCreating warehouse 'Online Shop TCON' (code: OSTCON)...");
  warehouseId = await execute(uid, "stock.warehouse", "create", [{
    name: "Online Shop TCON",
    code: "OSTCON",
  }]);
  console.log("  Warehouse created. ID:", warehouseId);

  // 3. Enable resupply from WHWE (ID 6)
  console.log(`\nLinking resupply from WHWE (ID ${SOURCE_WAREHOUSE_ID})...`);
  await execute(uid, "stock.warehouse", "write", [
    [warehouseId],
    { resupply_wh_ids: [[4, SOURCE_WAREHOUSE_ID]] },
  ]);
  console.log("  Replenishment route created by Odoo.");
}

// 4. Find the internal stock location for OSTCON
const locations = await execute(uid, "stock.location", "search_read",
  [[["complete_name", "ilike", "OSTCON"], ["usage", "=", "internal"]]],
  { fields: ["id", "complete_name"], limit: 5 }
);

if (!locations || locations.length === 0) {
  console.error("\nCould not find OSTCON internal stock location.");
  console.error("Check Odoo UI: Inventory → Configuration → Locations, search OSTCON.");
  console.error(`  ODOO_WEB_WAREHOUSE_ID=${warehouseId}  (location ID unknown)`);
  process.exit(1);
}

const loc = locations[0];

// 5. Print results
console.log("\n========================================");
console.log("SUCCESS — Online Shop TCON warehouse ready");
console.log("========================================");
console.log(`  Warehouse ID : ${warehouseId}`);
console.log(`  Location     : ${loc.complete_name}  (ID: ${loc.id})`);
console.log("\nUpdate your .env with:");
console.log(`  ODOO_WEB_WAREHOUSE_ID=${warehouseId}`);
console.log(`  ODOO_WEB_LOCATION_ID=${loc.id}`);
console.log("\nNext steps in Odoo UI:");
console.log("  1. Inventory → Replenishment → Reordering Rules");
console.log(`     Add a min/max rule per product at location: ${loc.complete_name}`);
console.log("  2. Redeploy Supabase edge functions to pick up the new env vars.");
