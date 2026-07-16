
ALTER TABLE public.recording_sessions
  ADD COLUMN IF NOT EXISTS final_master_quality integer,
  ADD COLUMN IF NOT EXISTS source_song_quality integer,
  ADD COLUMN IF NOT EXISTS applied_variance numeric,
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS outcome_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS xp_awards jsonb,
  ADD COLUMN IF NOT EXISTS recording_credits jsonb,
  ADD COLUMN IF NOT EXISTS session_data jsonb DEFAULT '{}'::jsonb;
