-- RetailRadar AI: Multi-tenant retail analytics platform
-- Drop existing tables that will be replaced (in correct order to avoid FK issues)
DROP TABLE IF EXISTS competitor_prices CASCADE;
DROP TABLE IF EXISTS competitor_product_mapping CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS price_recommendations CASCADE;
DROP TABLE IF EXISTS competitor_promotions CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;

-- 1. TENANTS & MULTI-TENANT USERS
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'analyst', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- 2. STORES
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  city TEXT,
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- 3. CATEGORIES (hierarchical)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PRODUCTS (enhanced, keeping existing products table structure but adding tenant_id)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'pcs';
ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Product attributes for flexible metadata
CREATE TABLE public.product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PRICING & PRICE HISTORY
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  regular_price NUMERIC NOT NULL,
  promo_price NUMERIC,
  cost_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PROMOTIONS
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  channel TEXT,
  mechanics TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.promotion_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  promo_price NUMERIC,
  discount_percent NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. LEAFLETS
CREATE TABLE public.leaflets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_pages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leaflet_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaflet_id UUID NOT NULL REFERENCES public.leaflets(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leaflet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaflet_page_id UUID NOT NULL REFERENCES public.leaflet_pages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  position_on_page INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. SALES & STOCK
CREATE TABLE public.sales_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  units_sold NUMERIC NOT NULL,
  revenue NUMERIC NOT NULL,
  regular_price NUMERIC,
  promo_flag BOOLEAN DEFAULT false,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, store_id, product_id, date)
);

CREATE TABLE public.stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stock_units NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, store_id, product_id, date)
);

-- 9. COMPETITORS (enhanced, keeping existing structure)
ALTER TABLE public.competitors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE TABLE public.competitor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  competitor_sku TEXT,
  competitor_name TEXT NOT NULL,
  barcode TEXT,
  our_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  category_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competitor_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competitor_product_id UUID NOT NULL REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price NUMERIC NOT NULL,
  promo_flag BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.market_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_name TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 10. INSIGHTS & RECOMMENDATIONS
CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  date_from DATE,
  date_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  current_price NUMERIC NOT NULL,
  current_cost_price NUMERIC,
  competitor_avg_price NUMERIC,
  recommended_price NUMERIC NOT NULL,
  recommended_change_percent NUMERIC NOT NULL,
  reasoning TEXT,
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'applied', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. IMPORT JOBS
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_name TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_stores_tenant ON public.stores(tenant_id);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_price_history_product ON public.price_history(product_id, valid_from);
CREATE INDEX idx_sales_daily_store_date ON public.sales_daily(store_id, date);
CREATE INDEX idx_sales_daily_product_date ON public.sales_daily(product_id, date);
CREATE INDEX idx_stock_levels_store_date ON public.stock_levels(store_id, date);
CREATE INDEX idx_competitor_products_tenant ON public.competitor_products(tenant_id);
CREATE INDEX idx_competitor_price_history_date ON public.competitor_price_history(date);

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaflets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaflet_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaflet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function to check tenant access
CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  )
$$;

-- Helper function to check tenant role
CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- RLS Policies for tenants
CREATE POLICY "Users can view their tenants"
  ON public.tenants FOR SELECT
  USING (public.has_tenant_access(id));

-- RLS Policies for user_tenants
CREATE POLICY "Users can view their tenant memberships"
  ON public.user_tenants FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for stores
CREATE POLICY "Users can view stores in their tenants"
  ON public.stores FOR SELECT
  USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  USING (public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their tenants"
  ON public.categories FOR SELECT
  USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for sales_daily
CREATE POLICY "Users can view sales in their tenants"
  ON public.sales_daily FOR SELECT
  USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Managers can manage sales data"
  ON public.sales_daily FOR ALL
  USING (public.has_tenant_role(tenant_id, 'manager') OR public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for stock_levels
CREATE POLICY "Users can view stock in their tenants"
  ON public.stock_levels FOR SELECT
  USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Managers can manage stock data"
  ON public.stock_levels FOR ALL
  USING (public.has_tenant_role(tenant_id, 'manager') OR public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for pricing_recommendations
CREATE POLICY "Users can view recommendations in their tenants"
  ON public.pricing_recommendations FOR SELECT
  USING (public.has_tenant_access(tenant_id));

CREATE POLICY "Managers can manage recommendations"
  ON public.pricing_recommendations FOR ALL
  USING (public.has_tenant_role(tenant_id, 'manager') OR public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'owner'));

-- Apply similar patterns for other tables
CREATE POLICY "Users can view their tenant data" ON public.product_attributes FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.price_history FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.promotions FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.promotion_products FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.leaflets FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.leaflet_pages FOR SELECT USING (EXISTS (SELECT 1 FROM public.leaflets WHERE id = leaflet_id AND public.has_tenant_access(tenant_id)));
CREATE POLICY "Users can view their tenant data" ON public.leaflet_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.leaflet_pages lp JOIN public.leaflets l ON lp.leaflet_id = l.id WHERE lp.id = leaflet_page_id AND public.has_tenant_access(l.tenant_id)));
CREATE POLICY "Users can view their tenant data" ON public.competitor_products FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.competitor_price_history FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.market_import_jobs FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.insights FOR SELECT USING (public.has_tenant_access(tenant_id));
CREATE POLICY "Users can view their tenant data" ON public.import_jobs FOR SELECT USING (public.has_tenant_access(tenant_id));