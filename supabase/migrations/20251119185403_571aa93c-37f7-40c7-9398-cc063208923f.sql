-- Fix function search paths for security (without dropping)
CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;