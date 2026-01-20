-- Brand Partners table - companies that can collaborate with bands
CREATE TABLE public.merch_brand_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_tier TEXT NOT NULL CHECK (brand_tier IN ('indie', 'mainstream', 'premium', 'luxury')) DEFAULT 'indie',
  description TEXT,
  min_fame_required INTEGER DEFAULT 0,
  min_fans_required INTEGER DEFAULT 0,
  base_upfront_payment INTEGER DEFAULT 1000,
  royalty_percentage NUMERIC(5,2) DEFAULT 5.0,
  quality_boost TEXT DEFAULT 'premium' CHECK (quality_boost IN ('basic', 'standard', 'premium', 'exclusive')),
  sales_boost_pct NUMERIC(5,2) DEFAULT 15.0,
  product_types TEXT[] DEFAULT ARRAY['tshirt', 'hoodie'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collaboration Offers - pending offers from brands to bands
CREATE TABLE public.merch_collaboration_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.merch_brand_partners(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  upfront_payment INTEGER NOT NULL,
  royalty_per_sale NUMERIC(5,2) DEFAULT 0,
  limited_quantity INTEGER,
  offer_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Active Collaborations - accepted partnerships
CREATE TABLE public.merch_collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES public.merch_collaboration_offers(id),
  brand_id UUID NOT NULL REFERENCES public.merch_brand_partners(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  merchandise_id UUID REFERENCES public.player_merchandise(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL,
  quality_tier TEXT NOT NULL,
  sales_boost_pct NUMERIC(5,2) DEFAULT 0,
  total_units_sold INTEGER DEFAULT 0,
  total_royalties_earned NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.merch_brand_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_collaboration_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_collaborations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_partners (read-only for authenticated users)
CREATE POLICY "Anyone can view brand partners" ON public.merch_brand_partners
  FOR SELECT USING (true);

-- RLS Policies for collaboration_offers
CREATE POLICY "Users can view their band collaboration offers" ON public.merch_collaboration_offers
  FOR SELECT USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their band collaboration offers" ON public.merch_collaboration_offers
  FOR UPDATE USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for collaborations
CREATE POLICY "Users can view their band collaborations" ON public.merch_collaborations
  FOR SELECT USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their band collaborations" ON public.merch_collaborations
  FOR INSERT WITH CHECK (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their band collaborations" ON public.merch_collaborations
  FOR UPDATE USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- Add design_preview_url to player_merchandise for custom design integration
ALTER TABLE public.player_merchandise ADD COLUMN IF NOT EXISTS design_preview_url TEXT;
ALTER TABLE public.player_merchandise ADD COLUMN IF NOT EXISTS collaboration_id UUID REFERENCES public.merch_collaborations(id);

-- Seed brand partners data
INSERT INTO public.merch_brand_partners (name, brand_tier, description, min_fame_required, min_fans_required, base_upfront_payment, royalty_percentage, quality_boost, sales_boost_pct, product_types) VALUES
('Streetwear Co', 'indie', 'Underground streetwear label for emerging artists', 500, 100, 500, 3.0, 'standard', 15.0, ARRAY['tshirt', 'cap']),
('Urban Edge', 'mainstream', 'Popular urban fashion brand with youth appeal', 2000, 500, 2000, 5.0, 'premium', 25.0, ARRAY['tshirt', 'hoodie', 'cap']),
('Apex Threads', 'premium', 'Premium athletic and lifestyle apparel', 10000, 2500, 10000, 8.0, 'premium', 35.0, ARRAY['tshirt', 'hoodie', 'poster']),
('Luxe Culture', 'luxury', 'High-end fashion house for top-tier artists', 50000, 10000, 50000, 12.0, 'exclusive', 50.0, ARRAY['tshirt', 'hoodie', 'vinyl']),
('Vinyl Vault', 'mainstream', 'Specialty vinyl and music merchandise partner', 1500, 300, 1500, 4.0, 'premium', 20.0, ARRAY['vinyl', 'cd', 'poster']),
('Festival Gear', 'indie', 'Festival and tour merchandise specialists', 750, 150, 750, 3.5, 'standard', 18.0, ARRAY['tshirt', 'poster', 'sticker']);