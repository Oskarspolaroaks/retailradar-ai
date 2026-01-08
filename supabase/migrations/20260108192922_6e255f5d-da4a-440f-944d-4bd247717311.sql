-- Drop the category column from products table
ALTER TABLE public.products DROP COLUMN IF EXISTS category;