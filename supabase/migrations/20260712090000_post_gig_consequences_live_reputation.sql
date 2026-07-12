-- Phase 9: Post-gig consequences and live reputation.
CREATE TABLE IF NOT EXISTS public.gig_post_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','partially_failed','retry_required','skipped')),
  processing_version text NOT NULL DEFAULT 'post-gig-consequences-v1',
  started_at timestamptz,
  completed_at timestamptz,
  error_snapshot jsonb,
  audit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id)
);

CREATE TABLE IF NOT EXISTS public.gig_consequence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  processing_id uuid NOT NULL REFERENCES public.gig_post_processing(id) ON DELETE CASCADE,
  category text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  consequence_key text NOT NULL,
  previous_value numeric,
  delta_value numeric,
  new_value numeric,
  status text NOT NULL CHECK (status IN ('positive','neutral','negative')),
  explanation text NOT NULL,
  source_factors text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, consequence_key, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS public.band_live_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE UNIQUE,
  overall_score numeric NOT NULL DEFAULT 50 CHECK (overall_score BETWEEN 0 AND 100),
  performance_score numeric NOT NULL DEFAULT 50 CHECK (performance_score BETWEEN 0 AND 100),
  professionalism_score numeric NOT NULL DEFAULT 50 CHECK (professionalism_score BETWEEN 0 AND 100),
  crowd_connection_score numeric NOT NULL DEFAULT 50 CHECK (crowd_connection_score BETWEEN 0 AND 100),
  reliability_score numeric NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  production_score numeric NOT NULL DEFAULT 50 CHECK (production_score BETWEEN 0 AND 100),
  live_momentum_score numeric NOT NULL DEFAULT 50 CHECK (live_momentum_score BETWEEN 0 AND 100),
  booking_demand_score numeric NOT NULL DEFAULT 50 CHECK (booking_demand_score BETWEEN 0 AND 100),
  experience_count integer NOT NULL DEFAULT 0 CHECK (experience_count >= 0),
  last_gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_live_reputation_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('city','country','region','venue_tier','genre','festival_circuit','promoter_network')),
  scope_id text NOT NULL,
  score numeric NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  experience_count integer NOT NULL DEFAULT 0 CHECK (experience_count >= 0),
  last_gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS public.gig_media_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  publication_id uuid,
  reviewer_type text NOT NULL DEFAULT 'system_template',
  review_tier text NOT NULL CHECK (review_tier IN ('fan_summary','local_blog','local_press','national_press','festival_report','industry_coverage')),
  headline text NOT NULL,
  rating numeric CHECK (rating BETWEEN 0 AND 5),
  summary text NOT NULL,
  positive_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  standout_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  standout_player_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  crowd_response text,
  production_comment text,
  incident_reference jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('private','band','venue','public')),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, review_tier)
);

CREATE TABLE IF NOT EXISTS public.gig_booking_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('repeat_venue','larger_venue','support_slot','festival_invitation','better_slot','promoter_introduction','mini_tour','radio_session','sponsor_interest')),
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  promoter_id uuid,
  festival_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','viewed','accepted','declined','expired','cancelled')),
  offer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '21 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_gig_id, band_id, opportunity_type, venue_id, promoter_id, festival_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_post_processing_status ON public.gig_post_processing(status, created_at);
CREATE INDEX IF NOT EXISTS idx_gig_consequence_snapshots_gig_category ON public.gig_consequence_snapshots(gig_id, category);
CREATE INDEX IF NOT EXISTS idx_band_live_reputation_scores ON public.band_live_reputation(band_id, overall_score, booking_demand_score);
CREATE INDEX IF NOT EXISTS idx_band_live_reputation_scopes_lookup ON public.band_live_reputation_scopes(scope_type, scope_id, score);
CREATE INDEX IF NOT EXISTS idx_gig_media_reviews_visibility ON public.gig_media_reviews(visibility, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_booking_opportunities_band_status ON public.gig_booking_opportunities(band_id, status, expires_at);

ALTER TABLE public.gig_post_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_consequence_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_live_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_live_reputation_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_media_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_booking_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view gig post processing" ON public.gig_post_processing FOR SELECT USING (EXISTS (SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id = g.band_id WHERE g.id = gig_post_processing.gig_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view consequence snapshots" ON public.gig_consequence_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id = g.band_id WHERE g.id = gig_consequence_snapshots.gig_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view live reputation" ON public.band_live_reputation FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = band_live_reputation.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view scoped live reputation" ON public.band_live_reputation_scopes FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = band_live_reputation_scopes.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Public can view public gig media reviews" ON public.gig_media_reviews FOR SELECT USING (visibility = 'public' OR EXISTS (SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id = g.band_id WHERE g.id = gig_media_reviews.gig_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band members can view booking opportunities" ON public.gig_booking_opportunities FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_booking_opportunities.band_id AND bm.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.expire_gig_booking_opportunities()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.gig_booking_opportunities SET status = 'expired', updated_at = now()
  WHERE status = 'open' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.decay_band_live_momentum(p_band_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.band_live_reputation
  SET live_momentum_score = 50 + ((live_momentum_score - 50) * 0.92), updated_at = now()
  WHERE (p_band_id IS NULL OR band_id = p_band_id) AND abs(live_momentum_score - 50) >= 0.1;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
