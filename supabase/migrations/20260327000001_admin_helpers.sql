-- Helper function for admin edge function to resolve user emails.
-- Uses SECURITY DEFINER so it can read auth.users (inaccessible via normal RLS).
create or replace function public.get_user_emails(user_ids uuid[])
returns table(id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select id, email::text from auth.users where id = any(user_ids);
$$;

-- Only the service_role (used by the admin edge function) may call this.
revoke all on function public.get_user_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.get_user_emails(uuid[]) to service_role;
