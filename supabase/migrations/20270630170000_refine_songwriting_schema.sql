-- Align the songwriting schema with the enhanced progression design
BEGIN;

-- Ensure songwriting projects track refined session estimates and progress ranges
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS estimated_completion_sessions integer;

UPDATE public.songwriting_projects
SET estimated_completion_sessions = COALESCE(estimated_completion_sessions, estimated_sessions, 3)
WHERE estimated_completion_sessions IS NULL;

ALTER TABLE public.songwriting_projects
  ALTER COLUMN estimated_completion_sessions SET DEFAULT 3,
  ALTER COLUMN estimated_completion_sessions SET NOT NULL,
  ADD CONSTRAINT IF NOT EXISTS songwriting_projects_estimated_completion_sessions_check
    CHECK (estimated_completion_sessions >= 1);

ALTER TABLE public.songwriting_projects
  ALTER COLUMN music_progress SET DEFAULT 0,
  ALTER COLUMN music_progress SET NOT NULL,
  ALTER COLUMN lyrics_progress SET DEFAULT 0,
  ALTER COLUMN lyrics_progress SET NOT NULL,
  ALTER COLUMN total_sessions SET DEFAULT 0,
  ALTER COLUMN total_sessions SET NOT NULL,
  ALTER COLUMN sessions_completed SET DEFAULT 0,
  ALTER COLUMN sessions_completed SET NOT NULL,
  ALTER COLUMN is_locked SET DEFAULT false,
  ALTER COLUMN is_locked SET NOT NULL,
  ALTER COLUMN quality_score SET DEFAULT 1000;

ALTER TABLE public.songwriting_projects
  DROP CONSTRAINT IF EXISTS songwriting_projects_music_progress_check,
  ADD CONSTRAINT songwriting_projects_music_progress_check
    CHECK (music_progress BETWEEN 0 AND 2000);

ALTER TABLE public.songwriting_projects
  DROP CONSTRAINT IF EXISTS songwriting_projects_lyrics_progress_check,
  ADD CONSTRAINT songwriting_projects_lyrics_progress_check
    CHECK (lyrics_progress BETWEEN 0 AND 2000);

ALTER TABLE public.songwriting_projects
  DROP CONSTRAINT IF EXISTS songwriting_projects_quality_score_check,
  ADD CONSTRAINT songwriting_projects_quality_score_check
    CHECK (quality_score BETWEEN 0 AND 2000);

-- Keep the legacy estimated_sessions column aligned when it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'songwriting_projects'
      AND column_name = 'estimated_sessions'
  ) THEN
    UPDATE public.songwriting_projects
    SET estimated_sessions = estimated_completion_sessions
    WHERE COALESCE(estimated_sessions, 0) <> estimated_completion_sessions;

    ALTER TABLE public.songwriting_projects
      ALTER COLUMN estimated_sessions SET DEFAULT 3;
  END IF;
END $$;

-- Tighten songwriting session tracking defaults
ALTER TABLE public.songwriting_sessions
  ALTER COLUMN music_progress_gained SET DEFAULT 0,
  ALTER COLUMN music_progress_gained SET NOT NULL,
  ALTER COLUMN lyrics_progress_gained SET DEFAULT 0,
  ALTER COLUMN lyrics_progress_gained SET NOT NULL,
  ALTER COLUMN xp_earned SET DEFAULT 0,
  ALTER COLUMN xp_earned SET NOT NULL,
  ALTER COLUMN session_start SET DEFAULT timezone('utc', now()),
  ALTER COLUMN session_start SET NOT NULL;

-- Expand the songs table with enhanced tracking fields
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS estimated_completion_sessions integer;

UPDATE public.songs
SET estimated_completion_sessions = COALESCE(estimated_completion_sessions, total_sessions, 0)
WHERE estimated_completion_sessions IS NULL;

ALTER TABLE public.songs
  ALTER COLUMN music_progress SET DEFAULT 0,
  ALTER COLUMN music_progress SET NOT NULL,
  ALTER COLUMN lyrics_progress SET DEFAULT 0,
  ALTER COLUMN lyrics_progress SET NOT NULL,
  ALTER COLUMN total_sessions SET DEFAULT 0,
  ALTER COLUMN total_sessions SET NOT NULL,
  ALTER COLUMN estimated_completion_sessions SET DEFAULT 0,
  ALTER COLUMN estimated_completion_sessions SET NOT NULL,
  ALTER COLUMN quality_score SET DEFAULT 1000;

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_music_progress_check,
  ADD CONSTRAINT songs_music_progress_check
    CHECK (music_progress BETWEEN 0 AND 2000);

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_lyrics_progress_check,
  ADD CONSTRAINT songs_lyrics_progress_check
    CHECK (lyrics_progress BETWEEN 0 AND 2000);

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_quality_score_range,
  ADD CONSTRAINT songs_quality_score_range
    CHECK (quality_score BETWEEN 0 AND 2000);

-- Rebalance the songwriting progress calculation for diminishing returns
CREATE OR REPLACE FUNCTION public.calculate_songwriting_progress(
  p_skill_songwriting INTEGER,
  p_skill_creativity INTEGER,
  p_skill_composition INTEGER,
  p_attr_creative_insight INTEGER,
  p_attr_musical_ability INTEGER,
  p_current_music INTEGER,
  p_current_lyrics INTEGER
) RETURNS JSONB AS $$
DECLARE
  remaining_music INTEGER := GREATEST(0, 2000 - COALESCE(p_current_music, 0));
  remaining_lyrics INTEGER := GREATEST(0, 2000 - COALESCE(p_current_lyrics, 0));
  total_remaining INTEGER := remaining_music + remaining_lyrics;
  skill_average NUMERIC := (COALESCE(p_skill_songwriting, 1) + COALESCE(p_skill_creativity, 1) + COALESCE(p_skill_composition, 1)) / 3.0;
  attr_average NUMERIC := (COALESCE(p_attr_creative_insight, 10) + COALESCE(p_attr_musical_ability, 10)) / 2.0;
  base_ratio NUMERIC := 0.30 + (random() * 0.20); -- 30-50% baseline
  skill_modifier NUMERIC := 1 + (skill_average / 120.0);
  attr_modifier NUMERIC := 1 + (attr_average / 240.0);
  total_gain INTEGER := 0;
  music_share NUMERIC := 0.5;
  music_gain INTEGER := 0;
  lyrics_gain INTEGER := 0;
  xp_earned INTEGER := 0;
BEGIN
  IF total_remaining = 0 THEN
    RETURN jsonb_build_object(
      'music_gain', 0,
      'lyrics_gain', 0,
      'xp_earned', 0,
      'skill_bonus', skill_average,
      'attr_bonus', attr_average
    );
  END IF;

  total_gain := LEAST(
    total_remaining,
    GREATEST(50, FLOOR(total_remaining * base_ratio * skill_modifier * attr_modifier))
  );

  IF remaining_music = 0 THEN
    music_share := 0;
  ELSIF remaining_lyrics = 0 THEN
    music_share := 1;
  ELSE
    music_share := (remaining_music::numeric / total_remaining) + ((random() - 0.5) * 0.2);
    music_share := LEAST(0.75, GREATEST(0.25, music_share));
  END IF;

  music_gain := LEAST(remaining_music, FLOOR(total_gain * music_share));
  lyrics_gain := LEAST(remaining_lyrics, total_gain - music_gain);

  xp_earned := GREATEST(5, FLOOR((music_gain + lyrics_gain) / 18) + FLOOR(skill_average / 12));

  RETURN jsonb_build_object(
    'music_gain', music_gain,
    'lyrics_gain', lyrics_gain,
    'xp_earned', xp_earned,
    'skill_bonus', skill_average,
    'attr_bonus', attr_average
  );
END;
$$ LANGUAGE plpgsql;

COMMIT;
