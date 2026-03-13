-- =============================================================================
-- Color of Nature — Order Enhancements Migration
-- Adds: order tracking, status history, return requests
-- =============================================================================


-- ─── Add tracking & delivery columns to orders ──────────────────────────────
alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists carrier text,
  add column if not exists estimated_delivery date,
  add column if not exists odoo_picking_name text;


-- ─── Order Status History ────────────────────────────────────────────────────
-- Logs every status change with timestamp for timeline display
create table public.order_status_history (
  id            bigserial primary key,
  order_id      uuid references public.orders(id) on delete cascade,
  status        order_status not null,
  note          text,                            -- e.g. "Payment confirmed", "Shipped via BlueDart"
  changed_by    text default 'system',           -- 'system', 'admin', or user email
  created_at    timestamptz default now()
);


-- ─── Return Requests ─────────────────────────────────────────────────────────
create type return_status as enum ('pending', 'approved', 'rejected', 'completed');

create table public.return_requests (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  reason          text not null,
  status          return_status default 'pending',
  odoo_return_id  integer,                       -- Odoo stock.return.picking ID
  admin_note      text,                          -- Admin response / reason for rejection
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);


-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.order_status_history enable row level security;
alter table public.return_requests      enable row level security;

-- Status history: readable if the parent order belongs to the user
create policy "Users can view own order status history."
  on public.order_status_history for select
  using (exists (
    select 1 from public.orders where id = order_id and user_id = auth.uid()
  ));

-- Return requests: users can view and create their own
create policy "Users can view own returns."
  on public.return_requests for select
  using (auth.uid() = user_id);

create policy "Users can create returns."
  on public.return_requests for insert
  with check (auth.uid() = user_id);


-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_order_status_history_order_id
  on public.order_status_history (order_id);

create index if not exists idx_return_requests_user_id
  on public.return_requests (user_id);

create index if not exists idx_return_requests_order_id
  on public.return_requests (order_id);


-- ─── Auto-log status changes on orders ───────────────────────────────────────
-- When an order's status is updated, automatically insert a history record
create or replace function public.log_order_status_change()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') or (OLD.status is distinct from NEW.status) then
    insert into public.order_status_history (order_id, status, note)
    values (NEW.id, NEW.status,
      case NEW.status
        when 'pending'    then 'Order placed'
        when 'paid'       then 'Payment confirmed'
        when 'processing' then 'Order is being prepared'
        when 'shipped'    then 'Order has been shipped'
        when 'delivered'  then 'Order delivered'
        when 'cancelled'  then 'Order cancelled'
        else 'Status updated'
      end
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_order_status_change
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();
