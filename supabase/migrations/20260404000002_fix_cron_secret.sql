-- Fix cron job: ALTER DATABASE is not permitted on Supabase free tier,
-- so the secret is embedded directly in the cron schedule SQL.
-- The same secret value is stored securely as a Supabase function secret (ODOO_WEBHOOK_SECRET).

SELECT cron.unschedule('odoo-poll-30min');

SELECT cron.schedule(
  'odoo-poll-30min',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url              := 'https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/odoo-poll',
    headers          := '{"Content-Type": "application/json", "Authorization": "Bearer bea462da82d4b9f9ada4b9cbf562335136c066ab3e3b2f40721e2ed094dcf565"}'::jsonb,
    body             := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);
