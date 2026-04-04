-- ─── Automated Odoo Poll via pg_cron ────────────────────────────────────────
-- pg_cron and pg_net are pre-enabled on Supabase hosted (all plans incl. free).
-- This schedules odoo-poll every 30 minutes, which handles:
--   • Deliveries  — marks orders 'delivered' when Odoo picking is done
--   • Cancellations — marks orders 'cancelled' when cancelled in Odoo
--   • Stock       — syncs stock quantities from Odoo location
--   • Products    — triggers full product/variant/image sync from Odoo
--
-- BEFORE this migration runs, set the webhook secret once in Supabase SQL editor
-- (do NOT put the real value in git):
--
--   ALTER DATABASE postgres SET app.odoo_webhook_secret = 'your_actual_secret';
--   SELECT pg_reload_conf();
--
-- Your secret value = whatever ODOO_WEBHOOK_SECRET is set to in supabase secrets list
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'odoo-poll-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url              := 'https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/odoo-poll',
    headers          := jsonb_build_object(
                          'Content-Type',  'application/json',
                          'Authorization', 'Bearer ' || current_setting('app.odoo_webhook_secret', true)
                        ),
    body             := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
