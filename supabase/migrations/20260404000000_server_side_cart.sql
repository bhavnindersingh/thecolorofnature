-- ─── Server-side Cart ────────────────────────────────────────────────────────
-- Stores cart items for logged-in users in the database.
-- Anonymous users continue using localStorage (no change to that flow).
-- On login, the frontend merges localStorage cart into this table then clears local.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cart_items (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES profiles(id)          ON DELETE CASCADE,
  product_id bigint  NOT NULL REFERENCES products(id)          ON DELETE CASCADE,
  variant_id bigint           REFERENCES product_variants(id)  ON DELETE SET NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id, variant_id)
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_cart_item_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cart_item_updated
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_cart_item_timestamp();

-- RLS: users can only see and modify their own cart
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart" ON cart_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
