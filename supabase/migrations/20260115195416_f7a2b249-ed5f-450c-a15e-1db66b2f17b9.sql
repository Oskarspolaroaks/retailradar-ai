-- Drop existing unique constraint
ALTER TABLE public.weekly_stock_snapshots 
DROP CONSTRAINT IF EXISTS weekly_stock_snapshots_tenant_id_product_id_week_end_key;

-- Create new unique constraint including store_id
ALTER TABLE public.weekly_stock_snapshots 
ADD CONSTRAINT weekly_stock_snapshots_tenant_id_product_id_week_end_store_id_key 
UNIQUE (tenant_id, product_id, week_end, store_id);