
ALTER TABLE public.player_employment
  ADD COLUMN IF NOT EXISTS last_auto_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_attempt_outcome text,
  ADD COLUMN IF NOT EXISTS last_auto_attempt_reason text;
