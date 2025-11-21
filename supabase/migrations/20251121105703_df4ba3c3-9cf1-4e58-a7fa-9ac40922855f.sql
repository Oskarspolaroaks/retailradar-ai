-- Create competitor_product_mapping table for AI-powered product matching
CREATE TABLE IF NOT EXISTS competitor_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  our_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  competitor_product_url TEXT,
  competitor_product_name TEXT NOT NULL,
  competitor_product_sku TEXT,
  competitor_brand TEXT,
  competitor_size TEXT,
  ai_similarity_score NUMERIC CHECK (ai_similarity_score >= 0 AND ai_similarity_score <= 1),
  mapping_status TEXT NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('auto_matched', 'user_approved', 'rejected', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(our_product_id, competitor_id, competitor_product_url)
);

-- Create scrape_jobs table for background job orchestration
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('catalog', 'promotions', 'initial_scan')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scraped_products_count INTEGER DEFAULT 0,
  matched_products_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create competitor_promotions table for leaflets and flyers
CREATE TABLE IF NOT EXISTS competitor_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'image', 'html', 'url')),
  source_url TEXT,
  file_path TEXT,
  valid_from DATE,
  valid_to DATE,
  processed BOOLEAN NOT NULL DEFAULT false,
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create competitor_promotion_items table for parsed promotion products
CREATE TABLE IF NOT EXISTS competitor_promotion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES competitor_promotions(id) ON DELETE CASCADE,
  competitor_product_name TEXT NOT NULL,
  competitor_product_url TEXT,
  competitor_brand TEXT,
  competitor_size TEXT,
  regular_price NUMERIC,
  promo_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  unit_price NUMERIC,
  promo_label TEXT,
  linked_mapping_id UUID REFERENCES competitor_product_mapping(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add scraping_url to competitors table if not exists
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS scraping_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS last_catalog_scrape TIMESTAMPTZ;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS last_promo_scrape TIMESTAMPTZ;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_product_mapping_our_product ON competitor_product_mapping(our_product_id);
CREATE INDEX IF NOT EXISTS idx_competitor_product_mapping_competitor ON competitor_product_mapping(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_product_mapping_status ON competitor_product_mapping(mapping_status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_competitor ON scrape_jobs(competitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_promotions_competitor ON competitor_promotions(competitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_promotion_items_promotion ON competitor_promotion_items(promotion_id);
CREATE INDEX IF NOT EXISTS idx_competitor_promotion_items_mapping ON competitor_promotion_items(linked_mapping_id);

-- Enable RLS
ALTER TABLE competitor_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_promotion_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for competitor_product_mapping
CREATE POLICY "Users can view mappings"
  ON competitor_product_mapping FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage mappings"
  ON competitor_product_mapping FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for scrape_jobs
CREATE POLICY "Users can view jobs"
  ON scrape_jobs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage jobs"
  ON scrape_jobs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for competitor_promotions
CREATE POLICY "Users can view promotions"
  ON competitor_promotions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage promotions"
  ON competitor_promotions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for competitor_promotion_items
CREATE POLICY "Users can view promotion items"
  ON competitor_promotion_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage promotion items"
  ON competitor_promotion_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));