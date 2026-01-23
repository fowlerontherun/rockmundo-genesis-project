-- Create sponsorship_entities table to track entities (bands/artists) eligible for sponsorships
CREATE TABLE IF NOT EXISTS public.sponsorship_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  artist_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  brand_flags TEXT[] DEFAULT '{}',
  fame_momentum NUMERIC DEFAULT 0,
  event_attendance_score NUMERIC DEFAULT 0,
  chart_momentum NUMERIC DEFAULT 0,
  max_deals INT DEFAULT 3,
  active_deals INT DEFAULT 0,
  last_offer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT entity_has_band_or_artist CHECK (band_id IS NOT NULL OR artist_profile_id IS NOT NULL)
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_entities_band_id_key ON sponsorship_entities(band_id) WHERE band_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_entities_artist_key ON sponsorship_entities(artist_profile_id) WHERE artist_profile_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.sponsorship_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sponsorship entities"
  ON public.sponsorship_entities
  FOR SELECT
  USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    OR artist_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage sponsorship entities"
  ON public.sponsorship_entities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create sponsorship_notifications table if not exists
CREATE TABLE IF NOT EXISTS public.sponsorship_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES sponsorship_entities(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES sponsorship_offers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.sponsorship_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sponsorship notifications"
  ON public.sponsorship_notifications
  FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM sponsorship_entities 
      WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
         OR artist_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage notifications"
  ON public.sponsorship_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-populate sponsorship entities for existing active bands
INSERT INTO sponsorship_entities (band_id, brand_flags, fame_momentum, event_attendance_score, chart_momentum)
SELECT 
  b.id,
  ARRAY['music', 'live']::TEXT[],
  COALESCE(b.fame, 0),
  0,
  0
FROM bands b
WHERE b.status = 'active'
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create sponsorship entity when a band becomes active
CREATE OR REPLACE FUNCTION create_sponsorship_entity_for_band()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    INSERT INTO sponsorship_entities (band_id, brand_flags, fame_momentum)
    VALUES (NEW.id, ARRAY['music', 'live']::TEXT[], COALESCE(NEW.fame, 0))
    ON CONFLICT (band_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_sponsorship_entity_trigger ON bands;
CREATE TRIGGER create_sponsorship_entity_trigger
  AFTER INSERT OR UPDATE ON bands
  FOR EACH ROW
  EXECUTE FUNCTION create_sponsorship_entity_for_band();