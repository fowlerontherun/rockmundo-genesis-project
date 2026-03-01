
-- Create release_territories table
CREATE TABLE public.release_territories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  release_id UUID NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  distance_tier TEXT NOT NULL DEFAULT 'domestic',
  cost_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  distribution_cost INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add home_country to releases
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS home_country TEXT;

-- Index for lookups
CREATE INDEX idx_release_territories_release_id ON public.release_territories(release_id);
CREATE INDEX idx_release_territories_country ON public.release_territories(country);

-- Enable RLS
ALTER TABLE public.release_territories ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view territories for their releases
CREATE POLICY "Users can view their release territories" ON public.release_territories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_territories.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
        )
      )
    )
  );

-- RLS: Users can insert territories for their releases
CREATE POLICY "Users can insert their release territories" ON public.release_territories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_territories.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
          AND bm.role IN ('leader', 'Founder', 'founder', 'co-leader')
        )
      )
    )
  );

-- RLS: Users can update territories for their releases
CREATE POLICY "Users can update their release territories" ON public.release_territories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_territories.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
          AND bm.role IN ('leader', 'Founder', 'founder', 'co-leader')
        )
      )
    )
  );

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access to release_territories" ON public.release_territories
  FOR ALL USING (true) WITH CHECK (true);
