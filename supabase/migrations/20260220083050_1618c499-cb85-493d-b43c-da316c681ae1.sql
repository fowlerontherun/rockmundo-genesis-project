
-- =====================================================
-- SOCIAL DRAMA EVENT GENERATOR
-- Drama events, media articles, cascading impacts
-- =====================================================

-- Social drama events table
CREATE TABLE public.social_drama_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Who's involved
  primary_entity_id UUID NOT NULL,  -- profile or band id
  primary_entity_type TEXT NOT NULL CHECK (primary_entity_type IN ('player', 'npc', 'band')),
  primary_entity_name TEXT NOT NULL,
  secondary_entity_id UUID,
  secondary_entity_type TEXT CHECK (secondary_entity_type IN ('player', 'npc', 'band')),
  secondary_entity_name TEXT,
  
  -- Event details
  drama_category TEXT NOT NULL CHECK (drama_category IN (
    'public_breakup', 'affair_exposed', 'diss_track',
    'onstage_fight', 'surprise_wedding', 'custody_dispute',
    'rehab_announcement', 'feud_escalation', 'public_apology',
    'leaked_dms', 'award_snub_rant', 'contract_dispute'
  )),
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major', 'explosive')),
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Impact scores (applied on creation)
  reputation_impact JSONB NOT NULL DEFAULT '{}',  -- { axis: string, change: number }[]
  fan_loyalty_change INTEGER NOT NULL DEFAULT 0,   -- -50 to +50
  streaming_multiplier NUMERIC NOT NULL DEFAULT 1.0, -- 0.5x to 3.0x temporary boost/penalty
  chart_boost INTEGER NOT NULL DEFAULT 0,           -- bonus chart points
  fame_change INTEGER NOT NULL DEFAULT 0,
  
  -- Duration of effects
  effect_duration_days INTEGER NOT NULL DEFAULT 7,
  effects_active BOOLEAN NOT NULL DEFAULT true,
  effects_expire_at TIMESTAMPTZ,
  
  -- Media & social
  media_article_id UUID,  -- links to generated article
  went_viral BOOLEAN NOT NULL DEFAULT false,
  viral_score INTEGER DEFAULT 0,  -- 0-100
  twaater_hashtag TEXT,
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  follow_up_event_id UUID,  -- chain events
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated media articles from drama events
CREATE TABLE public.generated_media_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Source
  drama_event_id UUID REFERENCES public.social_drama_events(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'drama' CHECK (source_type IN ('drama', 'achievement', 'chart', 'gig', 'release', 'editorial')),
  
  -- Article content
  outlet_name TEXT NOT NULL,       -- 'RockMundo Daily', 'Scandal Sheet', 'Music Insider', etc.
  outlet_tone TEXT NOT NULL DEFAULT 'neutral' CHECK (outlet_tone IN ('tabloid', 'serious', 'gossip', 'supportive', 'neutral')),
  headline TEXT NOT NULL,
  subheadline TEXT,
  body_text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Entities mentioned
  mentioned_entity_ids UUID[] DEFAULT '{}',
  mentioned_entity_names TEXT[] DEFAULT '{}',
  
  -- Engagement
  reader_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  sentiment_score INTEGER NOT NULL DEFAULT 0,  -- -100 to 100
  controversy_score INTEGER NOT NULL DEFAULT 0, -- 0 to 100
  
  -- Visibility
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_social_drama_primary ON public.social_drama_events(primary_entity_id, primary_entity_type);
CREATE INDEX idx_social_drama_category ON public.social_drama_events(drama_category);
CREATE INDEX idx_social_drama_active ON public.social_drama_events(effects_active) WHERE effects_active = true;
CREATE INDEX idx_social_drama_created ON public.social_drama_events(created_at DESC);
CREATE INDEX idx_media_articles_drama ON public.generated_media_articles(drama_event_id);
CREATE INDEX idx_media_articles_source ON public.generated_media_articles(source_type);
CREATE INDEX idx_media_articles_published ON public.generated_media_articles(is_published, created_at DESC);
CREATE INDEX idx_media_articles_breaking ON public.generated_media_articles(is_breaking) WHERE is_breaking = true;

-- RLS
ALTER TABLE public.social_drama_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_media_articles ENABLE ROW LEVEL SECURITY;

-- Drama events: all authenticated users can read (public drama), owners can insert
CREATE POLICY "Anyone can view social drama events"
ON public.social_drama_events FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Players can insert drama events they're involved in"
ON public.social_drama_events FOR INSERT
WITH CHECK (
  primary_entity_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR primary_entity_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Players can update own drama events"
ON public.social_drama_events FOR UPDATE
USING (
  primary_entity_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR primary_entity_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Service role full access drama"
ON public.social_drama_events FOR ALL
USING (auth.role() = 'service_role');

-- Media articles: all can read published, service role full access
CREATE POLICY "Anyone can view published articles"
ON public.generated_media_articles FOR SELECT
USING (is_published = true AND auth.role() = 'authenticated');

CREATE POLICY "Service role full access articles"
ON public.generated_media_articles FOR ALL
USING (auth.role() = 'service_role');

-- Allow system/edge functions to insert articles
CREATE POLICY "Authenticated users can insert articles"
ON public.generated_media_articles FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Updated_at trigger
CREATE TRIGGER update_social_drama_events_updated_at
BEFORE UPDATE ON public.social_drama_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
