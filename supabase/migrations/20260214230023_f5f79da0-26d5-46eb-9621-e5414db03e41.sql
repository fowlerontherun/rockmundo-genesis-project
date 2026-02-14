
-- Create player_dj_performances table
CREATE TABLE public.player_dj_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID,
  club_id UUID REFERENCES public.city_night_clubs(id) ON DELETE SET NULL,
  performance_score INTEGER NOT NULL DEFAULT 0,
  cash_earned INTEGER NOT NULL DEFAULT 0,
  fame_gained INTEGER NOT NULL DEFAULT 0,
  fans_gained INTEGER NOT NULL DEFAULT 0,
  xp_gained NUMERIC NOT NULL DEFAULT 0,
  outcome_text TEXT,
  set_length_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_dj_performances ENABLE ROW LEVEL SECURITY;

-- Users can read their own performances
CREATE POLICY "Users can view own DJ performances"
  ON public.player_dj_performances FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own performances
CREATE POLICY "Users can insert own DJ performances"
  ON public.player_dj_performances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_dj_performances_user_id ON public.player_dj_performances(user_id);
CREATE INDEX idx_dj_performances_club_id ON public.player_dj_performances(club_id);
CREATE INDEX idx_dj_performances_created_at ON public.player_dj_performances(created_at DESC);
