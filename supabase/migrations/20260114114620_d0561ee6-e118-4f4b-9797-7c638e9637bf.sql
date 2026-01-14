-- Drop and recreate get_store_sales_summary with receipt data
DROP FUNCTION IF EXISTS get_store_sales_summary(date, date);

CREATE OR REPLACE FUNCTION get_store_sales_summary(p_date_from date, p_date_to date DEFAULT NULL)
RETURNS TABLE (
  store_id uuid,
  total_revenue numeric,
  total_units numeric,
  receipt_count bigint,
  avg_receipt numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH store_receipts AS (
    SELECT 
      sd.store_id as s_id,
      sd.id_receipt,
      SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold) as receipt_total
    FROM sales_daily sd
    LEFT JOIN products p ON sd.product_id = p.id
    WHERE sd.reg_date >= p_date_from 
      AND sd.reg_date <= COALESCE(p_date_to, p_date_from)
      AND sd.id_receipt IS NOT NULL
    GROUP BY sd.store_id, sd.id_receipt
  )
  SELECT 
    sd.store_id,
    COALESCE(SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold), 0) as total_revenue,
    COALESCE(SUM(sd.units_sold), 0) as total_units,
    (SELECT COUNT(DISTINCT sr.id_receipt) FROM store_receipts sr WHERE sr.s_id = sd.store_id) as receipt_count,
    CASE 
      WHEN (SELECT COUNT(DISTINCT sr.id_receipt) FROM store_receipts sr WHERE sr.s_id = sd.store_id) > 0 
      THEN (SELECT SUM(sr.receipt_total) FROM store_receipts sr WHERE sr.s_id = sd.store_id) / (SELECT COUNT(DISTINCT sr.id_receipt) FROM store_receipts sr WHERE sr.s_id = sd.store_id)
      ELSE 0 
    END as avg_receipt
  FROM sales_daily sd
  LEFT JOIN products p ON sd.product_id = p.id
  WHERE sd.reg_date >= p_date_from 
    AND sd.reg_date <= COALESCE(p_date_to, p_date_from)
  GROUP BY sd.store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;