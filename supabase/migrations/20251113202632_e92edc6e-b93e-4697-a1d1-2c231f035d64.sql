-- Add new fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS abc_category TEXT CHECK (abc_category IN ('A', 'B', 'C')),
ADD COLUMN IF NOT EXISTS is_private_label BOOLEAN DEFAULT false;

-- Create settings table for ABC configuration
CREATE TABLE IF NOT EXISTS public.abc_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_period_days INTEGER NOT NULL DEFAULT 90 CHECK (analysis_period_days IN (30, 90, 365)),
    threshold_a_percent NUMERIC NOT NULL DEFAULT 80 CHECK (threshold_a_percent > 0 AND threshold_a_percent <= 100),
    threshold_b_percent NUMERIC NOT NULL DEFAULT 15 CHECK (threshold_b_percent > 0 AND threshold_b_percent <= 100),
    threshold_c_percent NUMERIC NOT NULL DEFAULT 5 CHECK (threshold_c_percent > 0 AND threshold_c_percent <= 100),
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on abc_settings
ALTER TABLE public.abc_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view settings
CREATE POLICY "Authenticated users can view ABC settings" ON public.abc_settings
    FOR SELECT TO authenticated
    USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update ABC settings" ON public.abc_settings
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert ABC settings" ON public.abc_settings
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert default settings if none exist
INSERT INTO public.abc_settings (analysis_period_days, threshold_a_percent, threshold_b_percent, threshold_c_percent)
SELECT 90, 80, 15, 5
WHERE NOT EXISTS (SELECT 1 FROM public.abc_settings);

-- Create index on abc_category for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_abc_category ON public.products(abc_category);

-- Create index on is_private_label for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_private_label ON public.products(is_private_label);

-- Add trigger for updated_at on abc_settings
CREATE TRIGGER update_abc_settings_updated_at
    BEFORE UPDATE ON public.abc_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();