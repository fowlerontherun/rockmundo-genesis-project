-- Public Relations and Media Appearances System

-- PR Campaigns table
CREATE TABLE IF NOT EXISTS public.pr_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('tv', 'radio', 'podcast', 'press', 'social', 'influencer')),
  campaign_name TEXT NOT NULL,
  budget NUMERIC DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  reach INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  media_impressions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media Appearances table
CREATE TABLE IF NOT EXISTS public.media_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv', 'radio', 'podcast', 'press')),
  program_name TEXT NOT NULL,
  network TEXT NOT NULL,
  air_date TIMESTAMP WITH TIME ZONE NOT NULL,
  audience_reach INTEGER DEFAULT 0,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  highlight TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media Offers table
CREATE TABLE IF NOT EXISTS public.media_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv', 'radio', 'podcast', 'press')),
  program_name TEXT NOT NULL,
  network TEXT NOT NULL,
  proposed_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  compensation NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pr_campaigns
CREATE POLICY "Users can view campaigns for their bands"
  ON public.pr_campaigns FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band leaders can manage campaigns"
  ON public.pr_campaigns FOR ALL
  USING (
    band_id IN (
      SELECT id FROM public.bands WHERE leader_id = auth.uid()
    )
  );

-- RLS Policies for media_appearances
CREATE POLICY "Users can view appearances for their bands"
  ON public.media_appearances FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band leaders can manage appearances"
  ON public.media_appearances FOR ALL
  USING (
    band_id IN (
      SELECT id FROM public.bands WHERE leader_id = auth.uid()
    )
  );

-- RLS Policies for media_offers
CREATE POLICY "Users can view offers for their bands"
  ON public.media_offers FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band leaders can respond to offers"
  ON public.media_offers FOR UPDATE
  USING (
    band_id IN (
      SELECT id FROM public.bands WHERE leader_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_pr_campaigns_updated_at
  BEFORE UPDATE ON public.pr_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sample data for testing
INSERT INTO public.pr_campaigns (band_id, campaign_type, campaign_name, budget, start_date, end_date, status, reach, engagement_rate, media_impressions)
SELECT 
  b.id,
  'tv',
  'Morning Show Circuit',
  5000,
  NOW() - INTERVAL '7 days',
  NOW() + INTERVAL '23 days',
  'active',
  2100000,
  18,
  3450000
FROM public.bands b
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.media_appearances (band_id, media_type, program_name, network, air_date, audience_reach, sentiment, highlight)
SELECT 
  b.id,
  'tv',
  'Morning Spotlight',
  'WAV8',
  NOW() - INTERVAL '2 days',
  2100000,
  'positive',
  'Acoustic set reached 2.1M viewers'
FROM public.bands b
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.media_offers (band_id, media_type, program_name, network, proposed_date, status, compensation, expires_at)
SELECT 
  b.id,
  'tv',
  'Prime Time Sessions',
  'ART Network',
  NOW() + INTERVAL '12 days',
  'pending',
  3500,
  NOW() + INTERVAL '5 days'
FROM public.bands b
LIMIT 1
ON CONFLICT DO NOTHING;