-- =============================================================================
-- Color of Nature — Fashion E-Commerce Extensions
-- Extends the initial schema with: addresses, product_variants, product_images
-- =============================================================================


-- ─── Add extra profile fields ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;


-- ─── Addresses ────────────────────────────────────────────────────────────────
create table public.addresses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade,
  label            text,                       -- e.g. "Home", "Office"
  first_name       text not null,
  last_name        text not null,
  address_line_1   text not null,
  address_line_2   text,
  city             text not null,
  state            text,
  postal_code      text not null,
  country          text not null default 'France',
  phone            text,
  is_default       boolean default false,
  created_at       timestamptz default now()
);


-- ─── Product Variants ─────────────────────────────────────────────────────────
-- Adds size/color/stock granularity on top of the Odoo-synced products table.
create table public.product_variants (
  id               bigserial primary key,
  product_id       bigint references public.products(id) on delete cascade,
  sku              text unique,
  size             text,                       -- e.g. "XS", "S", "M", "L", "XL"
  color            text,                       -- e.g. "Ivory", "Noir", "Camel"
  color_hex        text,                       -- e.g. "#FFFFF0" (for swatches)
  stock_quantity   integer not null default 0 check (stock_quantity >= 0),
  price_adjustment numeric(10, 2) default 0.00, -- Added to the base product price
  odoo_variant_id  integer unique,             -- Odoo product.product ID
  created_at       timestamptz default now()
);


-- ─── Product Images ───────────────────────────────────────────────────────────
create table public.product_images (
  id               bigserial primary key,
  product_id       bigint references public.products(id) on delete cascade,
  variant_id       bigint references public.product_variants(id) on delete set null,
  image_url        text not null,
  alt_text         text,
  display_order    integer default 0,
  is_primary       boolean default false,
  created_at       timestamptz default now()
);


-- ─── Update addresses FK in orders ───────────────────────────────────────────
-- The original orders table uses a JSONB blob for shipping_address.
-- We add a column to reference the structured addresses table (optional, backward compatible).
alter table public.orders
  add column if not exists shipping_address_id uuid references public.addresses(id) on delete set null;

-- Also add a stripe payment intent reference for payment processing
alter table public.orders
  add column if not exists payment_intent_id text;

-- Add 'paid' to the order status enum
alter type order_status add value if not exists 'paid';


-- ─── Wishlist ─────────────────────────────────────────────────────────────────
create table public.wishlist_items (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  product_id bigint references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, product_id)               -- Prevent duplicate wishlist entries
);


-- ─── Product Reviews ──────────────────────────────────────────────────────────
create table public.product_reviews (
  id          bigserial primary key,
  product_id  bigint references public.products(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  title       text,
  body        text,
  is_approved boolean default false,
  created_at  timestamptz default now(),
  unique (product_id, user_id)               -- One review per user per product
);


-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.addresses        enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;
alter table public.wishlist_items   enable row level security;
alter table public.product_reviews  enable row level security;


-- ── Addresses: users manage their own ────────────────────────────────────────
create policy "Users can view own addresses."
  on public.addresses for select using (auth.uid() = user_id);

create policy "Users can insert own addresses."
  on public.addresses for insert with check (auth.uid() = user_id);

create policy "Users can update own addresses."
  on public.addresses for update using (auth.uid() = user_id);

create policy "Users can delete own addresses."
  on public.addresses for delete using (auth.uid() = user_id);


-- ── Product Variants: public read ─────────────────────────────────────────────
create policy "Product variants are public."
  on public.product_variants for select using (true);


-- ── Product Images: public read ───────────────────────────────────────────────
create policy "Product images are public."
  on public.product_images for select using (true);


-- ── Wishlist: users manage their own ─────────────────────────────────────────
create policy "Users can view own wishlist."
  on public.wishlist_items for select using (auth.uid() = user_id);

create policy "Users can add to wishlist."
  on public.wishlist_items for insert with check (auth.uid() = user_id);

create policy "Users can remove from wishlist."
  on public.wishlist_items for delete using (auth.uid() = user_id);


-- ── Reviews: public read, authenticated insert ────────────────────────────────
create policy "Reviews are public."
  on public.product_reviews for select using (true);

create policy "Users can write own reviews."
  on public.product_reviews for insert with check (auth.uid() = user_id);

create policy "Users can update own reviews."
  on public.product_reviews for update using (auth.uid() = user_id);


-- ─── Useful Indexes ───────────────────────────────────────────────────────────
create index if not exists idx_product_variants_product_id on public.product_variants (product_id);
create index if not exists idx_product_images_product_id   on public.product_images (product_id);
create index if not exists idx_wishlist_user_id             on public.wishlist_items (user_id);
create index if not exists idx_addresses_user_id            on public.addresses (user_id);
create index if not exists idx_orders_user_id               on public.orders (user_id);
create index if not exists idx_reviews_product_id           on public.product_reviews (product_id);
