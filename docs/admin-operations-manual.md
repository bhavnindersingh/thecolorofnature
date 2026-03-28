# Admin Operations Manual
## The Colours of Nature — Web Shop

---

## How the System Works (Overview)

```
Customer Browser → Supabase (orders, users, products) → Odoo (sales, stock, returns)
                                                      ↑
                                          Odoo sends delivery webhook
```

- **Products** live in Odoo. You tag them "Online Shop" and run a sync → they appear on the website.
- **Orders** are placed on the website, stored in Supabase, then automatically pushed to Odoo as a `Sale Order`.
- **Stock** shown on the website is the live quantity at the **WHWE warehouse** in Odoo (location 74). Stock elsewhere in Odoo does not count toward website availability.
- **Returns** go through a multi-step process managed from the admin dashboard.
- **All actions** are logged in the Event Log on the admin dashboard.

---

## Daily Workflow

1. Check the **Orders** tab for new orders (status: `processing`)
2. In Odoo, find the linked Sale Order and confirm/validate the delivery
3. Once shipped, add tracking info via admin dashboard
4. When Odoo marks the delivery done, the webhook automatically updates the order to `delivered`
5. Check the **Returns** tab for any pending return requests

---

## 1. Adding Products to the Website

**In Odoo:**
1. Open the product (`Product` menu)
2. Go to the **Sales** tab
3. Add the tag **"Online Shop"** under *Tags*
4. Make sure `Can be Sold` is checked and the product is `Active`
5. Set the price and ensure stock exists at **WHWE** (Warehouse WE)

**In Admin Dashboard:**
1. Go to **Sync Products** tab
2. Click **Sync Products from Odoo**
3. The product will appear on the website within seconds

> **Note:** If a product has the "Online Shop" tag but zero stock at WHWE, it shows as *Out of Stock* (still visible, just not purchasable).

---

## 2. Processing Orders

### When a customer places an order:
1. The order is created in Supabase with status `pending`
2. Customer completes dummy payment → status becomes `paid`
3. The system automatically creates a **Sale Order in Odoo** (linked via `odoo_order_id`) → status becomes `processing`

### What you do in Odoo:
1. Open **Sales → Orders → Quotations** (or Sales Orders)
2. Find the order (by customer name or order ref)
3. Confirm the Sale Order if not already confirmed
4. Go to the **Delivery** smart button
5. Validate the picking when items are packed
6. Print shipping label / arrange courier

### Adding tracking info (Admin Dashboard):
1. Open the order in the **Orders** tab
2. Click **Update Tracking**
3. Enter the carrier name and tracking number
4. This is visible to the customer in their Account page

### Order statuses:
| Status | Meaning |
|--------|---------|
| `pending` | Order created, payment not yet confirmed |
| `paid` | Customer paid (dummy), waiting for Odoo sync |
| `processing` | Odoo Sale Order created, being picked/packed |
| `shipped` | Tracking added, in transit |
| `delivered` | Odoo confirmed delivery (auto via webhook) |
| `cancelled` | Order cancelled |

---

## 3. Cancelling an Order

**Before the delivery is validated in Odoo:**
1. In Admin Dashboard → Orders tab, open the order
2. Click **Cancel Order**
3. This cancels the Sale Order in Odoo and updates Supabase status to `cancelled`

**After delivery is validated:** Contact Odoo directly — the cancel button will not work once goods are shipped.

---

## 4. Processing Returns

### Step 1 — Customer requests a return
- Customer goes to Account → Orders → Requests a return with a reason
- Status becomes `pending` in admin dashboard

### Step 2 — Admin approves (Admin Dashboard)
1. Go to **Returns** tab
2. Find the pending return
3. Enter **return instructions** (e.g. "Please post to: Unit 4, ...")
4. Click **Approve**
5. The customer receives an email with the instructions automatically
6. Status becomes `approved`

> **Odoo is NOT updated yet at this stage.**

### Step 3 — Customer ships the item
- Customer logs into their account, reads the instructions
- Clicks **"I've Shipped the Item"** button
- Status becomes `item_shipped`

### Step 4 — Admin marks item received (Admin Dashboard)
1. When the item physically arrives, go to **Returns** tab
2. Find the `item_shipped` return
3. Click **Mark as Received**
4. This automatically creates a **Return (Reverse Transfer) in Odoo**, restoring stock at WHWE
5. Status becomes `item_received`

### Step 5 — Admin completes the return
1. Once any refund/credit is processed (outside this system)
2. Click **Complete Return**
3. Status becomes `completed`

### Return statuses:
| Status | Meaning |
|--------|---------|
| `pending` | Customer requested, waiting for admin |
| `approved` | Admin approved, instructions emailed to customer |
| `item_shipped` | Customer marked as shipped |
| `item_received` | Item arrived, Odoo return/stock restore created |
| `rejected` | Admin rejected the request |
| `completed` | Return fully processed |

---

## 5. Event Log

The **Event Log** tab on the admin dashboard shows every action taken in the system:

- Order created / paid / synced to Odoo
- Return approved / shipped / received / completed
- Product syncs
- Odoo webhook deliveries

**Filtering:** You can filter by entity type (order, return, product_sync) and search by order/return ID.

This is your audit trail. If something looks wrong with an order or return, check the event log first.

---

## 6. Odoo Webhook (Delivery Auto-Update)

When a delivery is validated in Odoo, it automatically tells the website. For this to work, a one-time setup is needed in Odoo:

1. In Odoo, go to **Settings → Technical → Automation → Automated Actions**
2. Create a new action:
   - **Model:** `stock.picking`
   - **Trigger:** When a record is updated
   - **Before Update Filter:** `[['state', '!=', 'done']]`
   - **Filter:** `[['state', '=', 'done'], ['sale_id', '!=', False]]`
   - **Action type:** Execute Python Code
3. Paste this code:
```python
import requests, json
for picking in records:
    if picking.sale_id:
        payload = {
            "event": "picking_done",
            "picking_id": picking.id,
            "picking_name": picking.name,
            "sale_order_id": picking.sale_id.id,
            "state": picking.state,
            "date_done": str(picking.date_done),
        }
        requests.post(
            "https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/odoo-webhook",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer <ODOO_WEBHOOK_SECRET>",
            },
            data=json.dumps(payload),
            timeout=10,
        )
```
4. Replace `<YOUR_PROJECT_REF>` with your Supabase project ref and `<ODOO_WEBHOOK_SECRET>` with the secret set in Supabase edge function secrets.

Once set up, every validated delivery in Odoo will automatically mark the website order as `delivered`.

---

## 7. Quick Reference — Where Things Live

| Task | Where |
|------|-------|
| Tag products for website | Odoo → Product → Sales tab → Tags |
| Sync products to website | Admin Dashboard → Sync Products |
| View/manage orders | Admin Dashboard → Orders |
| Add tracking number | Admin Dashboard → Orders → Update Tracking |
| Manage returns | Admin Dashboard → Returns |
| View all system events | Admin Dashboard → Event Log |
| Validate delivery / create picking | Odoo → Inventory or Sales → Delivery button |
| Check WHWE stock | Odoo → Inventory → Reporting → Locations → filter WHWE |

---

## 8. Environment Variables (for developer reference)

| Variable | Purpose |
|----------|---------|
| `ODOO_URL` | Odoo server URL |
| `ODOO_DB` | Odoo database name |
| `ODOO_USER` | Odoo login email |
| `ODOO_PASSWORD` | Odoo API password |
| `ODOO_WEB_WAREHOUSE_ID` | WHWE warehouse ID (default: 8) |
| `ODOO_WEB_LOCATION_ID` | WHWE stock location ID (default: 74) |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `RESEND_FROM_EMAIL` | From address for emails |
| `ODOO_WEBHOOK_SECRET` | Secret token for Odoo → Supabase webhook |
| `ADMIN_PIN` | 4-digit PIN for admin dashboard access |
