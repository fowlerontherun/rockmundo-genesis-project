-- #2158: live deployments may have processing tables without Phase 9 support tables.
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

ALTER TABLE public.band_live_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_media_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='band_live_reputation' AND policyname='Band members can view live reputation') THEN
  CREATE POLICY "Band members can view live reputation" ON public.band_live_reputation FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = band_live_reputation.band_id AND bm.user_id = (SELECT auth.uid())));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gig_media_reviews' AND policyname='Public can view public gig media reviews') THEN
  CREATE POLICY "Public can view public gig media reviews" ON public.gig_media_reviews FOR SELECT USING (visibility = 'public' OR EXISTS (SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id = g.band_id WHERE g.id = gig_media_reviews.gig_id AND bm.user_id = (SELECT auth.uid())));
 END IF;
END $$;
