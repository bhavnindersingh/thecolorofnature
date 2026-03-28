-- =============================================================================
-- Color of Nature — Order & Return Enhancements Migration (Part 1)
-- Adds: extended return states, event_log, delivered_at, return_instructions
-- NOTE: ALTER TYPE ADD VALUE must commit before new values can be referenced.
--       The RLS policy using 'item_shipped' is in 20260328000001_*.sql
-- =============================================================================


-- ─── Extend return_status enum with new states ─────────────────────────────
ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'item_shipped'  AFTER 'approved';
ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'item_received' AFTER 'item_shipped';


-- ─── Add return_instructions column to return_requests ─────────────────────
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS return_instructions text;


-- ─── Add delivered_at column to orders ─────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;


-- ─── Event Log table for admin dashboard ───────────────────────────────────
-- Captures all system events: order actions, return actions, syncs, webhooks
CREATE TABLE IF NOT EXISTS public.event_log (
  id          bigserial PRIMARY KEY,
  event_type  text NOT NULL,          -- e.g. 'order.created', 'return.approved', 'webhook.picking_done'
  entity_type text NOT NULL,          -- 'order', 'return', 'product_sync'
  entity_id   text,                   -- order UUID or return UUID
  details     jsonb DEFAULT '{}',     -- arbitrary payload
  actor       text DEFAULT 'system',  -- 'system', 'admin', 'customer', 'odoo_webhook'
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_entity
  ON public.event_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_event_log_type
  ON public.event_log (event_type);

CREATE INDEX IF NOT EXISTS idx_event_log_created
  ON public.event_log (created_at DESC);

-- No RLS on event_log — accessed only via service_role key from edge functions
