# Color of Nature — System Architecture

Last updated: 2026-04-04

---

## Overview

Headless ecommerce stack. Customers browse and buy on a React web app. All inventory, accounting, and fulfillment is managed in Odoo 16 ERP via admin panel. Supabase sits in the middle as the middleware layer (auth, database, edge functions, sync).

---

## Stack

| Layer | Technology | Hosted at |
|-------|-----------|-----------|
| Frontend | React 19 + Vite 7, TypeScript, React Router 7, React Query 5 | Netlify (auto-deploy on git push) |
| Middleware DB | Supabase PostgreSQL 17 | Supabase cloud (free tier) |
| Middleware Auth | Supabase Auth (JWT, email/password) | Supabase cloud |
| Middleware Functions | Deno edge functions (serverless) | Supabase cloud |
| Middleware Storage | Supabase Storage (S3-compatible) | Supabase cloud |
| Scheduled Jobs | pg_cron (native Postgres, free) | Supabase cloud |
| ERP | Odoo 16 Community | Self-hosted, Synology NAS (`colnature.synology.me:8069`) |
| Email | Resend API | Cloud |
| Address Autocomplete | OpenStreetMap Nominatim | Public API (no key, 1 req/s) |

---

## Implementation Status (as of 2026-04-04)

### ✅ Completed

| Area | What was built |
|------|---------------|
| **Supabase Auth** | Email/password auth, PKCE-compatible password reset, custom email templates via Resend |
| **All edge functions deployed** | confirm-order, cancel-order, sync-to-odoo, sync-products, odoo-poll, admin, send-auth-email |
| **pg_cron automated sync** | `odoo-poll-30min` cron runs every 30 min — polls deliveries, cancellations, stock, triggers product sync |
| **ODOO_WEBHOOK_SECRET** | Generated and set in Supabase secrets; hardcoded in cron migration (`ALTER DATABASE` blocked on free tier) |
| **Cron migration applied** | `20260404000002_fix_cron_secret.sql` pushed — cron confirmed in `cron.job` table |
| **Redundant cron removed** | Old `sync-products-30min` cron unscheduled (its work is covered by odoo-poll) |
| **GitHub Actions cron removed** | `.github/workflows/odoo-poll.yml` deleted — pg_cron is free, GHA not needed |
| **Server-side cart** | `cart_items` table + RLS + merge-on-login; Cart.tsx, Checkout.tsx, Navbar.tsx, AuthContext.tsx all rewritten |

### 🔲 Still To Do (in order)

| Priority | Task | Notes |
|----------|------|-------|
| **NEXT** | Verify odoo-poll end-to-end | Last SQL test failed (copy-paste newline in JSON). Re-run corrected single-line query |
| **NEXT** | Verify `cart_items` table exists in DB | `SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='cart_items');` — if false, run `npx supabase db push` |
| **NEXT** | Push frontend cart changes to Netlify | Commit Cart.tsx, Checkout.tsx, Navbar.tsx, AuthContext.tsx, supabase.ts → push → Netlify auto-deploys |
| **HIGH** | HTTPS for Odoo | Needs Synology DSM access — Let's Encrypt cert + reverse proxy. API key travels over HTTP until done |
| **BEFORE GO-LIVE** | CCAvenue payment integration | Replace dummy payment in Checkout.tsx + signature verify in confirm-order edge function |
| **MEDIUM** | Variant selection in cart | `variant_id` is null for web-added items — product detail page needs variant picker wired up |
| **LOW** | Real-time stock on PDP | Supabase Realtime subscription on `product_variants` to push stock updates immediately |
| **LOW** | Nominatim → Google Places | Only needed at scale (>10 concurrent checkouts) |

### Verify odoo-poll manually

Run this **single-line** query in Supabase Dashboard → SQL Editor (no line breaks anywhere in the JSON string):

```sql
SELECT net.http_post(url := 'https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/odoo-poll', headers := '{"Content-Type": "application/json", "Authorization": "Bearer bea462da82d4b9f9ada4b9cbf562335136c066ab3e3b2f40721e2ed094dcf565"}'::jsonb, body := '{}'::jsonb) AS request_id;
```

Then verify: `SELECT * FROM event_log ORDER BY created_at DESC LIMIT 5;` → expect a `poll.completed` entry.

### Deploy frontend cart changes

```bash
git add frontend/src/lib/supabase.ts frontend/src/contexts/AuthContext.tsx \
  frontend/src/pages/Cart.tsx frontend/src/pages/Checkout.tsx \
  frontend/src/components/Navbar.tsx
git commit -m "feat: server-side cart for authenticated users"
git push
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Customer Browser                             │
│            React 19 SPA (Vite) — hosted on Netlify CDN             │
└──────────┬──────────────────────────────────────────────────────────┘
           │ HTTPS  (Supabase JS SDK)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase Platform                           │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │  Auth (JWT) │  │  PostgreSQL DB   │  │  Storage (S3)         │  │
│  │  email/pass │  │  (see schema)    │  │  product-images bucket│  │
│  └─────────────┘  └──────────────────┘  └───────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno, serverless)                           │   │
│  │  confirm-order │ cancel-order │ sync-to-odoo                │   │
│  │  sync-products │ odoo-poll   │ admin │ send-auth-email      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  pg_cron — every 30 min → calls odoo-poll edge function      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ JSON-RPC / XML-RPC (HTTP)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Odoo 16 ERP (Synology NAS)                      │
│  colnature.synology.me:8069   [⚠ HTTP — needs HTTPS, see below]    │
│                                                                     │
│  product.template + product.product (variants)                      │
│  stock.quant (inventory)                                            │
│  sale.order + sale.order.line                                       │
│  stock.picking (delivery/return)                                    │
│  res.partner (customers)                                            │
│  account.* (accounting — not touched by web app)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Sync Strategy

### Odoo → Supabase (automated, every 30 min)

`pg_cron` calls `odoo-poll` edge function every 30 minutes. It runs 4 operations in sequence:

| Operation | Odoo model queried | What it updates in Supabase |
|-----------|-------------------|----------------------------|
| `pollDeliveries` | `stock.picking` (state=done, last 1hr) | `orders.status = 'delivered'`, `orders.delivered_at` |
| `pollCancellations` | `sale.order` (state=cancel, last 1hr) | `orders.status = 'cancelled'` |
| `pollStock` | `stock.quant` (location 74) | `product_variants.stock_quantity` |
| `triggerProductSync` | Calls `sync-products` function | Full upsert of products, variants, images |

### Supabase → Odoo (triggered by user/admin actions)

| Action | Edge function | What it does in Odoo |
|--------|--------------|---------------------|
| Customer places order | `confirm-order` → `sync-to-odoo` | Creates `res.partner` (if new), `sale.order`, `sale.order.line`, calls `action_confirm` |
| Customer cancels order | `cancel-order` → `sync-to-odoo` | Calls `action_cancel` on `sale.order` |
| Admin processes return | `admin` function | Creates `stock.return.picking` |
| Admin updates tracking | `admin` function | Updates `orders` table only (tracking is Supabase-side) |

---

## Database Schema (key tables)

```
profiles          — extends auth.users, stores odoo_partner_id
products          — cached from Odoo product.template
product_variants  — cached from Odoo product.product (size, color, stock_quantity)
product_images    — cached from Odoo, also uploaded to Supabase Storage
orders            — customer orders (source of truth in Supabase)
order_items       — line items per order
order_status_history — auto-logged on every status change (trigger)
addresses         — saved delivery addresses per user
cart_items        — server-side cart for logged-in users
wishlist_items    — product wishlist per user
product_reviews   — customer reviews (approved by admin)
return_requests   — return workflow
event_log         — audit trail for all system operations
```

### Order Status Flow

```
pending → paid → processing → shipped → delivered
    ↓               ↓
 cancelled       cancelled
```

- `pending` — order created, awaiting payment confirmation
- `paid` — dummy payment confirmed (CCAvenue integration pending)
- `processing` — synced to Odoo, warehouse is preparing
- `shipped` — admin added tracking number
- `delivered` — polled from Odoo picking status (or admin sets manually)
- `cancelled` — cancelled by customer or polled from Odoo

### Return Request Status Flow

```
pending → approved → item_shipped → item_received → completed
    ↓
 rejected
```

- 7-day return window enforced by DB trigger from `delivered_at`

---

## Cart Architecture

```
Anonymous user                  Logged-in user
─────────────────               ────────────────────────────────
localStorage['cart']            Supabase cart_items table
  Product[] (repeated per qty)    (product_id, variant_id, quantity)

On login:
  localStorage cart ──────────► mergeLocalCartToServer()
                                 localStorage.removeItem('cart')
```

- **Anonymous**: Cart stored in `localStorage['cart']` as `Product[]` (each unit = one entry)
- **Logged-in**: Cart stored in `cart_items` table, survives device/browser switches
- **Merge on login**: Any anonymous cart items are upserted into the server cart, then localStorage is cleared
- **Navbar badge**: Reads from React Query `['cart']` for logged-in, localStorage for anonymous

---

## Edge Functions Reference

| Function | Auth | Purpose |
|----------|------|---------|
| `confirm-order` | User JWT | Validates stock, marks paid, syncs to Odoo, sends email |
| `cancel-order` | User JWT | Cancels order in Supabase + Odoo |
| `sync-to-odoo` | Service role | Creates/cancels/returns sale orders in Odoo via XML-RPC |
| `sync-products` | Service role | Full product catalog sync Odoo → Supabase |
| `odoo-poll` | Webhook secret | Polls deliveries, cancellations, stock; triggers product sync |
| `admin` | Service role | Admin operations (order status, tracking, returns, event log) |
| `send-auth-email` | Public | Custom email templates for auth flows |
| `proxy-image` | Public | Proxies images from Odoo URL |

---

## Auth Flow

1. Customer signs up with email + password → Supabase creates user
2. DB trigger `handle_new_user` auto-creates a `profiles` row
3. JWT stored in browser session (1 hour expiry, auto-refresh)
4. Password reset uses custom `/reset-password` page (PKCE compatible)
5. `detectSessionInUrl: false` on main client — recovery URL handled by dedicated client

---

## Environment Variables

### Frontend (`frontend/.env.local` / Netlify env vars)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Edge Functions (Supabase secrets — `supabase secrets set KEY=value`)
```
ODOO_URL                  # http://colnature.synology.me:8069 (⚠ upgrade to HTTPS)
ODOO_DB                   # 00_TCON_PRODUCTION
ODOO_USERNAME             # bhavnindersingh@gmail.com
ODOO_API_KEY              # Odoo API key
ODOO_WEB_WAREHOUSE_ID     # 8
ODOO_WEB_LOCATION_ID      # 74
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL         # shop@thecoloursofnature.com
ODOO_WEBHOOK_SECRET       # shared secret for odoo-poll auth
```

### Database runtime setting — NOT NEEDED (free tier)
`ALTER DATABASE` is blocked on Supabase free tier. The webhook secret is hardcoded directly in
migration `20260404000002_fix_cron_secret.sql`. If you rotate the secret, update that migration
and run `npx supabase db push`.

---

## Deployment

| Component | How to deploy |
|-----------|--------------|
| Frontend | `git push` → Netlify auto-builds (`frontend/` → `npm run build` → `dist/`) |
| Edge functions | `supabase functions deploy <function-name>` |
| DB migrations | `supabase db push` (or apply via Supabase dashboard) |
| pg_cron schedule | Applied via `20260404000002_fix_cron_secret.sql` — `odoo-poll-30min` confirmed running |

---

---

# Future Work & Pending Tasks

---

## 1. CCAvenue Payment Gateway (HIGH PRIORITY — before go-live)

**Current state:** Dummy payment flow — `payment_intent_id = 'dummy_<timestamp>'`. Orders go to Odoo as "paid" without real money collected.

**What needs to be done:**
- Integrate CCAvenue payment SDK in `frontend/src/pages/Checkout.tsx` (payment step)
- Replace the dummy confirm button with real CCAvenue payment initiation
- Update `supabase/functions/confirm-order/index.ts`:
  - Verify CCAvenue payment signature before marking order paid
  - Store real transaction ID in `payment_intent_id`
- CCAvenue requires a server-side signature verification — do this in the edge function, not frontend
- Test with CCAvenue sandbox before going live
- The `orders.payment_intent_id` column already exists and is ready

---

## 2. HTTPS for Odoo — Synology DSM (HIGH PRIORITY — security)

**Current state:** `ODOO_URL = http://colnature.synology.me:8069` — Odoo API key travels over plaintext HTTP.

**Steps:**
1. Synology DSM → Control Panel → Security → Certificate → Add → Let's Encrypt
   - Domain: `colnature.synology.me`
2. DSM → Application Portal → Reverse Proxy → Create:
   - Source: HTTPS port 443, `colnature.synology.me`
   - Destination: HTTP `localhost:8069`
3. Ensure port 443 is forwarded on your router to the Synology IP
4. Run: `supabase secrets set ODOO_URL=https://colnature.synology.me`
5. Redeploy all edge functions:
   ```
   supabase functions deploy sync-to-odoo
   supabase functions deploy sync-products
   supabase functions deploy odoo-poll
   supabase functions deploy confirm-order
   supabase functions deploy cancel-order
   ```
6. Verify: `curl https://colnature.synology.me/web/login` → 200

---

## ~~3. pg_cron Secret Setup~~ ✅ DONE

`ODOO_WEBHOOK_SECRET` was generated and set via `npx supabase secrets set`. `ALTER DATABASE` is
blocked on the Supabase free tier, so the secret is hardcoded directly in migration
`20260404000002_fix_cron_secret.sql`. The `odoo-poll-30min` cron is confirmed running in
`cron.job`. Test query and `event_log` check are in the **Implementation Status** section above.

---

## 4. Add Variant Selection to Cart (MEDIUM)

**Current state:** When a customer adds a product from the product detail page, the cart stores the base `Product` object without a specific variant (size/color). The `variant_id` in `cart_items` is always `null` for web-added items.

**Impact:** When the order is created, `odoo_variant_id` is derived from the order items. If variant selection isn't tracked, Odoo gets the wrong variant.

**What needs to be done:**
- Check `frontend/src/pages/Product Detail.tsx` — does the "Add to Cart" button capture the selected variant?
- If not: add variant selector (size/color picker) to the product detail page
- When adding to cart (logged-in): call `upsertServerCartItem(productId, variantId, qty)` with the actual variant ID
- When adding to cart (anonymous): store `{ ...product, selected_variant_id: X }` in localStorage
- Update `mergeLocalCartToServer` to read `selected_variant_id` if present

---

## 5. Address Autocomplete — Upgrade from Nominatim (LOW, when scaling)

**Current state:** Using OpenStreetMap Nominatim with 350ms debounce. Works fine for low traffic but has a 1 req/s usage policy.

**When to upgrade:** When you expect more than ~10 concurrent users doing checkout at the same time.

**Recommended replacement:** Google Places API (best accuracy for India) or Mapbox Geocoding (100k free/month).

**File to change:** `frontend/src/components/PlacesAutocomplete.tsx`

---

## 6. Product Sync Optimisation (LOW)

**Current state:** `odoo-poll` calls `sync-products` (full product catalog sync) every 30 minutes. For large catalogs this is heavy.

**Optimisation:** Split into two crons:
- `odoo-poll` without product sync every 15 min (deliveries, cancellations, stock)
- `sync-products` directly every 2-4 hours

**What needs to be done:**
- Add `?skip_product_sync=true` query param support to `odoo-poll/index.ts`
- Add a second `cron.schedule` entry in `20260321000000_sync_cron.sql` for the separate product sync

---

## 7. Real-time Stock on Product Pages (LOW)

**Current state:** Stock shown on product pages is from the last Supabase sync (up to 30 min stale). A customer can see "In Stock" when the item just sold out.

**Mitigation already in place:** `confirm-order` does a live stock check at purchase time — it will reject the order if truly out of stock.

**Enhancement:** Use Supabase Realtime subscriptions on the `product_variants` table to push stock updates to the frontend immediately when the cron updates them.

---

## Use Cases to Test End-to-End (QA Checklist)

### Customer Flows

| # | Use Case | Steps | Expected |
|---|----------|-------|----------|
| 1 | Browse products (anonymous) | Open /shop | Products load from Supabase cache |
| 2 | Add to cart (anonymous) | Click "Add to Cart" on product | localStorage updated, Navbar badge increments |
| 3 | View cart (anonymous) | Go to /cart | Items shown with correct qty and price |
| 4 | Update qty in cart | Click +/- | qty updates, total recalculates |
| 5 | Remove item from cart | Click Remove | Item gone, total updates |
| 6 | Sign up | /account → sign up | Email confirmation sent, profile created |
| 7 | Cart merge on login | Add items as anon → log in | localStorage cart merges to server, localStorage cleared, badge correct |
| 8 | Browse products (logged in) | Open /shop | Same products, cart from server |
| 9 | Add to cart (logged-in) | Click "Add to Cart" | `cart_items` row inserted, badge updates |
| 10 | Cart persists across devices | Add item on one device, open on another (same account) | Cart shows same items |
| 11 | Checkout — address select | Go to /checkout → pick saved address | Address pre-filled |
| 12 | Checkout — new address | Enter new address + save to profile | Address saved, order uses it |
| 13 | Place order | Complete checkout | Order in Supabase (pending → paid → processing), Odoo sale.order created, confirmation email sent |
| 14 | Cart cleared after order | After order success | Cart empty, badge = 0 |
| 15 | View orders | /account → Orders | Order listed with correct status |
| 16 | Cancel order | Cancel from account page (within cancellable window) | Order cancelled in Supabase + Odoo, cancellation email sent |
| 17 | Request return | On delivered order → Request Return | Return request created, within 7-day window |
| 18 | Return window expired | Try return > 7 days after delivery | Error: "Return window has closed" |
| 19 | Wishlist add/remove | Heart icon on product | Item saved, persists on refresh |
| 20 | Product review | Submit review on purchased product | Review saved (pending approval) |
| 21 | Password reset | Forgot password flow | Email sent, reset page works |
| 22 | Out of stock order attempt | Try to order more than stock | Blocked at confirm-order with clear error |

### Admin Flows

| # | Use Case | Steps | Expected |
|---|----------|-------|----------|
| 23 | View all orders | /admin → orders list | All orders with status filters |
| 24 | Update order to shipped | Add tracking number + carrier | Order → shipped, tracking email sent |
| 25 | View return requests | /admin → filter returns | Pending returns listed |
| 26 | Approve return | Approve with instructions | Customer notified, return status → approved |
| 27 | Reject return | Reject with reason | Customer notified, status → rejected |
| 28 | Trigger product sync | /admin → sync products | Products refreshed from Odoo |
| 29 | View event log | /admin → event log | All system events visible |

### Sync Flows

| # | Use Case | How to test | Expected |
|---|----------|-------------|----------|
| 30 | Delivery auto-detected | Mark picking as done in Odoo → wait up to 30 min (or trigger poll manually) | Order status → delivered, customer email sent |
| 31 | Cancellation auto-detected | Cancel sale.order in Odoo → wait for poll | Order status → cancelled in Supabase |
| 32 | Stock sync | Adjust stock in Odoo → wait for poll | `product_variants.stock_quantity` updated |
| 33 | Product added in Odoo | Add new product with "Online Shop" tag → trigger sync | Product appears on /shop |
| 34 | pg_cron running | Supabase Dashboard → Database → Cron Jobs → check last run time | `odoo-poll-30min` running every 30 min |
| 35 | Manual poll trigger | POST to `odoo-poll` with correct Bearer token | Returns `{ success: true, results: {...} }` |

---

## Known Limitations

- **No real payment** — CCAvenue integration pending. Do not go live without this.
- **Odoo on HTTP** — API key exposed over plaintext until HTTPS is set up on Synology.
- **Variant not tracked in cart** — `variant_id` is null for web-added cart items. Product detail page variant selection needs verification.
- **30-min sync delay** — Stock and delivery status can be up to 30 minutes stale. Acceptable for current scale.
- **No abandoned cart emails** — `cart_items` table is in place, but no automation to email users with items left in cart.
- **No real-time stock on PDP** — Product detail page stock is from last sync. Oversell prevented at checkout by live stock check.
