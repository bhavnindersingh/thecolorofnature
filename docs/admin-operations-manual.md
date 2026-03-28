# Admin Operations Manual — The Colours of Nature

This guide covers everything an admin needs to manage orders, returns, and products day to day.

---

## Quick Links

| Tool | URL |
|------|-----|
| Admin Dashboard | https://thecoloursofnature.com/admin |
| Odoo Backend | http://colnature.synology.me:8069/web |
| Supabase Dashboard | https://supabase.com/dashboard/project/kfcppshcibxhayduqbzv |
| Netlify Deploys | https://app.netlify.com |

---

## Email Notifications at a Glance

Every customer-facing action sends an email automatically. No manual step required.

| Action | Who receives email | Subject line |
|--------|--------------------|--------------|
| Customer confirms payment | Customer | `Order Confirmed — #XXXXXXXX` |
| Admin adds tracking number | Customer | `Your order is on its way — #XXXXXXXX` |
| Admin approves return | Customer | `Return Approved — Order #XXXXXXXX` |
| Admin rejects return | Customer | `Return Request Update — Order #XXXXXXXX` |
| Admin completes return | Customer | `Return Completed — Order #XXXXXXXX` |

All emails come from `orders@coloursofnature.com` via Resend.

---

## System Overview

Products live in **Odoo**. The website syncs from Odoo. Orders placed on the website flow back into Odoo automatically.

**Data flow:**
```
Odoo (source of truth for products & stock)
    ↓ sync-products (manual or every 30 min via odoo-poll)
Website Product Catalogue
    ↓ customer places order
Supabase (order storage)
    ↓ confirm-order edge function
Odoo sale.order (created automatically on payment)
    ↓ warehouse picks, packs, ships
Odoo delivery done → odoo-poll detects → order marked "delivered" in Supabase
```

---

## Daily Workflow

1. Check the **Orders tab** in the admin dashboard for new `processing` orders.
2. In Odoo, confirm the corresponding `sale.order` exists and validate the delivery when shipped.
3. Add the tracking number in the admin dashboard — this emails the customer automatically.
4. Check the **Returns tab** for any pending return requests and action them.

---

## Product Management

### Adding a new product to the website

1. Create the product in Odoo as normal (set price, variants, stock at WHWE location 74).
2. In Odoo, open the product and add the tag **"Online Shop"** to it.
3. In the admin dashboard, click **Sync Products from Odoo**.
4. The product appears on the website within seconds.

### Removing a product from the website

1. In Odoo, remove the **"Online Shop"** tag from the product.
2. In the admin dashboard, click **Sync Products from Odoo**.
3. The product is hidden from the website immediately.

> **Note:** Products that have been ordered can never be hard-deleted (Odoo holds the order history). Removing the tag hides them from the shop and marks them out-of-stock.

### Stock levels

Stock is read from Odoo's WHWE warehouse (location ID 74) every 30 minutes automatically. If you need to reflect a stock change immediately, click **Sync Products from Odoo** in the admin dashboard.

A product shows as "In Stock" if any of its variants has stock > 0 at WHWE.

---

## Order Processing

### Step 1 — Customer places order

The customer adds items to cart, enters their address, and confirms payment. Behind the scenes:

1. An order is created in Supabase with status `pending`.
2. On payment confirmation, status changes to `paid`, then `processing`.
3. A `sale.order` is automatically created in Odoo linked to the WHWE warehouse.
4. The customer receives an **Order Confirmed** email with an itemised table and total.

### Step 2 — Find the order in Odoo

1. Open Odoo → **Sales** → **Orders** → **Orders**.
2. Search by the customer's email or name.
3. The `odoo_order_id` shown in the admin dashboard matches the Odoo `sale.order` record ID (visible in the Odoo URL: `...#id=XXX&model=sale.order`).

### Step 3 — Process the order in Odoo

1. Confirm the sale order if not already confirmed (click **Confirm**).
2. Click the **Delivery** smart button to open the outgoing shipment.
3. Pick and pack the items from WHWE.
4. Click **Validate** on the delivery. Odoo marks the picking as `done`.

### Step 4 — Add tracking in the admin dashboard

Once the parcel is with the courier:

1. Go to **Admin Dashboard** → **Orders** → find the order.
2. Expand the order details.
3. Enter the **carrier name** (e.g., `Royal Mail`, `DHL`) and **tracking number**.
4. Click **Save Tracking**.

This immediately sends the customer a **shipping notification email** with the carrier and tracking number.

### Step 5 — Delivery confirmation (automatic)

The `odoo-poll` function runs every 30 minutes via GitHub Actions. When it detects the Odoo delivery is validated, it automatically:
- Updates the Supabase order status to `delivered`
- Records the delivery timestamp
- Logs the event in the Event Log

No admin action needed for this step.

---

## Cancellations

### Before the order is shipped

1. In the admin dashboard, find the order and click **Cancel Order**.
2. In Odoo, cancel the corresponding `sale.order` (and the pending delivery if one was created).
3. The order status in Supabase reflects the cancellation within 30 minutes via odoo-poll.

### After the order is shipped

Cancellations are not possible once dispatched. Direct the customer to submit a return request from their account.

---

## Return Processing

Returns go through a 5-step lifecycle. The admin dashboard shows the current state at all times.

**Lifecycle:**
```
pending → approved → item_shipped → item_received → completed
       ↘ rejected (only possible from pending)
```

### Step 1 — Customer requests a return

The customer goes to **My Account** → **Orders** and clicks **Request Return** on a delivered order. The return appears in the admin dashboard → **Returns** tab with status `pending`.

### Step 2 — Admin reviews the return

In the admin dashboard → **Returns** tab, open the return request:

**To approve:**
1. Enter return instructions in the text field (shipping address, packaging requirements, what to include in the parcel, reference number if any).
2. Click **Approve Return**.
3. Status changes to `approved`.
4. Customer receives a **Return Approved** email containing your instructions.

**To reject:**
1. Optionally enter a reason in the note field.
2. Click **Reject Return**.
3. Status changes to `rejected`.
4. Customer receives a **Return Request Update** email (your note is shown if provided).

### Step 3 — Customer ships the item

The customer sees your approval instructions on their **My Account** page. Once they've sent the parcel, they click **I've Shipped the Item** in their account. Status changes to `item_shipped`.

The return will now show as `item_shipped` in your admin dashboard.

### Step 4 — Admin marks item as received

When the returned item arrives at your warehouse:

1. In the admin dashboard, find the return in `item_shipped` state.
2. Click **Mark as Received**.
3. Status changes to `item_received`.
4. A return order is automatically created in Odoo at the WHWE warehouse.

**Verify in Odoo:**
- Go to **Inventory** → **Operations** → **Transfers**.
- Filter by type = Receipts. Look for the receipt linked to the original sale order.
- Validate the receipt to put the returned stock back into location 74.

### Step 5 — Admin completes the return

Once any refund or exchange has been issued:

1. In the admin dashboard, click **Complete Return** on the `item_received` return.
2. Status changes to `completed`.
3. Customer receives a **Return Completed** email confirming the process is done (the email mentions a 3–5 business day timeframe if a refund was agreed).

> Process refunds manually in your payment system. The system does not issue refunds automatically.

---

## Event Log

Every action — by customer, admin, or system — is recorded automatically.

**To view:** Admin Dashboard → **Event Log** tab.

Each entry shows:
- **Timestamp** — when it happened
- **Event type** — e.g., `order.payment_confirmed`, `order.odoo_synced`, `return.approved`, `order.delivered`
- **Entity** — the order or return ID
- **Details** — Odoo IDs, tracking numbers, error messages
- **Actor** — `customer`, `admin`, or `system`

**Useful for debugging:**
- Customer says they didn't receive an order email → check Event Log for `order.payment_confirmed`. If it's there, payment went through and the email was sent.
- Odoo sync failed → look for `order.odoo_sync_failed` to see the error message.
- Full history of one order → filter Event Log by entity ID (the order UUID shown in the admin dashboard).

---

## Odoo Reference

### Where to find things in Odoo

| What you need | Where in Odoo |
|---------------|---------------|
| Customer orders | Sales → Orders → Orders |
| Deliveries / shipments | Inventory → Operations → Transfers (filter: Delivery Orders) |
| Return receipts | Inventory → Operations → Transfers (filter: Receipts) |
| Product stock at WHWE | Inventory → Products → Products → select product → Location button |
| All stock at location 74 | Inventory → Reporting → Inventory → filter by WHWE location |
| Customer contact details | Contacts → search by name or email |

### Odoo sale.order states

| Odoo state | Meaning |
|------------|---------|
| `Quotation` | Draft, not confirmed |
| `Sales Order` | Confirmed, delivery to be created |
| `To Invoice` | Delivered, not yet invoiced |
| `Done` | Fully invoiced and closed |
| `Cancelled` | Order was cancelled |

### Warehouse details

- **Warehouse:** WHWE — all website orders use this warehouse
- **Warehouse ID:** 8
- **Stock location ID:** 74

All website orders are created in WHWE. Stock levels shown on the website are read only from location 74. If a product has stock at another location in Odoo but not at location 74, it shows as out-of-stock on the website — this is intentional.

---

## Automated Syncing (runs without admin action)

The following happen automatically every 30 minutes:

| What syncs | Mechanism |
|------------|-----------|
| Orders marked `delivered` when Odoo delivery validated | GitHub Actions → `odoo-poll` edge function |
| Orders marked `cancelled` when Odoo sale.order cancelled | GitHub Actions → `odoo-poll` edge function |
| Stock levels updated from WHWE location 74 | GitHub Actions → `odoo-poll` edge function |
| Full product details sync (name, price, images, variants) | GitHub Actions → `odoo-poll` edge function |

For an immediate sync, click **Sync Products from Odoo** in the admin dashboard.

---

## Troubleshooting

### Order not appearing in Odoo after customer pays

1. Check Event Log for `order.odoo_sync_failed`.
2. The error detail will explain why (e.g., missing `odoo_variant_id` on a variant, or a network error).
3. If the variant ID is missing: run a product sync, then create the Odoo sale.order manually and enter the `odoo_order_id` in Supabase via the database dashboard.

### Customer says they didn't receive an email

1. Check Event Log for the relevant event.
2. If the event exists, the email was attempted — check the Resend dashboard (`https://resend.com/emails`) for delivery status and any bounces.
3. If the event doesn't exist, the action wasn't completed on the website side (e.g., payment wasn't confirmed by the customer).

### Stock showing wrong on the website

Click **Sync Products from Odoo** for an immediate update. If still wrong, check the stock quantity directly in Odoo at location 74 (Inventory → Reporting → Inventory).

### Return stuck — Odoo return order not created

Check Event Log for errors on the return entity. The error will show the Odoo API response. A common cause is the original sale.order being in a state that doesn't allow returns (e.g., fully cancelled). Create the return receipt manually in Odoo → Inventory → Operations → Transfers → New.
