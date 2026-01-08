-- Noņem product_name kolonnu no weekly_sales tabulas
-- Turpmāk produkta nosaukums tiks lasīts no products.name caur product_id relāciju
ALTER TABLE public.weekly_sales DROP COLUMN product_name;