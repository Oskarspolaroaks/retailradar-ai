-- Create weekly_sales table for partner sales data
CREATE TABLE public.weekly_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  partner TEXT NOT NULL,
  product_id UUID,
  product_name TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('LW', 'PW')),
  week_end DATE NOT NULL,
  units_sold NUMERIC NOT NULL DEFAULT 0,
  gross_margin NUMERIC NOT NULL DEFAULT 0,
  stock_end NUMERIC,
  mapped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_weekly_sales_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL,
  CONSTRAINT fk_weekly_sales_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Create index for better query performance
CREATE INDEX idx_weekly_sales_tenant_id ON public.weekly_sales(tenant_id);
CREATE INDEX idx_weekly_sales_product_id ON public.weekly_sales(product_id);
CREATE INDEX idx_weekly_sales_week_end ON public.weekly_sales(week_end);
CREATE INDEX idx_weekly_sales_partner ON public.weekly_sales(partner);

-- Enable RLS
ALTER TABLE public.weekly_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view weekly sales in their tenants"
  ON public.weekly_sales
  FOR SELECT
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage weekly sales"
  ON public.weekly_sales
  FOR ALL
  USING (
    has_tenant_role(tenant_id, 'admin') OR 
    has_tenant_role(tenant_id, 'owner') OR
    has_tenant_role(tenant_id, 'manager')
  );

-- Add trigger for updated_at
CREATE TRIGGER update_weekly_sales_updated_at
  BEFORE UPDATE ON public.weekly_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();