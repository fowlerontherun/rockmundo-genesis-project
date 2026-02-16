
-- Housing market prices per country — tracks a price multiplier that fluctuates gently
CREATE TABLE public.housing_market_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country text NOT NULL UNIQUE,
  price_multiplier numeric(6,4) NOT NULL DEFAULT 1.0000,
  trend text NOT NULL DEFAULT 'stable' CHECK (trend IN ('rising', 'falling', 'stable')),
  trend_strength numeric(4,3) NOT NULL DEFAULT 0.000,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.housing_market_prices ENABLE ROW LEVEL SECURITY;

-- Everyone can read market prices
CREATE POLICY "Anyone can view market prices"
  ON public.housing_market_prices
  FOR SELECT
  USING (true);

-- Only service role can update (via edge function)
CREATE POLICY "Service role can manage market prices"
  ON public.housing_market_prices
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_housing_market_prices_country ON public.housing_market_prices (country);
