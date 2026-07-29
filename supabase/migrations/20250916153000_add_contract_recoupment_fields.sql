-- Consolidated owner for the historical 20250916153000 migration version.
-- Supabase records the 14-digit version, so the former eight-file collision
-- prevented fresh databases from applying the complete feature set.

-- Contract advance recoupment.
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS advance_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recouped_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.contracts
SET
  advance_balance = advance_payment::NUMERIC(12,2),
  recouped_amount = 0
WHERE advance_balance = 0;

-- Social metrics retained on the legacy auth-user profile row.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followers BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(5,2) DEFAULT 0;

UPDATE public.profiles
SET
  followers = COALESCE(followers, 0),
  engagement_rate = COALESCE(engagement_rate, 0);

-- Competitions and rankings.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  prize_pool NUMERIC NOT NULL DEFAULT 0,
  entry_fee NUMERIC NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competitions_dates_check CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  final_rank INTEGER,
  prize_amount NUMERIC NOT NULL DEFAULT 0,
  awarded_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.competition_participants'::regclass
      AND conname = 'competition_participants_competition_id_profile_id_key'
  ) THEN
    ALTER TABLE public.competition_participants
      ADD CONSTRAINT competition_participants_competition_id_profile_id_key
      UNIQUE (competition_id, profile_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.player_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ranking_type TEXT NOT NULL DEFAULT 'global',
  rank INTEGER NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  total_plays NUMERIC NOT NULL DEFAULT 0,
  hit_songs INTEGER NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'same',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.player_rankings'::regclass
      AND conname = 'player_rankings_profile_id_ranking_type_key'
  ) THEN
    ALTER TABLE public.player_rankings
      ADD CONSTRAINT player_rankings_profile_id_ranking_type_key
      UNIQUE (profile_id, ranking_type);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS competition_participants_competition_id_idx
  ON public.competition_participants (competition_id);
CREATE INDEX IF NOT EXISTS competition_participants_profile_id_idx
  ON public.competition_participants (profile_id);
CREATE INDEX IF NOT EXISTS player_rankings_ranking_type_rank_idx
  ON public.player_rankings (ranking_type, rank);

-- Collaborative jam sessions. host_id and participant_ids contain auth user IDs.
CREATE TABLE IF NOT EXISTS public.jam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  tempo INTEGER NOT NULL DEFAULT 120 CHECK (tempo > 0),
  max_participants INTEGER NOT NULL DEFAULT 4 CHECK (max_participants > 0),
  current_participants INTEGER NOT NULL DEFAULT 0 CHECK (current_participants >= 0),
  participant_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  skill_requirement INTEGER NOT NULL DEFAULT 0 CHECK (skill_requirement >= 0),
  is_private BOOLEAN NOT NULL DEFAULT false,
  access_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jam_sessions_host_id_idx
  ON public.jam_sessions (host_id);

ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jam sessions are viewable by authenticated users" ON public.jam_sessions;
CREATE POLICY "Jam sessions are viewable by authenticated users"
  ON public.jam_sessions
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Hosts can create jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can create jam sessions"
  ON public.jam_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can manage jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can manage jam sessions"
  ON public.jam_sessions
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can delete jam sessions"
  ON public.jam_sessions
  FOR DELETE
  USING (auth.uid() = host_id);

CREATE OR REPLACE FUNCTION public.update_jam_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_jam_sessions_updated_at ON public.jam_sessions;
CREATE TRIGGER update_jam_sessions_updated_at
  BEFORE UPDATE ON public.jam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jam_sessions_updated_at();

CREATE OR REPLACE FUNCTION public.join_jam_session(p_session_id UUID)
RETURNS public.jam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.jam_sessions;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join jam sessions';
  END IF;

  SELECT *
  INTO v_session
  FROM public.jam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jam session not found';
  END IF;

  IF v_session.current_participants >= v_session.max_participants THEN
    RAISE EXCEPTION 'Jam session is full';
  END IF;

  IF v_user_id = ANY (v_session.participant_ids) THEN
    RETURN v_session;
  END IF;

  UPDATE public.jam_sessions
  SET
    participant_ids = array_append(participant_ids, v_user_id),
    current_participants = current_participants + 1,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_jam_session(UUID) TO authenticated;

-- Player leaderboard. Canonical song ownership is artist_id, not user_id.
DROP VIEW IF EXISTS public.leaderboards;

CREATE VIEW public.leaderboards AS
WITH song_stats AS (
  SELECT
    artist_id AS user_id,
    COALESCE(SUM(revenue), 0)::NUMERIC AS total_song_revenue
  FROM public.songs
  GROUP BY artist_id
),
gig_stats AS (
  SELECT
    user_id,
    COALESCE(SUM(earnings), 0)::NUMERIC AS total_gig_revenue,
    COUNT(*)::INTEGER AS total_gigs
  FROM public.gig_performances
  GROUP BY user_id
),
achievement_totals AS (
  SELECT
    user_id,
    COALESCE(earned_count, 0)::INTEGER AS total_achievements
  FROM public.player_achievement_summary
)
SELECT
  profiles.user_id,
  profiles.username,
  profiles.display_name,
  profiles.avatar_url,
  COALESCE(profiles.fame, 0) AS fame,
  COALESCE(profiles.experience, 0) AS experience,
  (
    COALESCE(song_stats.total_song_revenue, 0)
    + COALESCE(gig_stats.total_gig_revenue, 0)
  )::NUMERIC AS total_revenue,
  COALESCE(gig_stats.total_gigs, 0) AS total_gigs,
  COALESCE(achievement_totals.total_achievements, 0) AS total_achievements
FROM public.profiles profiles
LEFT JOIN song_stats ON song_stats.user_id = profiles.user_id
LEFT JOIN gig_stats ON gig_stats.user_id = profiles.user_id
LEFT JOIN achievement_totals ON achievement_totals.user_id = profiles.user_id;

GRANT SELECT ON public.leaderboards TO anon, authenticated;

-- User schedule entries.
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gig', 'recording', 'rehearsal', 'meeting', 'tour')),
  date DATE NOT NULL,
  time TIME WITHOUT TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx
  ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_date_idx
  ON public.schedule_events (user_id, date);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their schedule events" ON public.schedule_events;
CREATE POLICY "Users can view their schedule events"
  ON public.schedule_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their schedule events" ON public.schedule_events;
CREATE POLICY "Users can create their schedule events"
  ON public.schedule_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their schedule events" ON public.schedule_events;
CREATE POLICY "Users can update their schedule events"
  ON public.schedule_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their schedule events" ON public.schedule_events;
CREATE POLICY "Users can delete their schedule events"
  ON public.schedule_events
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_schedule_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_schedule_events_updated_at ON public.schedule_events;
CREATE TRIGGER update_schedule_events_updated_at
  BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_events_updated_at();

-- Per-song streaming totals.
CREATE TABLE IF NOT EXISTS public.streaming_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_streams INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT streaming_stats_song_unique UNIQUE (song_id)
);

CREATE INDEX IF NOT EXISTS idx_streaming_stats_song_id
  ON public.streaming_stats (song_id);
CREATE INDEX IF NOT EXISTS idx_streaming_stats_user_id
  ON public.streaming_stats (user_id);

ALTER TABLE public.streaming_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their streaming stats" ON public.streaming_stats;
CREATE POLICY "Users can view their streaming stats"
  ON public.streaming_stats
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their streaming stats" ON public.streaming_stats;
CREATE POLICY "Users can insert their streaming stats"
  ON public.streaming_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their streaming stats" ON public.streaming_stats;
CREATE POLICY "Users can update their streaming stats"
  ON public.streaming_stats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their streaming stats" ON public.streaming_stats;
CREATE POLICY "Users can delete their streaming stats"
  ON public.streaming_stats
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_streaming_stats_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_streaming_stats_updated_at ON public.streaming_stats;
CREATE TRIGGER update_streaming_stats_updated_at
  BEFORE UPDATE ON public.streaming_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_streaming_stats_updated_at();

-- Incremental organic stream growth. History ownership follows songs.artist_id.
CREATE TABLE IF NOT EXISTS public.song_stream_growth_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streams_added INTEGER NOT NULL DEFAULT 0,
  revenue_added NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.song_stream_growth_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own song growth" ON public.song_stream_growth_history;
CREATE POLICY "Users can view their own song growth"
  ON public.song_stream_growth_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS song_stream_growth_history_user_recorded_at_idx
  ON public.song_stream_growth_history (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS song_stream_growth_history_song_recorded_at_idx
  ON public.song_stream_growth_history (song_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.simulate_song_growth()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  WITH growth AS (
    SELECT
      songs.id,
      songs.artist_id AS user_id,
      GREATEST(
        0,
        FLOOR(
          (
            songs.quality_score::NUMERIC * 0.6
            + COALESCE(player_skills.marketing, 10) * 1.5
          )
          * (0.85 + random() * 0.3)
        )
      )::INTEGER AS stream_increase
    FROM public.songs songs
    LEFT JOIN public.player_skills player_skills
      ON player_skills.user_id = songs.artist_id
    WHERE songs.status = 'released'
  ),
  updated AS (
    UPDATE public.songs songs
    SET
      streams = songs.streams + growth.stream_increase,
      revenue = ROUND(
        (songs.revenue + (growth.stream_increase * 0.01))::NUMERIC,
        2
      ),
      updated_at = now()
    FROM growth
    WHERE songs.id = growth.id
      AND growth.stream_increase > 0
    RETURNING
      songs.id,
      growth.user_id,
      growth.stream_increase,
      ROUND((growth.stream_increase * 0.01)::NUMERIC, 2) AS revenue_added
  )
  INSERT INTO public.song_stream_growth_history (
    song_id,
    user_id,
    streams_added,
    revenue_added
  )
  SELECT
    id,
    user_id,
    stream_increase,
    revenue_added
  FROM updated
  WHERE stream_increase > 0;
END;
$$;

COMMENT ON FUNCTION public.simulate_song_growth()
  IS 'Applies automated stream and revenue growth to released songs based on quality and marketing skills.';

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $schedule$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'song_stream_growth_quarter_hour'
  ) THEN
    PERFORM cron.schedule(
      'song_stream_growth_quarter_hour',
      '*/15 * * * *',
      $job$SELECT public.simulate_song_growth();$job$
    );
  END IF;
END;
$schedule$;
