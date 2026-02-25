-- =============================================================================
-- Color of Nature — Initial Database Schema
-- =============================================================================

-- ─── Profiles (extends Supabase Auth users) ───────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  odoo_partner_id integer,                -- Odoo res.partner ID (synced by Edge Function)
  created_at  timestamptz default now()
);

-- Automatically create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Products (cache from Odoo) ───────────────────────────────────────────────
create table public.products (
  id              bigserial primary key,
  odoo_product_id integer unique not null,  -- Odoo product.template ID
  name            text not null,
  description     text,
  price           numeric(10, 2) not null,
  image_url       text,
  category        text,
  in_stock        boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create type order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  status          order_status default 'pending',
  total_amount    numeric(10, 2) not null,
  shipping_address jsonb,
  odoo_order_id   integer,               -- Odoo sale.order ID (synced by Edge Function)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Order Items ──────────────────────────────────────────────────────────────
create table public.order_items (
  id          bigserial primary key,
  order_id    uuid references public.orders(id) on delete cascade,
  product_id  bigint references public.products(id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10, 2) not null,
  created_at  timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Profiles: Users can only see and edit their own profile
create policy "Users can view own profile."   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Products: Anyone (even unauthenticated) can browse products
create policy "Products are public."          on public.products for select using (true);

-- Orders: Users can only see their own orders
create policy "Users can view own orders."    on public.orders for select using (auth.uid() = user_id);
create policy "Users can create orders."      on public.orders for insert with check (auth.uid() = user_id);

-- Order Items: Readable if the parent order belongs to the user
create policy "Users can view own order items." on public.order_items for select
  using (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));
