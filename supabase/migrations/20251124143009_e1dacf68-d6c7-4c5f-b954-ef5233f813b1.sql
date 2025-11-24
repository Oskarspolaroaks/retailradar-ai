-- Price Elasticity Table
CREATE TABLE IF NOT EXISTS public.product_price_elasticity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  elasticity_coefficient NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sensitivity_label TEXT NOT NULL CHECK (sensitivity_label IN ('inelastic', 'normal', 'highly_elastic')),
  data_points INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Smart Price Configuration Table
CREATE TABLE IF NOT EXISTS public.smart_price_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  global_min_margin_percent NUMERIC NOT NULL DEFAULT 15,
  abc_a_max_discount_percent NUMERIC NOT NULL DEFAULT 10,
  abc_b_max_discount_percent NUMERIC NOT NULL DEFAULT 20,
  abc_c_max_discount_percent NUMERIC NOT NULL DEFAULT 30,
  match_competitor_promo BOOLEAN NOT NULL DEFAULT true,
  never_below_competitor_min BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Category Roles Table (for Symphony module)
CREATE TABLE IF NOT EXISTS public.category_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_margin NUMERIC NOT NULL DEFAULT 0,
  total_units NUMERIC NOT NULL DEFAULT 0,
  sku_count INTEGER NOT NULL DEFAULT 0,
  slow_movers_count INTEGER NOT NULL DEFAULT 0,
  promo_revenue_share NUMERIC NOT NULL DEFAULT 0,
  avg_rotation_days NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update products table to add category_role column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_role TEXT CHECK (category_role IN ('traffic_builder', 'margin_driver', 'image_builder', 'long_tail', 'other'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_elasticity_product ON public.product_price_elasticity(product_id);
CREATE INDEX IF NOT EXISTS idx_elasticity_tenant ON public.product_price_elasticity(tenant_id);
CREATE INDEX IF NOT EXISTS idx_category_metrics_category ON public.category_metrics(category);
CREATE INDEX IF NOT EXISTS idx_category_metrics_tenant ON public.category_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_role ON public.products(category_role);

-- RLS Policies for product_price_elasticity
ALTER TABLE public.product_price_elasticity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view elasticity in their tenants"
  ON public.product_price_elasticity
  FOR SELECT
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage elasticity"
  ON public.product_price_elasticity
  FOR ALL
  USING (has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for smart_price_config
ALTER TABLE public.smart_price_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view smart price config in their tenants"
  ON public.smart_price_config
  FOR SELECT
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage smart price config"
  ON public.smart_price_config
  FOR ALL
  USING (has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for category_metrics
ALTER TABLE public.category_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view category metrics in their tenants"
  ON public.category_metrics
  FOR SELECT
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Managers can manage category metrics"
  ON public.category_metrics
  FOR ALL
  USING (has_tenant_role(tenant_id, 'manager') OR has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- Trigger for updated_at
CREATE TRIGGER update_product_price_elasticity_updated_at
  BEFORE UPDATE ON public.product_price_elasticity
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_smart_price_config_updated_at
  BEFORE UPDATE ON public.smart_price_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_category_metrics_updated_at
  BEFORE UPDATE ON public.category_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();