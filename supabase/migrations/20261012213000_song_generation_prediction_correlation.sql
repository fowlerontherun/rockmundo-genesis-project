-- Correlate provider callbacks with the exact generation attempt.
ALTER TABLE public.song_generation_attempts
  ADD COLUMN IF NOT EXISTS prediction_id text;
CREATE UNIQUE INDEX IF NOT EXISTS song_generation_attempts_prediction_unique
  ON public.song_generation_attempts(prediction_id)
  WHERE prediction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS song_generation_attempts_song_active
  ON public.song_generation_attempts(song_id, started_at DESC)
  WHERE status = 'generating';
