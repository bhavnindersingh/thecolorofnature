# Color of Nature — System Architecture

> E-commerce website for handcrafted, naturally-dyed clothing & accessories.
> Odoo 16 ERP (self-hosted) • Supabase Backend • React Frontend

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      CUSTOMERS                                  │
│                   (Web Browser)                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │  HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                REACT FRONTEND (Netlify)                         │
│                                                                 │
│  Pages: Home, Shop, ProductDetail, Cart, Account                │
│  Reads: Supabase (products, variants, images, stock)            │
│  Writes: Supabase (orders, addresses, wishlist, reviews)        │
│  Auth: Supabase Auth                                            │
│  Payments: Stripe (future)                                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │  Supabase JS Client
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                SUPABASE (Cloud Backend)                          │
│                                                                 │
│  Database: products, product_variants, product_images,          │
│            orders, order_items, profiles, addresses,             │
│            wishlist_items, product_reviews                       │
│                                                                 │
│  Auth: User signup/login (email, OAuth)                         │
│  Storage: Product images (synced from Odoo)                     │
│  RLS: Row-Level Security per user                               │
│                                                                 │
│  Edge Functions (the bridge to Odoo):                           │
│    ├── sync-products  (Cron: Odoo → Supabase)                  │
│    ├── sync-to-odoo   (Event: Supabase → Odoo sale.order)      │
│    └── sync-return    (Event: Supabase → Odoo return/cancel)   │
└───────────────────────┬─────────────────────────────────────────┘
                        │  XML-RPC over HTTP
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           ODOO 16 (Self-Hosted on Synology NAS)                 │
│           http://colnature.synology.me:8069                     │
│           Database: 00_TCON_PRODUCTION                          │
│                                                                 │
│  Modules: Sales, Inventory, Accounting, Purchase, POS           │
│                                                                 │
│  Source of Truth for:                                            │
│    • Product catalog (product.template + product.product)       │
│    • Stock levels (stock.quant per warehouse)                   │
│    • Sale orders (sale.order + sale.order.line)                 │
│    • Customer records (res.partner)                             │
│    • Invoicing (account.move)                                   │
│    • Deliveries (stock.picking)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow 1: Products & Stock (Odoo → Supabase)

**Direction:** Odoo → Supabase (Scheduled pull, every 15 minutes)
**Trigger:** Cron / scheduled invocation of `sync-products` edge function

```
Odoo                          Edge Function              Supabase
────                          ─────────────              ────────
product.template ──────────→  Map & transform  ───────→  products
product.product  ──────────→  (XML-RPC fetch)  ───────→  product_variants
image_1920       ──────────→  Upload to Storage ──────→  product_images
stock.quant      ──────────→  Filter by WHWE   ───────→  product_variants.stock_quantity
product.category ──────────→  Category name    ───────→  products.category
```

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Stock source | **WHWE warehouse only** (location_id: 74) | Dedicated web warehouse; physical store stock is separate |
| Sync frequency | Every 15 minutes | Acceptable delay for stock; avoids overloading Synology NAS |
| Images | Upload to Supabase Storage | Avoid exposing NAS IP to customers; CDN performance |
| Full/delta sync | Full sync (all products) | 1,090 products is manageable; simpler than tracking `write_date` |

### Odoo → Supabase Field Mapping

| Odoo Field | Odoo Model | → | Supabase Column | Supabase Table |
|---|---|---|---|---|
| `id` | product.template | → | `odoo_product_id` | products |
| `name` | product.template | → | `name` | products |
| `description_sale` | product.template | → | `description` | products |
| `list_price` | product.template | → | `price` | products |
| `categ_id.name` | product.template | → | `category` | products |
| `id` | product.product | → | `odoo_variant_id` | product_variants |
| `default_code` | product.product | → | `sku` | product_variants |
| `image_1920` | product.template | → | `image_url` (Storage) | product_images |
| stock.quant `quantity` @ WHWE | stock.quant | → | `stock_quantity` | product_variants |

---

## Data Flow 2: Sales (Supabase → Odoo)

**Direction:** Supabase → Odoo (Event-driven, on payment confirmation)
**Trigger:** After payment succeeds, frontend calls `sync-to-odoo` edge function

```
Supabase                      Edge Function              Odoo
────────                      ─────────────              ────
orders table  ─────────────→  Read order data  ────────→  res.partner (upsert customer)
order_items   ─────────────→  Map product IDs  ────────→  sale.order (create)
                              Set warehouse=WHWE ──────→  sale.order.line (create per item)
                                                ────────→  sale.order/action_confirm
                                                            │
                                                            ├→ stock.picking (delivery)
                                                            ├→ stock reservation
                                                            └→ invoice ready
```

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Product ID in order lines | `product.product` (variant ID) | Needed for correct SKU/size tracking in Odoo |
| Warehouse | `warehouse_id = 6` (WHWE) | Orders fulfilled from web warehouse |
| Order confirmation | Auto-confirm via `action_confirm` | Triggers inventory reservation immediately |
| Customer mapping | Upsert by email in `res.partner` | Links website users to Odoo customers |

---

## Data Flow 3: Returns & Cancellations (Supabase → Odoo)

**Direction:** Supabase → Odoo (Event-driven, on return request)

```
Supabase                      Edge Function              Odoo
────────                      ─────────────              ────
Order cancel request  ──────→                  ────────→  sale.order/action_cancel
                                                          (if not yet shipped)

Return request  ────────────→  Find delivery   ────────→  stock.return.picking/create
                               (stock.picking)  ────────→  Processes return
                                                          (stock back to WHWE)
```

---

## Warehouse Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Odoo Warehouses                            │
│                                                              │
│  [1] TCoN Main Warehouse (WHTC)     ← Physical main store   │
│  [2] Kuilapalayam Warehouse (WHKU)  ← Physical store        │
│  [3] Upcycled Warehouse (WHUS)      ← Upcycled products     │
│  [4] PopUp Warehouse (WHPO)         ← Pop-up events         │
│  [5] TCoN Consignment (WHCO)        ← Consignment stock     │
│  [6] TCoN Web (WHWE) ◀──────────── THIS ONE FOR WEBSITE     │
│  [7] PY Visitors Center (WHVC)      ← Visitor center        │
└──────────────────────────────────────────────────────────────┘

Website reads stock ONLY from WHWE (location_id: 74)
Website orders create deliveries FROM WHWE
Physical stores use separate warehouses — no conflict
```

---

## Environment Variables

```bash
# Supabase (Frontend — safe for browser)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Odoo (Backend — Supabase Edge Function secrets ONLY)
ODOO_URL=http://colnature.synology.me:8069
ODOO_DB=00_TCON_PRODUCTION
ODOO_USERNAME=bhavnindersingh@gmail.com
ODOO_API_KEY=<api-key>
ODOO_WEB_WAREHOUSE_ID=6
ODOO_WEB_LOCATION_ID=74
```

---

## Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React + Vite + TypeScript | Customer-facing SPA |
| Hosting | Netlify | Static site hosting + CDN |
| Auth | Supabase Auth | User signup/login |
| Database | Supabase (PostgreSQL) | Product cache, orders, users |
| Storage | Supabase Storage | Product images |
| API Bridge | Supabase Edge Functions (Deno) | XML-RPC calls to Odoo |
| ERP | Odoo 16 (Synology NAS) | Inventory, sales, accounting |
| Payments | Stripe (planned) | Online payments |
