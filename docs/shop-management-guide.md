# The Colours of Nature — Shop Management Guide

**Last updated:** March 2026
**Stack:** Odoo 17 → Supabase (PostgreSQL + Edge Functions) → React (Netlify CDN)

---

## System Architecture

```
ODOO 16 (colnature.synology.me:8069)
  │
  │  product sync (every 30 min, automatic)
  ▼
SUPABASE PostgreSQL  ◄──────────────────────────────────
  │                                                     │
  │  reads products                          order/return sync (on action)
  ▼                                                     │
REACT FRONTEND (Netlify)  ──── customer places order ───┘
```

**Rule of thumb:**
- Products flow **Odoo → website** (automatic, every 30 min)
- Orders flow **website → Odoo** (on checkout, instant)
- Returns are **initiated on website**, processed in Odoo by ops team
- Stock is read from **WHWE/Stock (location 74)** in Odoo

---

## Part 1: ODOO — Operations Team Guide

### 1A. Adding Products to the Website

Only products tagged **"Online Shop"** in Odoo appear on the website.

**Steps to add a product to the website:**
1. Go to **Odoo → Inventory (or Sales) → Products**
2. Open the product you want to sell online
3. Go to the **General Information** tab
4. In the **Tags** field, add the tag **"Online Shop"**
5. Click **Save**
6. Wait up to 30 minutes — the sync runs automatically

> The website will show the product on the next sync cycle (or trigger a manual sync — see Section 4B).

**Product info that syncs to website:**
- Product name
- Sale price (`list_price`)
- Description (`description_sale` field)
- Category (leaf of the Odoo category path, e.g. "Bags")
- All variants (size, SKU)
- Stock availability (based on WHWE/Stock quantity)
- Product image (served directly from Odoo)

**To remove a product from the website:**
- Remove the **"Online Shop"** tag from the product in Odoo
- It will be marked out-of-stock on the next sync (it is not deleted from the database, just hidden)

---

### 1B. Stock Management

Stock shown on the website is read from **WHWE / Stock (Odoo location ID 74)**.

**To check stock levels:**
- Odoo → Inventory → Products → select product → **"On Hand"** button
- Filter by location: WHWE/Stock

**Stock shows "Out of Stock" on website when:**
- The product has zero `quantity` in stock.quant at WHWE/Stock
- Or the product has no variants

**To update stock:**
- Receive goods into WHWE/Stock through a Purchase Order or Internal Transfer
- Stock updates on the website at the next sync (up to 30 min)

---

### 1C. New Web Orders — What to Do

When a customer places an order on the website:

1. A **Sale Order (SO)** is automatically created in Odoo
   - Warehouse: **OSTCON** (Online Shop TCON, ID 8)
   - Client Order Reference: the Supabase order UUID (e.g. `3f8a1b2c-...`)
   - Customer: created/matched by email in `res.partner`

2. Odoo automatically creates a **Delivery Order** (stock.picking, type = OUT)

**Daily check:**
- **Odoo → Inventory → Transfers** — filter by OSTCON, state = Ready
- All ready deliveries are web orders waiting to be packed and dispatched

**To dispatch an order:**
1. Open the delivery order in Odoo → Inventory → Transfers
2. Check the items match the customer's order
3. Pack the items
4. Click **Validate** → this confirms dispatch in Odoo
   - Stock is deducted from WHWE/Stock
   - Accounting entries are booked automatically
5. Enter the **Tracking Number** and **Carrier** on the delivery (optional but recommended)

> After dispatch, update the order status in Supabase (see Section 3B) so the customer sees "Shipped" in their account.

---

### 1D. Order Cancellation

**When the customer requests a cancellation:**

- Only possible if the SO is in **Draft** or **Sale** state (not yet delivered)
- The website's cancel function calls Odoo automatically if the customer cancels before dispatch
- If cancelled in Odoo manually:
  1. Open the Sale Order in Odoo → Sales → Orders
  2. Click **Action → Cancel**
  3. Stock reservation is released, delivery order cancelled
  4. Odoo reverses all accounting entries

> If the order has already been delivered (picking state = Done), cancellation is not possible — use the **Return** workflow instead.

---

### 1E. Returns Workflow

**Step 1 — Customer Initiates Return (Website)**
- Customer goes to **Account → Orders** on the website
- Clicks **Request Return** on an eligible order (status: Shipped or Delivered)
- Enters a reason
- Return request saved in Supabase with status = `pending`

**Step 2 — Ops Team Reviews (Supabase)**
- Check Supabase → Table Editor → `return_requests` table
- Filter: `status = pending`
- Review: order reference, reason, items

**Step 3 — Process Return in Odoo**
1. Go to **Odoo → Inventory → Transfers**
2. Find the original Delivery Order (search by Customer or SO reference)
3. Click **Return** button on the delivery
4. Select items to return (full or partial)
5. Click **Return** → creates a **Receipt** (return picking, type = IN)
6. When goods are physically received, open the receipt → click **Validate**
7. Stock comes back into WHWE/Stock

**Step 4 — Issue Credit Note / Refund**
- Go to **Odoo → Accounting → Customers → Credit Notes → New**
- Link to the original invoice
- Issue the credit note
- Refund to customer via Razorpay dashboard or bank transfer (manual)

**Step 5 — Update Return Status (Supabase)**
- Go to Supabase → Table Editor → `return_requests`
- Update the row: set `status = completed` (or `approved` / `rejected` as appropriate)
- Add an `admin_note` if needed (visible to the customer on the website)

---

### 1F. What to Check Every Day

| Location | What to check | Action |
|----------|---------------|--------|
| Odoo → Inventory → Transfers | Delivery orders in "Ready" state | Pack and validate (dispatch) |
| Odoo → Sales → Orders | New Sale Orders from website | Confirm receipt, check items |
| Supabase → return_requests (status = pending) | New return requests | Process in Odoo, update status |
| Website → Shop page | Product stock accuracy | Trigger manual sync if needed |

---

## Part 2: WEB APP — Customer Experience

### What customers can do

**Shopping**
- Browse the full product catalogue (products tagged "Online Shop" in Odoo)
- Filter by category (Bags, Dresses, etc.)
- View product detail pages with size variants, description, price
- See real-time stock availability (in-stock / out-of-stock per variant)
- Add items to cart (persists in browser localStorage)

**Cart & Checkout**
- View cart with quantity controls
- Free shipping on orders over ₹999, otherwise ₹99 flat
- Checkout: enter delivery address (or select saved address)
- Place order → order is created in Supabase and simultaneously synced to Odoo

**Account (requires email sign-in)**

| Tab | What it does |
|-----|-------------|
| Orders | View all past orders, status, tracking info, items |
| Returns | Submit return request, track return status |
| Addresses | Add/edit/delete delivery addresses, set default |
| Profile | Update name, phone number |

**Authentication**
- Register with email + password
- Sign in with email + password
- Forgot password → reset via email link
- Email confirmation on sign-up (Supabase sends the email)

> Google OAuth has been removed. Authentication is fully self-managed via Supabase.

---

### Order status flow (what customers see)

```
pending → processing → shipped → delivered
                    ↘ cancelled
```

| Status | Meaning |
|--------|---------|
| pending | Order placed, not yet confirmed in Odoo |
| processing | Order confirmed in Odoo, being prepared |
| shipped | Dispatched — tracking number available |
| delivered | Delivery confirmed |
| cancelled | Order cancelled (before dispatch) |

---

### Return status flow (what customers see)

```
pending → approved → completed
        ↘ rejected
```

---

## Part 3: TECHNICAL REFERENCE

### 3A. Edge Functions

#### `sync-products`
**Trigger:** Automatic every 30 minutes (pg_cron)
**Also:** Manual — POST to `https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/sync-products`

**What it does:**
1. Authenticates with Odoo (JSON-RPC)
2. Finds tag ID for "Online Shop" in Odoo
3. Fetches all `product.template` records with that tag (`sale_ok = true`, `active = true`)
4. Fetches all `product.product` variants for those templates
5. Reads stock quantities from `stock.quant` at WHWE/Stock (location 74)
6. Upserts into Supabase tables: `products`, `product_variants`, `product_images`
7. Marks products no longer in Odoo as `in_stock = false`

**Manual sync command:**
```bash
source .env && curl -X POST \
  https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/sync-products \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

#### `sync-to-odoo`
**Trigger:** Called by frontend on specific customer actions

**Actions:**

| Action | When called | What it does in Odoo |
|--------|-------------|---------------------|
| `sync_order` | Customer places order | Creates `res.partner` (if new), creates `sale.order` + `sale.order.line`, confirms SO |
| `cancel_order` | Customer cancels (before dispatch) | Calls `action_cancel` on the SO — releases stock reservation |
| `return_order` | Customer submits return | Creates `stock.return.picking` from completed delivery, generates return receipt |

---

### 3B. Supabase Database Tables

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `products` | Odoo product cache | `odoo_product_id`, `name`, `price`, `category`, `in_stock` |
| `product_variants` | Per-variant data | `odoo_variant_id`, `sku`, `size`, `stock_quantity` |
| `product_images` | Product image URLs | `product_id`, `image_url`, `is_primary` |
| `orders` | Customer orders | `status`, `total_amount`, `odoo_order_id`, `tracking_number`, `carrier` |
| `order_items` | Line items per order | `product_id`, `quantity`, `unit_price` |
| `order_status_history` | Audit trail | `order_id`, `status`, `note`, `changed_by` |
| `return_requests` | Return requests | `order_id`, `reason`, `status`, `admin_note`, `odoo_return_id` |
| `addresses` | Customer addresses | `user_id`, `address_line_1`, `city`, `postal_code`, `is_default` |
| `profiles` | Customer profiles | `user_id`, `full_name`, `phone`, `odoo_partner_id` |

**To update order status manually (Supabase Table Editor):**
1. Go to [https://supabase.com/dashboard/project/kfcppshcibxhayduqbzv](https://supabase.com/dashboard/project/kfcppshcibxhayduqbzv)
2. Table Editor → `orders`
3. Find the row by `odoo_order_id` or `id`
4. Update: `status`, `tracking_number`, `carrier`, `estimated_delivery`

---

### 3C. Key Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| Odoo URL | `http://colnature.synology.me:8069` | Odoo instance |
| Odoo DB | `00_TCON_PRODUCTION` | Production database |
| WHWE Warehouse ID | 6 | Main physical warehouse |
| WHWE Stock Location | 74 | Stock location (used for stock reads) |
| OSTCON Warehouse ID | 8 | Online Shop TCON (used for sale orders) |
| Supabase project | `kfcppshcibxhayduqbzv` | Database + edge functions |

---

## Part 4: KNOWN LIMITATIONS & NEXT STEPS

| Issue | Current workaround | Future fix |
|-------|-------------------|------------|
| No payment gateway | Orders placed, payment collected offline (COD / bank transfer) | Integrate Razorpay |
| Order status not auto-updated from Odoo | Ops team updates manually in Supabase Table Editor | Build webhook or sync-back function |
| Return status not auto-updated from Odoo | Ops team updates manually in Supabase Table Editor | Build admin panel or Odoo webhook |
| Tracking number entry | Enter in Supabase Table Editor after dispatch | Build admin panel for ops team |
| Credit notes | Created manually in Odoo Accounting | Automate via edge function |
| Duplicate SKU variants | Some variants share SKU in Odoo (sync skips them) | Clean up SKUs in Odoo |

---

## Part 5: QUICK REFERENCE — DAILY OPS CHECKLIST

```
Morning:
  [ ] Odoo → Inventory → Transfers → validate any "Ready" deliveries
  [ ] Odoo → Sales → Orders → check for new web orders
  [ ] Supabase → return_requests → handle any "pending" returns

After dispatch:
  [ ] Update order status in Supabase: status = "shipped"
  [ ] Enter tracking_number + carrier in Supabase orders table

When return goods received:
  [ ] Validate return picking in Odoo
  [ ] Create credit note in Odoo Accounting
  [ ] Update return_requests status = "completed" in Supabase

Weekly:
  [ ] Check website for any products showing wrong stock
  [ ] Trigger a manual sync if needed
```
