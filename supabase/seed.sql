-- =============================================================================
-- Color of Nature — Seed Data: Fashion Products
-- Run AFTER migrations. Inserts dummy products, variants, and images.
-- =============================================================================

-- ─── Products ─────────────────────────────────────────────────────────────────
insert into public.products (odoo_product_id, name, description, price, image_url, category, in_stock) values
  (1001, 'Ivory Linen Wrap Dress',      'A fluid ivory wrap dress cut from 100% organic linen. Features a deep V-neck, self-tie waist, and midi length. Naturally breathable and effortlessly elegant.', 8500.00,  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop', 'Dresses',  true),
  (1002, 'Charcoal Oversized Blazer',   'A deconstructed oversized blazer in soft charcoal wool-linen blend. Relaxed shoulders, notched lapels, and a single-button front make it a versatile layering piece.', 14200.00, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop', 'Blazers',  true),
  (1003, 'Camel Knit Cardigan',         'A relaxed-fit cardigan knitted in fine merino wool. Deep camel tone, ribbed trims, and a drop-shoulder silhouette. An essential transitional layer.', 7200.00,  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop', 'Knitwear', true),
  (1004, 'Forest Green Silk Blouse',    'Bias-cut silk charmeuse blouse in a deep forest-green. An understated elegance with a relaxed collar and subtle sheen that moves beautifully.', 6800.00,  'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?w=800&auto=format&fit=crop', 'Tops',     true),
  (1005, 'Stone Wide-Leg Trousers',     'Tailored wide-leg trousers in stone-hued cotton twill. High-rise waist, subtle pleat front, and a clean leg line that works from morning meetings to evening events.', 9500.00,  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop', 'Trousers', true),
  (1006, 'Noir Slip Midi Dress',        'A minimalist slip dress in washed-silk satin. Deep noir, adjustable straps, and a midi length that skims the silhouette with quiet confidence.', 11000.00, 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800&auto=format&fit=crop', 'Dresses',  true),
  (1007, 'Ecru Linen Shirt',            'A classic long-sleeve shirt in stonewashed linen. Ecru tone, relaxed chest pocket, and a curved hem. Dress it up or tuck it in for any occasion.', 5500.00,  'https://images.unsplash.com/photo-1614093302611-8efc8c42c0d0?w=800&auto=format&fit=crop', 'Tops',     true),
  (1008, 'Terracotta Knit Co-ord Set',  'A matching rib-knit two-piece in warm terracotta. Includes a fitted long-sleeve top and a high-rise midi skirt. Deep earth tones for the modern wardrobe.', 13500.00, 'https://images.unsplash.com/photo-1616671276441-2f2c277b8bf6?w=800&auto=format&fit=crop', 'Sets',     true),
  (1009, 'Oat Cashmere Turtleneck',     'Luxuriously soft cashmere turtleneck in a warm oat tone. Fine-gauge knit with a relaxed but polished silhouette. An investment in timeless warmth.', 18000.00, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop', 'Knitwear', true),
  (1010, 'Midnight Blue Trench Coat',   'A structured trench coat in midnight blue cotton-gabardine. Double-breasted, belted waist, storm flap, and a sweeping length — a silhouette born from tradition.', 24000.00, 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop', 'Outerwear',true),
  (1011, 'Dusty Rose Pleated Skirt',    'A floor-length pleated skirt in silk chiffon. Soft dusty rose, fluid movement, and an elastic waist for effortless wear.', 7800.00,  'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop', 'Skirts',   true),
  (1012, 'Black Straight-Leg Jeans',    'Precision-cut straight-leg jeans in deep Japanese selvedge denim. High rise, clean pockets, and a leg that falls perfectly.', 8900.00,  'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop', 'Denim',    true);


-- ─── Product Variants ─────────────────────────────────────────────────────────
-- Ivory Linen Wrap Dress (id=1 if fresh db, using subquery to be safe)
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1001-XS-IVY', 'XS', 'Ivory', '#FFFFF0',  5, 0.00 from public.products where odoo_product_id = 1001 union all
select id, 'CON-1001-S-IVY',  'S',  'Ivory', '#FFFFF0', 10, 0.00 from public.products where odoo_product_id = 1001 union all
select id, 'CON-1001-M-IVY',  'M',  'Ivory', '#FFFFF0',  8, 0.00 from public.products where odoo_product_id = 1001 union all
select id, 'CON-1001-L-IVY',  'L',  'Ivory', '#FFFFF0',  4, 0.00 from public.products where odoo_product_id = 1001 union all
select id, 'CON-1001-XL-IVY', 'XL', 'Ivory', '#FFFFF0',  2, 0.00 from public.products where odoo_product_id = 1001;

-- Charcoal Oversized Blazer
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1002-XS-CHR', 'XS', 'Charcoal', '#36454F',  3, 0.00 from public.products where odoo_product_id = 1002 union all
select id, 'CON-1002-S-CHR',  'S',  'Charcoal', '#36454F',  6, 0.00 from public.products where odoo_product_id = 1002 union all
select id, 'CON-1002-M-CHR',  'M',  'Charcoal', '#36454F',  7, 0.00 from public.products where odoo_product_id = 1002 union all
select id, 'CON-1002-L-CHR',  'L',  'Charcoal', '#36454F',  5, 0.00 from public.products where odoo_product_id = 1002;

-- Camel Knit Cardigan  
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1003-XS-CAM', 'XS', 'Camel', '#C19A6B',  4, 0.00 from public.products where odoo_product_id = 1003 union all
select id, 'CON-1003-S-CAM',  'S',  'Camel', '#C19A6B',  9, 0.00 from public.products where odoo_product_id = 1003 union all
select id, 'CON-1003-M-CAM',  'M',  'Camel', '#C19A6B', 11, 0.00 from public.products where odoo_product_id = 1003 union all
select id, 'CON-1003-L-CAM',  'L',  'Camel', '#C19A6B',  6, 0.00 from public.products where odoo_product_id = 1003;

-- Stone Wide-Leg Trousers
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1005-XS-STN', 'XS', 'Stone', '#C2B9A7',  3, 0.00 from public.products where odoo_product_id = 1005 union all
select id, 'CON-1005-S-STN',  'S',  'Stone', '#C2B9A7',  7, 0.00 from public.products where odoo_product_id = 1005 union all
select id, 'CON-1005-M-STN',  'M',  'Stone', '#C2B9A7',  8, 0.00 from public.products where odoo_product_id = 1005 union all
select id, 'CON-1005-L-STN',  'L',  'Stone', '#C2B9A7',  5, 0.00 from public.products where odoo_product_id = 1005 union all
select id, 'CON-1005-XL-STN', 'XL', 'Stone', '#C2B9A7',  2, 0.00 from public.products where odoo_product_id = 1005;

-- Noir Slip Midi Dress
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1006-XS-NR', 'XS', 'Noir', '#1a1a18',  5, 0.00 from public.products where odoo_product_id = 1006 union all
select id, 'CON-1006-S-NR',  'S',  'Noir', '#1a1a18', 8,  0.00 from public.products where odoo_product_id = 1006 union all
select id, 'CON-1006-M-NR',  'M',  'Noir', '#1a1a18',  6, 0.00 from public.products where odoo_product_id = 1006 union all
select id, 'CON-1006-L-NR',  'L',  'Noir', '#1a1a18',  3, 0.00 from public.products where odoo_product_id = 1006;

-- Oat Cashmere Turtleneck
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1009-S-OAT',  'S',  'Oat', '#D5C5A1',  4, 0.00 from public.products where odoo_product_id = 1009 union all
select id, 'CON-1009-M-OAT',  'M',  'Oat', '#D5C5A1',  6, 0.00 from public.products where odoo_product_id = 1009 union all
select id, 'CON-1009-L-OAT',  'L',  'Oat', '#D5C5A1',  4, 0.00 from public.products where odoo_product_id = 1009;

-- Midnight Blue Trench Coat
insert into public.product_variants (product_id, sku, size, color, color_hex, stock_quantity, price_adjustment)
select id, 'CON-1010-S-MDB',  'S',  'Midnight Blue', '#191970',  2, 0.00 from public.products where odoo_product_id = 1010 union all
select id, 'CON-1010-M-MDB',  'M',  'Midnight Blue', '#191970',  4, 0.00 from public.products where odoo_product_id = 1010 union all
select id, 'CON-1010-L-MDB',  'L',  'Midnight Blue', '#191970',  3, 0.00 from public.products where odoo_product_id = 1010;


-- ─── Product Images ───────────────────────────────────────────────────────────
insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop', 'Ivory Linen Wrap Dress front', 1, true from public.products where odoo_product_id = 1001 union all
select id, 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop', 'Ivory Linen Wrap Dress side',  2, false from public.products where odoo_product_id = 1001;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop', 'Charcoal Oversized Blazer front', 1, true from public.products where odoo_product_id = 1002 union all
select id, 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop', 'Charcoal Oversized Blazer detail', 2, false from public.products where odoo_product_id = 1002;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop', 'Camel Knit Cardigan front', 1, true from public.products where odoo_product_id = 1003;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?w=800&auto=format&fit=crop', 'Forest Green Silk Blouse', 1, true from public.products where odoo_product_id = 1004;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop', 'Stone Wide-Leg Trousers front', 1, true from public.products where odoo_product_id = 1005;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800&auto=format&fit=crop', 'Noir Slip Midi Dress', 1, true from public.products where odoo_product_id = 1006;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1614093302611-8efc8c42c0d0?w=800&auto=format&fit=crop', 'Ecru Linen Shirt', 1, true from public.products where odoo_product_id = 1007;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1616671276441-2f2c277b8bf6?w=800&auto=format&fit=crop', 'Terracotta Knit Co-ord Set', 1, true from public.products where odoo_product_id = 1008;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop', 'Oat Cashmere Turtleneck', 1, true from public.products where odoo_product_id = 1009;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop', 'Midnight Blue Trench Coat', 1, true from public.products where odoo_product_id = 1010;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop', 'Dusty Rose Pleated Skirt', 1, true from public.products where odoo_product_id = 1011;

insert into public.product_images (product_id, image_url, alt_text, display_order, is_primary)
select id, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop', 'Black Straight-Leg Jeans', 1, true from public.products where odoo_product_id = 1012;
