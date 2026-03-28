-- Function called by odoo-webhook after a stock_update event.
-- Recalculates products.in_stock based on sum of product_variants.stock_quantity.

CREATE OR REPLACE FUNCTION public.recalculate_product_stock()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.products p
  SET in_stock = (
    SELECT COALESCE(SUM(pv.stock_quantity), 0) > 0
    FROM public.product_variants pv
    WHERE pv.product_id = p.id
  );
$$;
