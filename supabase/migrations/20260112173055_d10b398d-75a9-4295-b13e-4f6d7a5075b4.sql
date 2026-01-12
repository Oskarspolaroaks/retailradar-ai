-- Add id_receipt column to sales_daily table for storing receipt numbers
-- Same receipt number can appear in multiple rows (not unique)
ALTER TABLE public.sales_daily 
ADD COLUMN id_receipt text;