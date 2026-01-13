-- Function to get sales summary for a date range
CREATE OR REPLACE FUNCTION public.get_sales_summary(
  p_date_from date,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  total_revenue numeric,
  total_costs numeric,
  total_units numeric,
  transaction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM((selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * units_sold), 0) as total_revenue,
    COALESCE(SUM(purchase_price * units_sold), 0) as total_costs,
    COALESCE(SUM(units_sold), 0) as total_units,
    COUNT(*) as transaction_count
  FROM sales_daily sd
  LEFT JOIN products p ON sd.product_id = p.id
  WHERE sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to);
$$;

-- Function to get ABC category distribution from products
CREATE OR REPLACE FUNCTION public.get_products_abc_distribution()
RETURNS TABLE (
  abc_category text,
  product_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(abc_category, 'Unassigned') as abc_category,
    COUNT(*) as product_count
  FROM products
  WHERE status = 'active'
  GROUP BY abc_category;
$$;

-- Function to get ABC revenue breakdown for a date range
CREATE OR REPLACE FUNCTION public.get_abc_revenue_breakdown(
  p_date_from date,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  abc_category text,
  revenue numeric,
  product_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(p.abc_category, 'Unassigned') as abc_category,
    COALESCE(SUM((sd.selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * sd.units_sold), 0) as revenue,
    COUNT(DISTINCT p.id) as product_count
  FROM products p
  LEFT JOIN sales_daily sd ON sd.product_id = p.id 
    AND sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to)
  WHERE p.status = 'active'
  GROUP BY p.abc_category;
$$;

-- Function to get store-level sales summary
CREATE OR REPLACE FUNCTION public.get_store_sales_summary(
  p_date_from date,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  store_id uuid,
  total_revenue numeric,
  total_units numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sd.store_id,
    COALESCE(SUM((sd.selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * sd.units_sold), 0) as total_revenue,
    COALESCE(SUM(sd.units_sold), 0) as total_units
  FROM sales_daily sd
  LEFT JOIN products p ON sd.product_id = p.id
  WHERE sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to)
  GROUP BY sd.store_id;
$$;

-- Function to get category-level sales summary
CREATE OR REPLACE FUNCTION public.get_category_sales_summary(
  p_date_from date,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  category_name text,
  total_revenue numeric,
  total_units numeric,
  product_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(SUM((sd.selling_price / (1 + COALESCE(p.vat_rate, 0) / 100)) * sd.units_sold), 0) as total_revenue,
    COALESCE(SUM(sd.units_sold), 0) as total_units,
    COUNT(DISTINCT p.id) as product_count
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN sales_daily sd ON sd.product_id = p.id 
    AND sd.reg_date >= p_date_from
    AND (p_date_to IS NULL OR sd.reg_date <= p_date_to)
  WHERE p.status = 'active'
  GROUP BY c.name;
$$;