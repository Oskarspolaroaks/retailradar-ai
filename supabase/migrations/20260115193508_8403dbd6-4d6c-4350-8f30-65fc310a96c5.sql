-- Add store_id column to weekly_stock_snapshots table
ALTER TABLE public.weekly_stock_snapshots 
ADD COLUMN store_id uuid REFERENCES public.stores(id);