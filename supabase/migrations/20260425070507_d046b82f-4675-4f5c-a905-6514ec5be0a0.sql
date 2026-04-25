
-- Co-op Quests: shared daily/weekly goals between friends that grant bonus XP

CREATE TABLE IF NOT EXISTS public.coop_quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL,
  quest_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_count INT NOT NULL DEFAULT 1,
  progress_a INT NOT NULL DEFAULT 0,
  progress_b INT NOT NULL DEFAULT 0,
  reward_xp INT NOT NULL DEFAULT 0,
  reward_skill_xp INT NOT NULL DEFAULT 0,
  reward_skill_slug TEXT,
  cadence TEXT NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  claimed_by_a BOOLEAN NOT NULL DEFAULT false,
  claimed_by_b BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coop_quests_pair ON public.coop_quests(pair_key, expires_at);
CREATE INDEX IF NOT EXISTS idx_coop_quests_profile_a ON public.coop_quests(profile_a_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_coop_quests_profile_b ON public.coop_quests(profile_b_id, expires_at);

ALTER TABLE public.coop_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their coop quests"
ON public.coop_quests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN (profile_a_id, profile_b_id) AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their coop quests"
ON public.coop_quests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN (profile_a_id, profile_b_id) AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert coop quests for their pair"
ON public.coop_quests FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN (profile_a_id, profile_b_id) AND p.user_id = auth.uid()
  )
);

CREATE TRIGGER update_coop_quests_updated_at
BEFORE UPDATE ON public.coop_quests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Helper to compute the canonical pair key (sorted UUIDs joined by ':')
CREATE OR REPLACE FUNCTION public.coop_quest_pair_key(_a UUID, _b UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN _a::text < _b::text THEN _a::text || ':' || _b::text ELSE _b::text || ':' || _a::text END;
$$;
