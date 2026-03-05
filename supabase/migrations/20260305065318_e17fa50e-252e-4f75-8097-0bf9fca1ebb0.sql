-- Stage Practice session results table
CREATE TABLE public.stage_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_slug text NOT NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  song_title text NOT NULL DEFAULT 'Practice Track',
  level_reached integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  accuracy_pct numeric(5,2) NOT NULL DEFAULT 0,
  longest_combo integer NOT NULL DEFAULT 0,
  notes_hit integer NOT NULL DEFAULT 0,
  notes_missed integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  difficulty text NOT NULL DEFAULT 'normal',
  played_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for daily cap lookups
CREATE INDEX idx_stage_practice_user_day ON public.stage_practice_sessions(user_id, played_at);

-- RLS
ALTER TABLE public.stage_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own practice sessions"
  ON public.stage_practice_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice sessions"
  ON public.stage_practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);