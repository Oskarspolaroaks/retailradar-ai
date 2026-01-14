-- Drop and recreate get_sales_summary with proper avgReceipt calculation
DROP FUNCTION IF EXISTS get_sales_summary(date, date);

CREATE OR REPLACE FUNCTION get_sales_summary(p_date_from date, p_date_to date DEFAULT NULL)
RETURNS TABLE (
  total_revenue numeric,
  total_costs numeric,
  total_units numeric,
  transaction_count bigint,
  receipt_count bigint,
  avg_receipt numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH receipt_totals AS (
    SELECT 
      sd.id_receipt,
      SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold) as receipt_total
    FROM sales_daily sd
    LEFT JOIN products p ON sd.product_id = p.id
    WHERE sd.reg_date >= p_date_from 
      AND sd.reg_date <= COALESCE(p_date_to, p_date_from)
      AND sd.id_receipt IS NOT NULL
    GROUP BY sd.id_receipt
  )
  SELECT 
    COALESCE(SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold), 0) as total_revenue,
    COALESCE(SUM(COALESCE(sd.purchase_price, 0) * sd.units_sold), 0) as total_costs,
    COALESCE(SUM(sd.units_sold), 0) as total_units,
    COUNT(*) as transaction_count,
    (SELECT COUNT(DISTINCT rt.id_receipt) FROM receipt_totals rt) as receipt_count,
    CASE 
      WHEN (SELECT COUNT(DISTINCT rt.id_receipt) FROM receipt_totals rt) > 0 
      THEN (SELECT SUM(rt.receipt_total) FROM receipt_totals rt) / (SELECT COUNT(DISTINCT rt.id_receipt) FROM receipt_totals rt)
      ELSE 0 
    END as avg_receipt
  FROM sales_daily sd
  LEFT JOIN products p ON sd.product_id = p.id
  WHERE sd.reg_date >= p_date_from 
    AND sd.reg_date <= COALESCE(p_date_to, p_date_from);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;