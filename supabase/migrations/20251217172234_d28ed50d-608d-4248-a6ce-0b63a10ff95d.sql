-- Random Events System

-- Create random_events table (event catalog)
CREATE TABLE public.random_events (
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

-- Create player_events table (active/completed events for players)
CREATE TABLE public.player_events (
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
CREATE TABLE public.player_event_history (
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
CREATE INDEX idx_random_events_category ON public.random_events(category);
CREATE INDEX idx_random_events_active ON public.random_events(is_active);
CREATE INDEX idx_player_events_user_status ON public.player_events(user_id, status);
CREATE INDEX idx_player_event_history_user ON public.player_event_history(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_random_events_updated_at
  BEFORE UPDATE ON public.random_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();