-- Add variant_id to order_items so we know which specific variant was ordered
-- Nullable for backward compatibility with existing orders (those will fall back to product_variants[0])
ALTER TABLE order_items
  ADD COLUMN variant_id bigint REFERENCES product_variants(id) ON DELETE SET NULL;

-- Atomic stock decrement — called immediately after a successful Odoo order sync
-- to keep Supabase cache accurate within the 30-min cron window.
-- Uses GREATEST(0, ...) so it never goes negative.
CREATE OR REPLACE FUNCTION decrement_variant_stock(p_variant_id bigint, p_quantity integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE product_variants
  SET stock_quantity = GREATEST(0, stock_quantity - p_quantity)
  WHERE id = p_variant_id;
$$;
