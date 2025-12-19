-- Create KPI targets table for company and store level KPIs
CREATE TABLE public.kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('company', 'store')),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  kpi_name TEXT NOT NULL,
  kpi_category TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  unit TEXT DEFAULT '%',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_store_scope CHECK (
    (scope = 'company' AND store_id IS NULL) OR
    (scope = 'store' AND store_id IS NOT NULL)
  )
);

-- Create onboarding status table
CREATE TABLE public.tenant_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  kpi_setup_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create AI recommendations table
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  insight TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  expected_impact TEXT,
  impact_category TEXT,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kpi_targets
CREATE POLICY "Users can view KPI targets in their tenants"
ON public.kpi_targets FOR SELECT
USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage KPI targets"
ON public.kpi_targets FOR ALL
USING (has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for tenant_onboarding
CREATE POLICY "Users can view onboarding status in their tenants"
ON public.tenant_onboarding FOR SELECT
USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage onboarding status"
ON public.tenant_onboarding FOR ALL
USING (has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- RLS Policies for ai_recommendations
CREATE POLICY "Users can view AI recommendations in their tenants"
ON public.ai_recommendations FOR SELECT
USING (has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage AI recommendations"
ON public.ai_recommendations FOR ALL
USING (has_tenant_role(tenant_id, 'admin') OR has_tenant_role(tenant_id, 'owner'));

-- Create updated_at trigger for kpi_targets
CREATE TRIGGER update_kpi_targets_updated_at
BEFORE UPDATE ON public.kpi_targets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();