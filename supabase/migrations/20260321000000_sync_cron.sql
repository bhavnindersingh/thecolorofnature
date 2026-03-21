-- Auto-sync cron jobs: call sync-products edge function every 30 minutes
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase Pro/Team)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove existing job if re-running this migration
select cron.unschedule('sync-products-30min')
where exists (select 1 from cron.job where jobname = 'sync-products-30min');

-- Schedule product + inventory sync every 30 minutes
-- anon key is public (same as VITE_SUPABASE_ANON_KEY in .env)
select cron.schedule(
  'sync-products-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://kfcppshcibxhayduqbzv.supabase.co/functions/v1/sync-products',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmY3Bwc2hjaWJ4aGF5ZHVxYnp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDgwNjYsImV4cCI6MjA4ODk4NDA2Nn0.qt_EzzQXGfMuoVazmwBDur2HPp4vJ1fPNcTdLsYHsGU"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
