-- Fix SECURITY DEFINER functions to enforce tenant isolation
-- All functions will require p_tenant_id parameter and filter data accordingly

-- 1. Fix get_sales_summary - add tenant_id filter
CREATE OR REPLACE FUNCTION public.get_sales_summary(p_tenant_id uuid, p_date_from date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(total_revenue numeric, total_costs numeric, total_units numeric, transaction_count bigint, receipt_count bigint, avg_receipt numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user has access to this tenant
  IF NOT public.has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied: user does not have access to tenant %', p_tenant_id;
  END IF;

  RETURN QUERY
  WITH receipt_totals AS (
    SELECT 
      sd.id_receipt,
      SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold) as receipt_total
    FROM sales_daily sd
    LEFT JOIN products p ON sd.product_id = p.id
    WHERE sd.tenant_id = p_tenant_id
      AND sd.reg_date >= p_date_from 
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
  WHERE sd.tenant_id = p_tenant_id
    AND sd.reg_date >= p_date_from 
    AND sd.reg_date <= COALESCE(p_date_to, p_date_from);
END;
$function$;

-- 2. Fix get_products_abc_distribution - add tenant_id filter
CREATE OR REPLACE FUNCTION public.get_products_abc_distribution(p_tenant_id uuid)
 RETURNS TABLE(abc_category text, product_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(abc_category, 'Unassigned') as abc_category,
    COUNT(*) as product_count
  FROM products
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND public.has_tenant_access(p_tenant_id)
  GROUP BY abc_category;
$function$;

-- 3. Fix get_abc_revenue_breakdown - add tenant_id filter
CREATE OR REPLACE FUNCTION public.get_abc_revenue_breakdown(p_tenant_id uuid, p_date_from date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(abc_category text, revenue numeric, product_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(p.abc_category, 'Unassigned') as abc_category,
    COALESCE(SUM((sd.selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * sd.units_sold), 0) as revenue,
    COUNT(DISTINCT p.id) as product_count
  FROM products p
  LEFT JOIN sales_daily sd ON sd.product_id = p.id 
    AND sd.tenant_id = p_tenant_id
    AND sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to)
  WHERE p.tenant_id = p_tenant_id
    AND p.status = 'active'
    AND public.has_tenant_access(p_tenant_id)
  GROUP BY p.abc_category;
$function$;

-- 4. Fix get_store_sales_summary - add tenant_id filter
CREATE OR REPLACE FUNCTION public.get_store_sales_summary(p_tenant_id uuid, p_date_from date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(store_id uuid, total_revenue numeric, total_units numeric, receipt_count bigint, avg_receipt numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user has access to this tenant
  IF NOT public.has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied: user does not have access to tenant %', p_tenant_id;
  END IF;

  RETURN QUERY
  WITH store_receipts AS (
    SELECT 
      sd.store_id as s_id,
      sd.id_receipt,
      SUM(COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold) as receipt_total
    FROM sales_daily sd
    LEFT JOIN products p ON sd.product_id = p.id
    WHERE sd.tenant_id = p_tenant_id
      AND sd.reg_date >= p_date_from 
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
  WHERE sd.tenant_id = p_tenant_id
    AND sd.reg_date >= p_date_from 
    AND sd.reg_date <= COALESCE(p_date_to, p_date_from)
  GROUP BY sd.store_id;
END;
$function$;

-- 5. Fix get_category_sales_summary - add tenant_id filter
CREATE OR REPLACE FUNCTION public.get_category_sales_summary(p_tenant_id uuid, p_date_from date, p_date_to date DEFAULT NULL::date)
 RETURNS TABLE(category_name text, total_revenue numeric, total_units numeric, product_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(SUM((sd.selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * sd.units_sold), 0) as total_revenue,
    COALESCE(SUM(sd.units_sold), 0) as total_units,
    COUNT(DISTINCT p.id) as product_count
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN sales_daily sd ON sd.product_id = p.id 
    AND sd.tenant_id = p_tenant_id
    AND sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to)
  WHERE p.tenant_id = p_tenant_id
    AND p.status = 'active'
    AND public.has_tenant_access(p_tenant_id)
  GROUP BY c.name;
$function$;