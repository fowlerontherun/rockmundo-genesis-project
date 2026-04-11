
-- Club reputation system
CREATE TABLE public.player_club_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.city_night_clubs(id) ON DELETE CASCADE,
  visit_count INTEGER NOT NULL DEFAULT 0,
  dj_sets_played INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  reputation_tier TEXT NOT NULL DEFAULT 'newcomer' CHECK (reputation_tier IN ('newcomer', 'regular', 'vip', 'legend')),
  reputation_points INTEGER NOT NULL DEFAULT 0,
  perks_unlocked JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, club_id)
);

ALTER TABLE public.player_club_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own club reputation"
  ON public.player_club_reputation FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own club reputation"
  ON public.player_club_reputation FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own club reputation"
  ON public.player_club_reputation FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_player_club_rep_profile ON public.player_club_reputation(profile_id);
CREATE INDEX idx_player_club_rep_club ON public.player_club_reputation(club_id);

CREATE TRIGGER update_player_club_reputation_updated_at
  BEFORE UPDATE ON public.player_club_reputation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
