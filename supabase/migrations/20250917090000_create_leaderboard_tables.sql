-- Create core tables to support competitive leaderboard seasons and badge tracking
CREATE TABLE IF NOT EXISTS public.leaderboard_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status = ANY (ARRAY['upcoming', 'active', 'completed']::text[])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reward_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_seasons_status_idx
  ON public.leaderboard_seasons (status, start_date DESC);

CREATE TRIGGER leaderboard_seasons_set_updated_at
  BEFORE UPDATE ON public.leaderboard_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard seasons are viewable by everyone"
  ON public.leaderboard_seasons
  FOR SELECT
  USING (true);


CREATE TABLE IF NOT EXISTS public.leaderboard_season_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  division text NOT NULL DEFAULT 'global',
  region text NOT NULL DEFAULT 'global',
  instrument text NOT NULL DEFAULT 'all',
  tier text,
  final_rank integer,
  final_score numeric,
  total_revenue numeric,
  total_gigs integer,
  total_achievements integer,
  fame numeric,
  experience numeric,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  awarded_badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_season_snapshots_division_check CHECK (length(trim(division)) > 0),
  CONSTRAINT leaderboard_season_snapshots_region_check CHECK (length(trim(region)) > 0),
  CONSTRAINT leaderboard_season_snapshots_instrument_check CHECK (length(trim(instrument)) > 0),
  CONSTRAINT leaderboard_season_snapshots_unique_entry UNIQUE (season_id, user_id, division, region, instrument)
);

CREATE INDEX IF NOT EXISTS leaderboard_season_snapshots_season_idx
  ON public.leaderboard_season_snapshots (season_id, division, region, instrument, final_rank);

CREATE INDEX IF NOT EXISTS leaderboard_season_snapshots_user_idx
  ON public.leaderboard_season_snapshots (user_id);

CREATE TRIGGER leaderboard_season_snapshots_set_updated_at
  BEFORE UPDATE ON public.leaderboard_season_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leaderboard_season_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard snapshots are viewable by everyone"
  ON public.leaderboard_season_snapshots
  FOR SELECT
  USING (true);


CREATE TABLE IF NOT EXISTS public.leaderboard_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'trophy',
  rarity text NOT NULL DEFAULT 'rare' CHECK (rarity = ANY (ARRAY['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']::text[])),
  tier text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_badges_season_idx
  ON public.leaderboard_badges (season_id, rarity);

CREATE TRIGGER leaderboard_badges_set_updated_at
  BEFORE UPDATE ON public.leaderboard_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leaderboard_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard badges are viewable by everyone"
  ON public.leaderboard_badges
  FOR SELECT
  USING (true);


CREATE TABLE IF NOT EXISTS public.leaderboard_badge_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.leaderboard_badges(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  rank integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_badge_awards_rank_check CHECK (rank IS NULL OR rank >= 1),
  CONSTRAINT leaderboard_badge_awards_unique UNIQUE (badge_id, user_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_badge_awards_badge_idx
  ON public.leaderboard_badge_awards (badge_id);

CREATE INDEX IF NOT EXISTS leaderboard_badge_awards_user_idx
  ON public.leaderboard_badge_awards (user_id);

CREATE INDEX IF NOT EXISTS leaderboard_badge_awards_season_idx
  ON public.leaderboard_badge_awards (season_id);

ALTER TABLE public.leaderboard_badge_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard badge awards are viewable by everyone"
  ON public.leaderboard_badge_awards
  FOR SELECT
  USING (true);

GRANT SELECT ON public.leaderboard_seasons TO anon, authenticated;
GRANT SELECT ON public.leaderboard_season_snapshots TO anon, authenticated;
GRANT SELECT ON public.leaderboard_badges TO anon, authenticated;
GRANT SELECT ON public.leaderboard_badge_awards TO anon, authenticated;
