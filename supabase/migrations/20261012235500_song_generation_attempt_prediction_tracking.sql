-- Keep a durable, uniquely linkable generation attempt for both player and admin requests.
ALTER TABLE public.song_generation_attempts
  ADD COLUMN IF NOT EXISTS provider_prediction_id text,
  ADD COLUMN IF NOT EXISTS triggered_by_user_id uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS song_generation_attempts_prediction_id_unique
  ON public.song_generation_attempts (provider_prediction_id)
  WHERE provider_prediction_id IS NOT NULL;
