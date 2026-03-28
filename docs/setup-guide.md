# Color of Nature — Setup & Deployment Guide

> Complete reference for setting up the order flow, return flow, wishlist, admin event log, Odoo webhooks, and email notifications.
>
> **Last updated:** 2026-03-28 | **Stack:** React 19 + Supabase + Odoo 16 + Resend

---

## 1. System Architecture

```
                          +-----------------+
                          |   Customer UI   |
                          | (React / Vite)  |
                          +--------+--------+
                                   |
                          Supabase JS Client
                                   |
                 +-----------------+-----------------+
                 |                                   |
        +--------v--------+              +-----------v-----------+
        |   Supabase DB   |              | Supabase Edge Fns     |
        |  (PostgreSQL)   |              |                       |
        |                 |              | confirm-order  (JWT)  |
        | - orders        |              | sync-to-odoo   (JWT)  |
        | - order_items   |              | sync-products  (JWT)  |
        | - return_reqs   |              | admin          (PIN)  |
        | - event_log     |              | odoo-webhook   (open) |
        | - wishlist      |              | proxy-image    (open) |
        | - products      |              +-----+-----+-----------+
        | - variants      |                    |     |
        +--------+--------+                    |     |
                 |                    XML-RPC   |     | HTTP POST
                 |                             |     |
                 |                  +----------v-----v----------+
                 |                  |        Odoo 16            |
                 +------------------+  (Synology NAS)          |
                   stock.quant      |  - sale.order            |
                   product sync     |  - res.partner           |
                                    |  - stock.picking         |
                                    |  - stock.return.picking  |
                                    +--------------------------+
```

---

## 2. Environment Variables & Secrets

### 2A. Frontend (Netlify Environment Variables)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### 2B. Supabase Edge Function Secrets

Set these via `supabase secrets set KEY=VALUE` or in the Supabase dashboard under Edge Functions > Secrets.

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) | `eyJ...` |
| `SUPABASE_ANON_KEY` | Anon key (for internal function calls) | `eyJ...` |
| `ODOO_URL` | Odoo server URL | `http://colnature.synology.me:8069` |
| `ODOO_DB` | Odoo database name | `00_TCON_PRODUCTION` |
| `ODOO_USERNAME` | Odoo API user email | `bhavnindersingh@gmail.com` |
| `ODOO_API_KEY` | Odoo API key (not password) | `55eea0b...` |
| `ODOO_WEB_WAREHOUSE_ID` | Warehouse ID for web orders | `8` |
| `ODOO_WEB_LOCATION_ID` | Stock location ID for web inventory | `74` |
| `ADMIN_PIN` | PIN for admin dashboard access | `123456` |
| `RESEND_API_KEY` | Resend.com API key for emails | `re_...` |
| `RESEND_FROM_EMAIL` | Sender email for notifications | `orders@coloursofnature.com` |
| `ODOO_WEBHOOK_SECRET` | Shared secret for Odoo webhook auth | Any strong random string |

---

## 3. Database Setup

### 3A. Run Migrations

Migrations are in `supabase/migrations/` and run in order:

```bash
# Push all migrations to your remote Supabase project
supabase db push
```

| Migration File | What It Does |
|----------------|-------------|
| `20240225000000_initial_schema.sql` | Core tables: profiles, products, orders, order_items, RLS |
| `20240226000000_ecommerce_extensions.sql` | Addresses, variants, images, wishlist, reviews, payment_intent_id |
| `20240227000000_order_enhancements.sql` | Tracking columns, order_status_history (auto-trigger), return_requests |
| `20260328000000_order_return_enhancements.sql` | Extended return states, event_log table, delivered_at, return_instructions, RLS for customer return shipping |

### 3B. Key Database Tables

| Table | Purpose | Source |
|-------|---------|--------|
| `products` | Product catalog | Synced from Odoo |
| `product_variants` | SKUs, sizes, stock per variant | Synced from Odoo |
| `product_images` | Product images (proxied from Odoo) | Synced from Odoo |
| `orders` | Customer orders | Created in checkout |
| `order_items` | Line items per order | Created in checkout |
| `order_status_history` | Timeline log (auto-trigger on status change) | Auto-populated |
| `return_requests` | Return requests with multi-step lifecycle | Customer + Admin |
| `event_log` | All system events for admin dashboard | Edge functions |
| `addresses` | Saved shipping addresses | Customer input |
| `profiles` | User profile + `odoo_partner_id` | Auth signup + Odoo sync |
| `wishlist_items` | Favourited products | Customer input |
| `product_reviews` | Product reviews (admin-approved) | Customer input |

---

## 4. Edge Functions

### 4A. Function Overview

| Function | Auth | Purpose |
|----------|------|---------|
| `confirm-order` | JWT (user) | Dummy payment confirmation + Odoo sync |
| `sync-to-odoo` | JWT/service | XML-RPC: create orders, cancel, return in Odoo |
| `sync-products` | JWT/service | JSON-RPC: pull products + stock from Odoo |
| `admin` | PIN | Admin operations: orders, returns, tracking, events |
| `odoo-webhook` | Bearer secret | Receives delivery completion webhooks from Odoo |
| `proxy-image` | None | Proxies Odoo product images (hides NAS IP) |

### 4B. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy confirm-order
supabase functions deploy sync-to-odoo
supabase functions deploy sync-products
supabase functions deploy admin
supabase functions deploy odoo-webhook
supabase functions deploy proxy-image
```

---

## 5. Order Flow

```
 Customer                  Supabase                    Odoo
 ───────                   ────────                    ────

 Browse Shop ──────> products table (synced)
    |
 Add to Cart ──────> localStorage
    |
 Checkout
    |
 Select Address ───> addresses table
    |
 "Review & Pay" ───> createOrder()
    |                  orders.insert (status: pending)
    |                  order_items.insert
    |
 Dummy Payment
    |
 "Confirm Payment" ─> confirm-order edge fn
                        |
                        ├─ orders.update (status: paid)
                        ├─ event_log.insert (order.payment_confirmed)
                        |
                        ├─ calls sync-to-odoo ─────────> Odoo:
                        |                                 ├─ res.partner (upsert by email)
                        |                                 ├─ sale.order (create + confirm)
                        |                                 └─ stock reservation triggered
                        |
                        ├─ orders.update (status: processing, odoo_order_id)
                        └─ event_log.insert (order.odoo_synced)

 ... Admin adds tracking ...

 Admin: "Update Tracking" ──> admin fn: update_tracking
                               orders.update (status: shipped, tracking_number)

 ... Odoo delivery completed ...

 Odoo automated action ────────> odoo-webhook edge fn
                                  orders.update (status: delivered, delivered_at)
                                  event_log.insert (webhook.picking_done)
```

### Order Statuses

| Status | Meaning | Set By |
|--------|---------|--------|
| `pending` | Order placed, awaiting payment | Checkout (createOrder) |
| `paid` | Payment confirmed (dummy) | confirm-order edge fn |
| `processing` | Synced to Odoo, being prepared | confirm-order edge fn |
| `shipped` | Tracking added, in transit | Admin (update_tracking) |
| `delivered` | Delivery confirmed | Odoo webhook |
| `cancelled` | Order cancelled | Admin (cancel_order) |

---

## 6. Return Flow

```
 Customer                    Supabase                     Odoo
 ───────                     ────────                     ────

 Account > Orders
 "Request Return" ──> return_requests.insert
                       (status: pending)

 Admin Dashboard
 "Approve & Send Email" ──> admin fn: handle_return (approve)
                             |
                             ├─ return_requests.update (status: approved)
                             ├─ return_instructions saved
                             ├─ Resend API → email to customer
                             └─ event_log.insert (return.approved)

 Customer receives email with instructions
 "I've Shipped the Item" ──> return_requests.update
                              (status: item_shipped)
                              [RLS policy: only from approved]

 Admin Dashboard
 "Mark as Received" ──> admin fn: mark_return_received
                         |
                         ├─ calls sync-to-odoo ──────> Odoo:
                         |    (return_order)             └─ stock.return.picking
                         |                                  (reverse delivery created)
                         |
                         ├─ return_requests.update (status: item_received, odoo_return_id)
                         └─ event_log.insert (return.item_received)

 Admin Dashboard
 "Complete Return" ──> admin fn: complete_return
                        ├─ return_requests.update (status: completed)
                        └─ event_log.insert (return.completed)
```

### Return Statuses

| Status | Meaning | Set By |
|--------|---------|--------|
| `pending` | Customer requested return | Customer (Account page) |
| `approved` | Admin approved, email sent with instructions | Admin |
| `item_shipped` | Customer shipped the item back | Customer ("I've Shipped" button) |
| `item_received` | Admin received item, Odoo return created | Admin ("Mark Received") |
| `completed` | Return fully processed, stock restored | Admin ("Complete Return") |
| `rejected` | Return denied by admin | Admin |

---

## 7. Wishlist / Favourites

- **Database:** `wishlist_items` table (user_id + product_id, with RLS)
- **Shop page:** Heart icon toggles wishlist via `addToWishlist()` / `removeFromWishlist()`
- **Account page:** "Favourites" tab shows all wishlisted products with:
  - Product image, name, category, price
  - "Add to Cart" button (adds to localStorage cart)
  - "Remove" button (deletes from wishlist)

---

## 8. Admin Dashboard

### 8A. Access

- URL: `/admin`
- Auth: PIN-based (stored in `sessionStorage`, validated against `ADMIN_PIN` env var)

### 8B. Tabs

| Tab | Content |
|-----|---------|
| **All Orders** | Complete order list with expand/collapse, inline actions |
| **Failed Syncs** | Orders that failed to sync to Odoo (no `odoo_order_id`) |
| **Active Returns** | Orders with non-completed return requests |
| **Event Log** | Chronological log of all system events with search/filter |

### 8C. Admin Actions

| Action | API Call | Description |
|--------|----------|-------------|
| Update Status | `update_order_status` | Change order status + optional note |
| Add Tracking | `update_tracking` | Set carrier, tracking number, ETA (auto-sets shipped) |
| Push to Odoo | `push_to_odoo` | Manually sync unsynced order to Odoo |
| Cancel Order | `cancel_order` | Cancel in Supabase + Odoo |
| Approve Return | `handle_return` (approve) | Sets approved, sends email with instructions |
| Reject Return | `handle_return` (reject) | Sets rejected with admin note |
| Mark Return Received | `mark_return_received` | Creates Odoo stock return, sets item_received |
| Complete Return | `complete_return` | Final step, sets completed |
| List Events | `list_events` | Query event_log with filters |
| Sync Products | `sync_products` | Trigger product pull from Odoo |

### 8D. Event Log

All actions are logged to the `event_log` table with:
- `event_type`: e.g. `order.status_changed`, `return.approved`, `webhook.picking_done`
- `entity_type`: `order`, `return`, `product_sync`
- `entity_id`: UUID of the order or return
- `details`: JSON payload with action-specific data
- `actor`: `admin`, `customer`, `system`, `odoo_webhook`

---

## 9. Odoo Webhook Setup

The `odoo-webhook` edge function receives delivery completion events from Odoo. You need to create an automated action in Odoo.

### 9A. Create Odoo Automated Action

In Odoo 16, go to **Settings > Technical > Automation > Automated Actions** and create:

| Field | Value |
|-------|-------|
| **Name** | Webhook: Delivery Done to Supabase |
| **Model** | Transfers (stock.picking) |
| **Trigger** | On Update |
| **Before Update Filter** | `[("state", "!=", "done")]` |
| **Apply on** | `[("state", "=", "done"), ("sale_id", "!=", False)]` |
| **Action** | Execute Python Code |

### 9B. Python Code

```python
import requests
import json

WEBHOOK_URL = "https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/odoo-webhook"
WEBHOOK_SECRET = "YOUR_ODOO_WEBHOOK_SECRET_HERE"  # Must match ODOO_WEBHOOK_SECRET env var

for picking in records:
    if picking.state == 'done' and picking.sale_id:
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + WEBHOOK_SECRET,
            }
            payload = {
                "event": "picking_done",
                "picking_id": picking.id,
                "picking_name": picking.name,
                "sale_order_id": picking.sale_id.id,
                "state": picking.state,
                "date_done": str(picking.date_done) if picking.date_done else None,
            }
            requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        except Exception as e:
            # Log but don't block the picking validation
            pass
```

> **Note:** The `requests` library must be available on your Odoo server. It comes pre-installed with standard Odoo. The NAS must be able to reach `*.supabase.co` over HTTPS (outbound port 443).

---

## 10. Email Setup (Resend)

### 10A. Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain (e.g. `coloursofnature.com`)
3. Create an API key
4. Set the API key as a Supabase secret:

```bash
supabase secrets set RESEND_API_KEY=re_your_api_key_here
supabase secrets set RESEND_FROM_EMAIL=orders@coloursofnature.com
```

### 10B. Email Templates

Currently one email is sent:

| Event | Recipient | Content |
|-------|-----------|---------|
| Return approved | Customer | Order ref, return instructions (entered by admin), link to account page |

The email template is in `supabase/functions/_shared/email.ts` (`buildReturnApprovalEmail`).

### 10C. Free Tier Limits

Resend free tier: **100 emails/day**, **3,000 emails/month**. Sufficient for low-to-medium order volume.

---

## 11. Frontend Deployment (Netlify)

```bash
# Build
cd frontend
npm run build    # outputs to dist/

# Netlify auto-deploys from git push
# Build command: cd frontend && npm run build
# Publish directory: frontend/dist
```

Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Netlify's Environment Variables.

---

## 12. File Reference

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/Checkout.tsx` | Multi-step checkout: address > dummy payment > confirm |
| `frontend/src/pages/Account.tsx` | User dashboard: orders, returns, favourites, addresses, profile |
| `frontend/src/pages/Admin.tsx` | Admin panel: orders, returns, tracking, event log |
| `frontend/src/pages/Shop.tsx` | Product listing with wishlist hearts |
| `frontend/src/pages/ProductDetail.tsx` | Product detail with size selection + add to cart |
| `frontend/src/pages/Cart.tsx` | Shopping cart (localStorage) |
| `frontend/src/lib/supabase.ts` | Supabase client + all API functions + types |
| `frontend/src/contexts/AuthContext.tsx` | Auth state provider |

### Supabase Edge Functions

| File | Purpose |
|------|---------|
| `supabase/functions/confirm-order/index.ts` | Dummy payment + Odoo sync |
| `supabase/functions/sync-to-odoo/index.ts` | XML-RPC: create/cancel/return orders in Odoo |
| `supabase/functions/sync-products/index.ts` | JSON-RPC: pull products from Odoo |
| `supabase/functions/admin/index.ts` | Admin API: all order/return/event management |
| `supabase/functions/odoo-webhook/index.ts` | Receives Odoo delivery webhooks |
| `supabase/functions/proxy-image/index.ts` | Image proxy for Odoo (hides NAS IP) |
| `supabase/functions/_shared/email.ts` | Shared Resend email utility |

### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/20240225000000_initial_schema.sql` | Core tables |
| `supabase/migrations/20240226000000_ecommerce_extensions.sql` | Variants, images, wishlist, reviews |
| `supabase/migrations/20240227000000_order_enhancements.sql` | Tracking, status history, returns |
| `supabase/migrations/20260328000000_order_return_enhancements.sql` | Extended returns, event log |
| `supabase/config.toml` | Function configs + local dev settings |

---

## 13. Deployment Checklist

Use this checklist when deploying to production:

- [ ] **Supabase secrets set** — all env vars from Section 2B
- [ ] **Database migrated** — `supabase db push`
- [ ] **Edge functions deployed** — all 6 functions via `supabase functions deploy`
- [ ] **Resend configured** — account created, domain verified, API key set
- [ ] **Odoo automated action created** — webhook fires on delivery completion (Section 9)
- [ ] **Netlify env vars set** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] **Test order flow** — place order, verify in Supabase + Odoo
- [ ] **Test return flow** — request > approve > ship > receive > complete
- [ ] **Test webhook** — complete a delivery in Odoo, verify order status updates
- [ ] **Test admin panel** — all tabs load, event log populates
- [ ] **Test wishlist** — add/remove from shop, view in account favourites
