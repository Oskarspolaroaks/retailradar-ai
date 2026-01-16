CREATE OR REPLACE FUNCTION public.get_weekly_sales_summary(p_tenant_id uuid, p_week_end date)
 RETURNS TABLE(product_id uuid, product_name text, product_sku text, product_brand text, category_name text, units_sold numeric, gross_margin numeric, stock_end numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_week_start DATE;
BEGIN
    -- Calculate week start (Monday) from week end (Sunday)
    v_week_start := p_week_end - INTERVAL '6 days';
    
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.brand as product_brand,
        c.name as category_name,
        COALESCE(SUM(sd.units_sold), 0) as units_sold,
        COALESCE(SUM(
            (COALESCE(sd.selling_price, 0) / (1 + COALESCE(p.vat_rate, 0) / 100) * sd.units_sold) 
            - (COALESCE(sd.purchase_price, 0) * sd.units_sold)
        ), 0) as gross_margin,
        COALESCE((
            SELECT SUM(ws_inner.stock_quantity)
            FROM weekly_stock_snapshots ws_inner
            WHERE ws_inner.product_id = p.id 
              AND ws_inner.tenant_id = p_tenant_id
              AND ws_inner.week_end = p_week_end
        ), 0) as stock_end
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sales_daily sd ON sd.product_id = p.id 
        AND sd.tenant_id = p_tenant_id
        AND sd.reg_date >= v_week_start
        AND sd.reg_date <= p_week_end
    WHERE p.tenant_id = p_tenant_id
        AND p.status = 'active'
    GROUP BY p.id, p.name, p.sku, p.brand, c.name
    HAVING SUM(sd.units_sold) > 0 OR EXISTS (
        SELECT 1 FROM weekly_stock_snapshots ws_check 
        WHERE ws_check.product_id = p.id 
          AND ws_check.tenant_id = p_tenant_id 
          AND ws_check.week_end = p_week_end
    );
END;
$function$;