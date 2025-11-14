-- Create competitor_promotions table
CREATE TABLE public.competitor_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE NOT NULL,
  product_category TEXT,
  promotion_name TEXT NOT NULL,
  description TEXT,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  start_date DATE NOT NULL,
  end_date DATE,
  image_url TEXT,
  slogan TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competitor_promotions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view promotions"
  ON public.competitor_promotions
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage promotions"
  ON public.competitor_promotions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_competitor_promotions_updated_at
  BEFORE UPDATE ON public.competitor_promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for performance
CREATE INDEX idx_competitor_promotions_competitor_id ON public.competitor_promotions(competitor_id);
CREATE INDEX idx_competitor_promotions_dates ON public.competitor_promotions(start_date, end_date);
CREATE INDEX idx_competitor_promotions_active ON public.competitor_promotions(is_active);