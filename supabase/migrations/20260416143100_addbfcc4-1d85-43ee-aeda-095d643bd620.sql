
-- 1. Label Artist Boosts
CREATE TABLE public.label_artist_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.artist_label_contracts(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  fame_bonus_pct NUMERIC NOT NULL DEFAULT 0,
  streaming_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  gig_boost_pct NUMERIC NOT NULL DEFAULT 0,
  festival_priority INTEGER NOT NULL DEFAULT 0,
  marketing_spend_weekly NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id)
);
ALTER TABLE public.label_artist_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view label artist boosts" ON public.label_artist_boosts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Label owners can manage boosts" ON public.label_artist_boosts FOR ALL TO authenticated USING (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
) WITH CHECK (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
);

-- 2. Label Scout Reports
CREATE TABLE public.label_scout_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  artist_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  artist_name TEXT NOT NULL,
  potential_score INTEGER NOT NULL DEFAULT 50,
  genre_match NUMERIC NOT NULL DEFAULT 0,
  fame_level INTEGER NOT NULL DEFAULT 0,
  song_quality_avg NUMERIC NOT NULL DEFAULT 0,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  scouted_by_staff_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.label_scout_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Label owners can view scout reports" ON public.label_scout_reports FOR SELECT TO authenticated USING (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
);
CREATE POLICY "Label owners can manage scout reports" ON public.label_scout_reports FOR ALL TO authenticated USING (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
) WITH CHECK (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
);

-- 3. Label Genre Expertise
CREATE TABLE public.label_genre_expertise (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  expertise_level INTEGER NOT NULL DEFAULT 1,
  releases_in_genre INTEGER NOT NULL DEFAULT 0,
  total_revenue_in_genre NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(label_id, genre)
);
ALTER TABLE public.label_genre_expertise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view genre expertise" ON public.label_genre_expertise FOR SELECT TO authenticated USING (true);
CREATE POLICY "Label owners can manage expertise" ON public.label_genre_expertise FOR ALL TO authenticated USING (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
) WITH CHECK (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
);

-- 4. Artist Development Pipeline
CREATE TABLE public.artist_development_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.artist_label_contracts(id) ON DELETE SET NULL,
  artist_name TEXT NOT NULL,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  artist_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL DEFAULT 'scouting',
  completed_stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  bonus_fame_awarded INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_development_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view pipelines" ON public.artist_development_pipeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Label owners can manage pipelines" ON public.artist_development_pipeline FOR ALL TO authenticated USING (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
) WITH CHECK (
  label_id IN (SELECT id FROM public.labels WHERE owner_id = auth.uid())
);

-- 5. Company Service Contracts
CREATE TABLE public.company_service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_type TEXT NOT NULL DEFAULT 'npc',
  client_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  contract_value NUMERIC NOT NULL DEFAULT 0,
  duration_weeks INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'available',
  performance_rating NUMERIC,
  revenue_earned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_service_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view service contracts" ON public.company_service_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company owners can manage contracts" ON public.company_service_contracts FOR ALL TO authenticated USING (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
) WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
);

-- 6. Company Rivalries
CREATE TABLE public.company_rivalries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_a_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_b_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  intensity INTEGER NOT NULL DEFAULT 1,
  rivalry_type TEXT NOT NULL DEFAULT 'competitive',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at TIMESTAMPTZ,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_rivalries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rivalries" ON public.company_rivalries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company owners can manage rivalries" ON public.company_rivalries FOR ALL TO authenticated USING (
  company_a_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  OR company_b_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
) WITH CHECK (
  company_a_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
);

-- 7. Company Events
CREATE TABLE public.company_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact_value NUMERIC NOT NULL DEFAULT 0,
  impact_area TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view company events" ON public.company_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company owners can manage events" ON public.company_events FOR ALL TO authenticated USING (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
) WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
);

-- 8. Company Market Rankings
CREATE TABLE public.company_market_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_type TEXT NOT NULL,
  rank_position INTEGER NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_market_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view market rankings" ON public.company_market_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company owners can manage rankings" ON public.company_market_rankings FOR ALL TO authenticated USING (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
) WITH CHECK (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
);

-- 9. Alter labels table
ALTER TABLE public.labels
  ADD COLUMN IF NOT EXISTS label_tier TEXT NOT NULL DEFAULT 'indie',
  ADD COLUMN IF NOT EXISTS total_artists_developed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS genre_specialization TEXT[] DEFAULT '{}';

-- 10. Alter companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS market_influence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_contracts_won INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX idx_label_artist_boosts_contract ON public.label_artist_boosts(contract_id);
CREATE INDEX idx_label_artist_boosts_label ON public.label_artist_boosts(label_id);
CREATE INDEX idx_label_scout_reports_label ON public.label_scout_reports(label_id);
CREATE INDEX idx_label_genre_expertise_label ON public.label_genre_expertise(label_id);
CREATE INDEX idx_artist_dev_pipeline_label ON public.artist_development_pipeline(label_id);
CREATE INDEX idx_company_service_contracts_company ON public.company_service_contracts(company_id);
CREATE INDEX idx_company_events_company ON public.company_events(company_id);
CREATE INDEX idx_company_market_rankings_company ON public.company_market_rankings(company_id);
CREATE INDEX idx_company_rivalries_a ON public.company_rivalries(company_a_id);
CREATE INDEX idx_company_rivalries_b ON public.company_rivalries(company_b_id);
