-- Add purchase_price column
ALTER TABLE public.sales_daily ADD COLUMN purchase_price numeric;

-- Rename regular_price to selling_price
ALTER TABLE public.sales_daily RENAME COLUMN regular_price TO selling_price;

-- Drop revenue column
ALTER TABLE public.sales_daily DROP COLUMN revenue;