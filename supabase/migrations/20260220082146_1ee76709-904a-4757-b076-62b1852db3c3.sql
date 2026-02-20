
-- =====================================================
-- DYNAMIC EMOTIONAL ENGINE
-- Per-character emotional state with event-driven changes
-- =====================================================

-- Core emotional state per player profile
CREATE TABLE public.character_emotional_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL UNIQUE,
  
  -- Core emotional attributes (0–100 scale)
  happiness INTEGER NOT NULL DEFAULT 50 CHECK (happiness >= 0 AND happiness <= 100),
  loneliness INTEGER NOT NULL DEFAULT 30 CHECK (loneliness >= 0 AND loneliness <= 100),
  inspiration INTEGER NOT NULL DEFAULT 50 CHECK (inspiration >= 0 AND inspiration <= 100),
  jealousy INTEGER NOT NULL DEFAULT 0 CHECK (jealousy >= 0 AND jealousy <= 100),
  resentment INTEGER NOT NULL DEFAULT 0 CHECK (resentment >= 0 AND resentment <= 100),
  obsession INTEGER NOT NULL DEFAULT 0 CHECK (obsession >= 0 AND obsession <= 100),
  
  -- Derived modifier caches (recalculated on change)
  songwriting_modifier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  performance_modifier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  interaction_modifier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  
  -- Timestamps
  last_event_at TIMESTAMPTZ DEFAULT now(),
  last_decay_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event log tracking what changed emotions and why
CREATE TABLE public.emotional_state_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  
  -- What triggered the change
  event_source TEXT NOT NULL, -- 'relationship', 'gig', 'songwriting', 'chart', 'band', 'social', 'news', 'decay', 'system'
  event_type TEXT NOT NULL,   -- e.g. 'friend_gained', 'gig_failed', 'song_charted', 'betrayal'
  source_id TEXT,             -- ID of the triggering entity
  
  -- Score deltas
  happiness_change INTEGER DEFAULT 0,
  loneliness_change INTEGER DEFAULT 0,
  inspiration_change INTEGER DEFAULT 0,
  jealousy_change INTEGER DEFAULT 0,
  resentment_change INTEGER DEFAULT 0,
  obsession_change INTEGER DEFAULT 0,
  
  -- Context
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_emotional_states_profile ON public.character_emotional_states(profile_id);
CREATE INDEX idx_emotional_events_profile ON public.emotional_state_events(profile_id);
CREATE INDEX idx_emotional_events_source ON public.emotional_state_events(event_source, event_type);
CREATE INDEX idx_emotional_events_created ON public.emotional_state_events(created_at);

-- Enable RLS
ALTER TABLE public.character_emotional_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_state_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Players can view own emotional state"
ON public.character_emotional_states FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own emotional state"
ON public.character_emotional_states FOR UPDATE
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own emotional state"
ON public.character_emotional_states FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can view own emotional events"
ON public.emotional_state_events FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own emotional events"
ON public.emotional_state_events FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Service role for edge functions
CREATE POLICY "Service role full access emotional states"
ON public.character_emotional_states FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access emotional events"
ON public.emotional_state_events FOR ALL
USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_emotional_states_updated_at
BEFORE UPDATE ON public.character_emotional_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to recalculate modifier caches after emotional state changes
CREATE OR REPLACE FUNCTION public.recalculate_emotional_modifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sw_mod NUMERIC;
  perf_mod NUMERIC;
  int_mod NUMERIC;
BEGIN
  -- SONGWRITING MODIFIER
  -- High inspiration boosts, high resentment adds edge, loneliness can inspire
  -- Obsession focuses but happiness grounds
  sw_mod := 1.0
    + (NEW.inspiration - 50) * 0.006        -- +/-30% from inspiration
    + (NEW.happiness - 50) * 0.002           -- +/-10% from happiness
    + LEAST(NEW.loneliness, 70) * 0.002      -- Up to +14% from loneliness (tortured artist)
    + LEAST(NEW.obsession, 60) * 0.002       -- Up to +12% from obsession (focus)
    - GREATEST(NEW.resentment - 60, 0) * 0.004; -- Extreme resentment blocks creativity
  
  -- PERFORMANCE MODIFIER
  -- Happiness and inspiration boost, loneliness/resentment hurt
  perf_mod := 1.0
    + (NEW.happiness - 50) * 0.005           -- +/-25% from happiness
    + (NEW.inspiration - 50) * 0.003         -- +/-15% from inspiration
    - GREATEST(NEW.loneliness - 40, 0) * 0.003  -- Loneliness drains stage energy
    - GREATEST(NEW.resentment - 50, 0) * 0.003  -- Resentment causes tension
    + LEAST(NEW.obsession, 40) * 0.001;      -- Mild obsession = driven performer

  -- INTERACTION MODIFIER (success chance for social actions)
  -- Happiness helps, jealousy/resentment hurt
  int_mod := 1.0
    + (NEW.happiness - 50) * 0.004           -- +/-20% from happiness
    - GREATEST(NEW.jealousy - 30, 0) * 0.004 -- Jealousy poisons interactions
    - GREATEST(NEW.resentment - 40, 0) * 0.003
    - GREATEST(NEW.obsession - 70, 0) * 0.005; -- Extreme obsession is off-putting

  -- Clamp modifiers to 0.5–1.5 range
  NEW.songwriting_modifier := GREATEST(0.50, LEAST(1.50, ROUND(sw_mod, 2)));
  NEW.performance_modifier := GREATEST(0.50, LEAST(1.50, ROUND(perf_mod, 2)));
  NEW.interaction_modifier := GREATEST(0.50, LEAST(1.50, ROUND(int_mod, 2)));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalculate_emotional_modifiers_trigger
BEFORE UPDATE ON public.character_emotional_states
FOR EACH ROW EXECUTE FUNCTION public.recalculate_emotional_modifiers();
