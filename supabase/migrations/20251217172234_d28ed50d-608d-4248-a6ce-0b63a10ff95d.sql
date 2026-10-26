-- Random Events System

-- September 25 already creates public.random_events as the legacy timed
-- world-event table (with rarity, expiry and choices). Reuse that catalog
-- rather than destroying its rows when adding the choice/outcome model.
-- The older expiry NOT NULL column must allow choice-based events without
-- a scheduled expiry.
CREATE TABLE IF NOT EXISTS public.random_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'random',
  is_common BOOLEAN NOT NULL DEFAULT false,
  health_min INTEGER DEFAULT NULL,
  health_max INTEGER DEFAULT NULL,
  option_a_text TEXT NOT NULL,
  option_a_effects JSONB NOT NULL DEFAULT '{}',
  option_a_outcome_text TEXT NOT NULL,
  option_b_text TEXT NOT NULL,
  option_b_effects JSONB NOT NULL DEFAULT '{}',
  option_b_outcome_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reconcile new columns missing from the legacy world-events table.
-- Keep the old rarity/choices/metadata/expiry columns and existing records.
ALTER TABLE public.random_events
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'random',
  ADD COLUMN IF NOT EXISTS is_common boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_min integer,
  ADD COLUMN IF NOT EXISTS health_max integer,
  ADD COLUMN IF NOT EXISTS option_a_text text,
  ADD COLUMN IF NOT EXISTS option_a_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS option_a_outcome_text text,
  ADD COLUMN IF NOT EXISTS option_b_text text,
  ADD COLUMN IF NOT EXISTS option_b_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS option_b_outcome_text text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Legacy records need not have choice-outcome text; preserving NULL avoids
-- inventing player-facing choices in old event content.
-- A new event created through the modern interface supplies both choices.
DO $allow_nonexpiring_random_events$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='random_events'
      AND column_name='expiry') THEN
    ALTER TABLE public.random_events ALTER COLUMN expiry DROP NOT NULL;
  END IF;
END $allow_nonexpiring_random_events$;

-- Create player_events table (active/completed events for players)
CREATE TABLE IF NOT EXISTS public.player_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.random_events(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  choice_made TEXT CHECK (choice_made IN ('a', 'b')),
  choice_made_at TIMESTAMP WITH TIME ZONE,
  outcome_applied BOOLEAN NOT NULL DEFAULT false,
  outcome_applied_at TIMESTAMP WITH TIME ZONE,
  outcome_effects JSONB,
  outcome_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending_choice' CHECK (status IN ('pending_choice', 'awaiting_outcome', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player_event_history table (prevent repeats for non-common events)
CREATE TABLE IF NOT EXISTS public.player_event_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.random_events(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Enable RLS
ALTER TABLE public.random_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_event_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for random_events (read-only for all authenticated users, admin manages via service role)
CREATE POLICY "Anyone can read active events"
  ON public.random_events FOR SELECT
  USING (is_active = true);

-- RLS Policies for player_events
CREATE POLICY "Users can view their own events"
  ON public.player_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.player_events FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for player_event_history
CREATE POLICY "Users can view their own event history"
  ON public.player_event_history FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_random_events_category ON public.random_events(category);
CREATE INDEX IF NOT EXISTS idx_random_events_active ON public.random_events(is_active);
CREATE INDEX IF NOT EXISTS idx_player_events_user_status ON public.player_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_player_event_history_user ON public.player_event_history(user_id);

-- Trigger for updated_at
DO $random_event_trigger$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.random_events'::regclass
      AND tgname='update_random_events_updated_at' AND NOT tgisinternal) THEN
    CREATE TRIGGER update_random_events_updated_at
      BEFORE UPDATE ON public.random_events FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $random_event_trigger$;