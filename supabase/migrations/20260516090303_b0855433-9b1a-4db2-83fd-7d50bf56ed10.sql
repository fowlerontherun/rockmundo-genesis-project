
-- ============================================================
-- v1.1.317 + v1.1.318 — Film & TV acting career expansion
-- ============================================================

-- ---------- 1. Extend pr_media_offers ----------
ALTER TABLE public.pr_media_offers
  ADD COLUMN IF NOT EXISTS role_type text,
  ADD COLUMN IF NOT EXISTS base_pay_cents bigint,
  ADD COLUMN IF NOT EXISTS pay_per_episode_cents bigint,
  ADD COLUMN IF NOT EXISTS episode_count integer,
  ADD COLUMN IF NOT EXISTS negotiation_id uuid,
  ADD COLUMN IF NOT EXISTS parent_film_id uuid,
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS season_id uuid;

-- ---------- 2. Extend player_film_contracts ----------
ALTER TABLE public.player_film_contracts
  ADD COLUMN IF NOT EXISTS role_type text DEFAULT 'cameo',
  ADD COLUMN IF NOT EXISTS total_pay_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critic_score integer,
  ADD COLUMN IF NOT EXISTS audience_score integer,
  ADD COLUMN IF NOT EXISTS opening_weekend_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merch_revenue_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streaming_views bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS awards_won integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_sequel boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_contract_id uuid,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS performance_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS film_title text;

-- ---------- 3. acting_negotiations ----------
CREATE TABLE IF NOT EXISTS public.acting_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  initial_offer_cents bigint NOT NULL,
  studio_offer_cents bigint NOT NULL,
  player_counter_cents bigint,
  status text NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acting_negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "neg select own" ON public.acting_negotiations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "neg insert own" ON public.acting_negotiations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "neg update own" ON public.acting_negotiations FOR UPDATE USING (auth.uid() = user_id);

-- ---------- 4. film_performance_weekly ----------
CREATE TABLE IF NOT EXISTS public.film_performance_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.player_film_contracts(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  box_office_week_cents bigint NOT NULL DEFAULT 0,
  streaming_views bigint NOT NULL DEFAULT 0,
  merch_units integer NOT NULL DEFAULT 0,
  merch_revenue_cents bigint NOT NULL DEFAULT 0,
  screens integer NOT NULL DEFAULT 0,
  drop_pct numeric(6,2) DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, week_number)
);
ALTER TABLE public.film_performance_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpw select own" ON public.film_performance_weekly FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.player_film_contracts c
    WHERE c.id = film_performance_weekly.contract_id AND c.user_id = auth.uid()
  )
);
CREATE INDEX IF NOT EXISTS idx_fpw_contract ON public.film_performance_weekly(contract_id);

-- ---------- 5. scripted_series ----------
CREATE TABLE IF NOT EXISTS public.scripted_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  network_id uuid REFERENCES public.tv_networks(id),
  genre text,
  premise text,
  target_role_type text NOT NULL DEFAULT 'supporting',
  base_pay_per_episode_cents bigint NOT NULL DEFAULT 5000000,
  episodes_per_season integer NOT NULL DEFAULT 10,
  prestige_level integer NOT NULL DEFAULT 3,
  min_fame_required integer NOT NULL DEFAULT 25000,
  is_open_for_casting boolean NOT NULL DEFAULT true,
  current_season integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scripted_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series select all" ON public.scripted_series FOR SELECT USING (true);

-- ---------- 6. series_seasons ----------
CREATE TABLE IF NOT EXISTS public.series_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.scripted_series(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  status text NOT NULL DEFAULT 'announced',
  episode_count integer NOT NULL DEFAULT 10,
  episodes_aired integer NOT NULL DEFAULT 0,
  filming_start date,
  filming_end date,
  premiere_date date,
  finale_date date,
  avg_viewers bigint DEFAULT 0,
  total_viewers bigint DEFAULT 0,
  critic_score integer,
  audience_score integer,
  total_merch_revenue_cents bigint DEFAULT 0,
  renewal_decision_at timestamptz,
  renewal_decision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, season_number)
);
ALTER TABLE public.series_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons select all" ON public.series_seasons FOR SELECT USING (true);

-- ---------- 7. player_series_contracts ----------
CREATE TABLE IF NOT EXISTS public.player_series_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  series_id uuid NOT NULL REFERENCES public.scripted_series(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.series_seasons(id) ON DELETE CASCADE,
  role_name text,
  role_type text NOT NULL DEFAULT 'supporting',
  pay_per_episode_cents bigint NOT NULL,
  episode_count integer NOT NULL,
  total_pay_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  joined_at timestamptz NOT NULL DEFAULT now(),
  departed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_series_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psc select own" ON public.player_series_contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "psc insert own" ON public.player_series_contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "psc update own" ON public.player_series_contracts FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_psc_user ON public.player_series_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_psc_season ON public.player_series_contracts(season_id);

-- ---------- 8. series_episodes ----------
CREATE TABLE IF NOT EXISTS public.series_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.series_seasons(id) ON DELETE CASCADE,
  episode_number integer NOT NULL,
  title text,
  airdate date,
  viewers_live bigint DEFAULT 0,
  viewers_7day bigint DEFAULT 0,
  social_buzz integer DEFAULT 0,
  aired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, episode_number)
);
ALTER TABLE public.series_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes select all" ON public.series_episodes FOR SELECT USING (true);

-- ---------- 9. series_performance_weekly ----------
CREATE TABLE IF NOT EXISTS public.series_performance_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.series_seasons(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  viewers bigint DEFAULT 0,
  merch_revenue_cents bigint DEFAULT 0,
  streaming_views bigint DEFAULT 0,
  ad_revenue_cents bigint DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, week_number)
);
ALTER TABLE public.series_performance_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spw select all" ON public.series_performance_weekly FOR SELECT USING (true);

-- ---------- 10. series_renewal_offers ----------
CREATE TABLE IF NOT EXISTS public.series_renewal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  series_id uuid NOT NULL REFERENCES public.scripted_series(id) ON DELETE CASCADE,
  prior_season_id uuid NOT NULL REFERENCES public.series_seasons(id) ON DELETE CASCADE,
  new_season_number integer NOT NULL,
  offered_pay_per_episode_cents bigint NOT NULL,
  episode_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.series_renewal_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sro select own" ON public.series_renewal_offers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sro update own" ON public.series_renewal_offers FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_sro_user ON public.series_renewal_offers(user_id);

-- ---------- 11. updated_at trigger on negotiations ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acting_negotiations_touch ON public.acting_negotiations;
CREATE TRIGGER acting_negotiations_touch
BEFORE UPDATE ON public.acting_negotiations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
