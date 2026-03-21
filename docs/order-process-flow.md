# Order Process Flow — The Colours of Nature

**Last updated:** March 2026
**Stack:** Odoo 17 → Supabase Edge Functions → React Frontend (Netlify)

---

## Architecture Overview

```
Customer (Browser)
      │
      ▼
React Frontend (Netlify CDN)
      │  reads products from
      ▼
Supabase PostgreSQL (product catalogue cache)
      │  orders/returns/cancels via
      ▼
Supabase Edge Functions (Deno)
      │  XML-RPC
      ▼
Odoo 17 — 00_TCON_PRODUCTION
(colnature.synology.me:8069)
```

---

## 1. Where Products Come From

**Source:** Odoo `product.template` — all records where `sale_ok = true` AND `active = true`.
**Total as of last sync:** 1,089 products / 2,278 variants.

### Sync Function: `sync-products`
Triggered manually (HTTP POST) or scheduled. Runs in 6 steps:

| Step | What happens |
|------|-------------|
| 1 | Fetch all saleable `product.template` records from Odoo in batches of 50 |
| 2 | Fetch all `product.product` (variant) records for those templates |
| 3 | Read stock quantities from `stock.quant` at **OSTCON/Stock (location_id: 92)** |
| 4 | Build variant → template lookup map |
| 5 | Upsert into Supabase `products` + `product_variants` + `product_images` tables |
| 6 | Mark products absent from Odoo as `in_stock = false` |

### Stock Status
- `in_stock = true` only if at least one variant has `stock_quantity > 0` at **OSTCON/Stock (ID: 92)**
- Product images are served directly from Odoo: `{ODOO_URL}/web/image/product.template/{id}/image_1920`

> **⚠️ Current state:** OSTCON/Stock has 0 products with stock. All products show as out of stock until you either move stock into the warehouse or set up reordering rules in Odoo.

### How to trigger a sync
```
POST https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/sync-products
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
Body: {}
```

---

## 2. Warehouse Configuration

| Warehouse | Odoo ID | Location ID | Purpose |
|-----------|---------|-------------|---------|
| WHWE | 6 | 74 | Main/source warehouse |
| Online Shop TCON (OSTCON) | 8 | 92 | Dedicated web shop warehouse |

**Replenishment:** OSTCON is configured to resupply from WHWE automatically when reordering rules trigger.

### Setting up stock for the online shop
In Odoo: **Inventory → Replenishment → Reordering Rules → New**
- Product: select the product
- Location: `OSTCON/Stock`
- Min Qty: e.g. 2
- Max Qty: e.g. 10
- Route: "Online Shop TCON: Resupply Online Shop TCON from WHWE"

Odoo will create an internal transfer from WHWE → OSTCON/Stock when stock drops below Min.

---

## 3. Customer Places an Order

### Frontend flow
1. Customer browses products (loaded from Supabase cache)
2. Adds items to cart (stored in `localStorage`)
3. Proceeds to checkout — enters name, email, phone, address
4. Pays (payment handled separately / Razorpay / COD)
5. On payment success, frontend calls `sync-to-odoo` edge function with action `sync_order`

### `sync-to-odoo` → `sync_order` action

**Payload:**
```json
{
  "action": "sync_order",
  "payload": {
    "supabase_order_id": "uuid-from-supabase",
    "customer_email": "customer@example.com",
    "customer_name": "Customer Name",
    "customer_phone": "+91XXXXXXXXXX",
    "items": [
      { "odoo_variant_id": 1234, "quantity": 1, "price": 2000 }
    ]
  }
}
```

**What happens in Odoo:**

| Step | Odoo action | Result |
|------|-------------|--------|
| 1 | Search `res.partner` by email | Find or create customer record |
| 2 | Create `sale.order` | New SO with `warehouse_id = 8` (OSTCON), `client_order_ref = supabase_order_id` |
| 3 | Create `sale.order.line` per item | Line with `product_id` (variant), `product_uom_qty`, `price_unit` |
| 4 | `action_confirm` on the SO | SO moves to "Sale" state → stock reservation triggered → delivery order created |

**Response:**
```json
{ "success": true, "odoo_order_id": 12345, "partner_id": 6789 }
```

### Accounting entries created automatically by Odoo on confirmation
- Deferred revenue / receivable entries (depending on Odoo accounting config)
- Stock valuation entries (if using perpetual inventory)
- Customer record tagged as `customer_rank = 1`

---

## 4. Delivery

Handled entirely in Odoo by warehouse staff:

1. Odoo creates a **Delivery Order** (stock.picking, type = OUT) for OSTCON
2. Staff validates the picking in Odoo → stock moves from OSTCON/Stock to customer
3. Odoo automatically books:
   - `stock.move` (OSTCON/Stock → Customers)
   - COGS journal entry (if standard/average cost valuation)
   - Revenue recognition

---

## 5. Order Cancellation

### When: order confirmed but not yet delivered

Frontend/admin calls `sync-to-odoo` with action `cancel_order`:

```json
{ "action": "cancel_order", "payload": { "odoo_order_id": 12345 } }
```

**What happens:**
- Checks SO state — must be `draft` or `sale` (not `done`)
- Calls `action_cancel` on the SO
- Stock reservation is released
- Delivery order is cancelled
- Odoo reverses any accounting entries

---

## 6. Returns / Refunds

### When: order delivered (picking state = done)

Frontend/admin calls `sync-to-odoo` with action `return_order`:

```json
{
  "action": "return_order",
  "payload": {
    "odoo_order_id": 12345,
    "items": [
      { "odoo_variant_id": 1234, "quantity": 1 }
    ]
  }
}
```

**What happens in Odoo:**
1. Finds the completed delivery (stock.picking where `sale_id = odoo_order_id`, `state = done`)
2. Creates a `stock.return.picking` wizard linked to that picking
3. Calls `create_returns` — generates a **Return Picking** (stock.picking, type = IN)
4. Stock comes back into OSTCON/Stock
5. Staff validates the return picking in Odoo
6. Odoo creates:
   - Reverse stock move (Customers → OSTCON/Stock)
   - Credit note / reverse journal entry on the original invoice

> **Note:** Refund to customer payment must be handled separately (Razorpay dashboard / manual).

---

## 7. Data Flow Summary

```
ODOO                          SUPABASE                    FRONTEND
─────                         ────────                    ────────
product.template  ──sync──►  products table  ──read──►  Shop page
product.product   ──sync──►  product_variants           Product cards
stock.quant       ──sync──►  stock_quantity             In-stock badge

                              orders table   ◄──write──  Checkout
                                  │
                              sync-to-odoo ──────────►  sale.order
                                                         res.partner
                                                         sale.order.line
                                                         [auto] stock.picking
                                                         [auto] account.move
```

---

## 8. Key IDs & Secrets

| Variable | Value | Purpose |
|----------|-------|---------|
| `ODOO_WEB_WAREHOUSE_ID` | 8 | Online Shop TCON — used when creating sale orders |
| `ODOO_WEB_LOCATION_ID` | 92 | OSTCON/Stock — used for stock quantity sync |
| Supabase project ref | `kfcppshcibxhayduqbzv` | Edge functions + DB |

---

## 9. Known Issues / Next Actions

| Issue | Action needed |
|-------|---------------|
| 0 products have stock at OSTCON/Stock | Set up reordering rules per product in Odoo, then move stock from WHWE |
| Variant SKU uniqueness error on sync | Some product variants share the same SKU in Odoo — deduplicate in Odoo or remove the unique constraint in Supabase |
| No scheduled sync | Set up a Supabase cron job or external scheduler to call `sync-products` daily |
| Return creates picking but no credit note | Credit note must be created manually in Odoo after return picking is validated |
