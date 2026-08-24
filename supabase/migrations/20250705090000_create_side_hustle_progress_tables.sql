-- Track player side hustle progression and mini-game attempts
CREATE TABLE public.side_hustle_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  minigame_type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  experience integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  last_result text,
  last_played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT side_hustle_progress_unique_profile_activity UNIQUE (profile_id, activity_id)
);

CREATE TABLE public.side_hustle_minigame_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  minigame_type text NOT NULL,
  score integer NOT NULL,
  accuracy numeric(5,2) NOT NULL,
  xp_earned integer NOT NULL,
  cash_reward integer NOT NULL,
  duration_seconds integer NOT NULL,
  difficulty integer NOT NULL,
  success boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX side_hustle_progress_profile_idx
  ON public.side_hustle_progress (profile_id);

CREATE INDEX side_hustle_minigame_attempts_profile_idx
  ON public.side_hustle_minigame_attempts (profile_id);

ALTER TABLE public.side_hustle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.side_hustle_minigame_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their side hustle progress"
ON public.side_hustle_progress
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Players can manage their side hustle progress"
ON public.side_hustle_progress
FOR ALL
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Players can view their mini-game attempts"
ON public.side_hustle_minigame_attempts
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Players can insert their mini-game attempts"
ON public.side_hustle_minigame_attempts
FOR INSERT
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Players can delete their mini-game attempts"
ON public.side_hustle_minigame_attempts
FOR DELETE
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE TRIGGER update_side_hustle_progress_updated_at
BEFORE UPDATE ON public.side_hustle_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
