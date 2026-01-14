-- Create weekly stock snapshots table to store end-of-week stock levels
CREATE TABLE public.weekly_stock_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    week_end DATE NOT NULL,
    stock_quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, product_id, week_end)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_stock_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant access
CREATE POLICY "Users can view their tenant stock snapshots"
ON public.weekly_stock_snapshots
FOR SELECT
USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Users can insert their tenant stock snapshots"
ON public.weekly_stock_snapshots
FOR INSERT
WITH CHECK (public.has_tenant_access(tenant_id));

CREATE POLICY "Users can update their tenant stock snapshots"
ON public.weekly_stock_snapshots
FOR UPDATE
USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Users can delete their tenant stock snapshots"
ON public.weekly_stock_snapshots
FOR DELETE
USING (public.has_tenant_access(tenant_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_weekly_stock_snapshots_updated_at
BEFORE UPDATE ON public.weekly_stock_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_weekly_stock_snapshots_tenant_week ON public.weekly_stock_snapshots(tenant_id, week_end);
CREATE INDEX idx_weekly_stock_snapshots_product ON public.weekly_stock_snapshots(product_id);

-- Create RPC function to get weekly sales aggregation from sales_daily
CREATE OR REPLACE FUNCTION public.get_weekly_sales_summary(
    p_tenant_id UUID,
    p_week_end DATE
)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    product_sku TEXT,
    product_brand TEXT,
    category_name TEXT,
    units_sold NUMERIC,
    gross_margin NUMERIC,
    stock_end NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        COALESCE(ws.stock_quantity, 0) as stock_end
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sales_daily sd ON sd.product_id = p.id 
        AND sd.tenant_id = p_tenant_id
        AND sd.reg_date >= v_week_start
        AND sd.reg_date <= p_week_end
    LEFT JOIN weekly_stock_snapshots ws ON ws.product_id = p.id 
        AND ws.tenant_id = p_tenant_id
        AND ws.week_end = p_week_end
    WHERE p.tenant_id = p_tenant_id
        AND p.status = 'active'
    GROUP BY p.id, p.name, p.sku, p.brand, c.name, ws.stock_quantity
    HAVING SUM(sd.units_sold) > 0 OR ws.stock_quantity > 0;
END;
$$;

-- Create RPC function to get available week ends from sales_daily data
CREATE OR REPLACE FUNCTION public.get_available_weeks(p_tenant_id UUID)
RETURNS TABLE(week_end DATE, record_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        -- Calculate Sunday as week end (ISO week ends on Sunday for retail)
        (DATE_TRUNC('week', sd.reg_date) + INTERVAL '6 days')::DATE as week_end,
        COUNT(*) as record_count
    FROM sales_daily sd
    WHERE sd.tenant_id = p_tenant_id
    GROUP BY DATE_TRUNC('week', sd.reg_date)
    ORDER BY week_end DESC;
$$;