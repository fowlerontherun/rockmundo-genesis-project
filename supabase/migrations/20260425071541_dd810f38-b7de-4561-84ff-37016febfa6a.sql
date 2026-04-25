
CREATE TABLE IF NOT EXISTS public.coop_quest_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID NOT NULL REFERENCES public.coop_quests(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'started' | 'progress' | 'completed' | 'claimed'
  progress_a INT,
  progress_b INT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coop_quest_events_quest ON public.coop_quest_events(quest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coop_quest_events_pair ON public.coop_quest_events(pair_key, created_at DESC);

ALTER TABLE public.coop_quest_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quest members can view events"
ON public.coop_quest_events FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.coop_quests q
    JOIN public.profiles p ON p.id IN (q.profile_a_id, q.profile_b_id)
    WHERE q.id = coop_quest_events.quest_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Quest members can insert events"
ON public.coop_quest_events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.coop_quests q
    JOIN public.profiles p ON p.id IN (q.profile_a_id, q.profile_b_id)
    WHERE q.id = coop_quest_events.quest_id AND p.user_id = auth.uid()
  )
);
