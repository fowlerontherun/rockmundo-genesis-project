-- Prison System Schema
-- Version 1.0.194

-- Create prisons table (one per city)
CREATE TABLE public.prisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  security_level text NOT NULL DEFAULT 'medium' CHECK (security_level IN ('minimum', 'medium', 'maximum')),
  daily_cost integer NOT NULL DEFAULT 50,
  rehabilitation_rating integer NOT NULL DEFAULT 50 CHECK (rehabilitation_rating >= 1 AND rehabilitation_rating <= 100),
  escape_difficulty integer NOT NULL DEFAULT 90 CHECK (escape_difficulty >= 1 AND escape_difficulty <= 100),
  has_music_program boolean NOT NULL DEFAULT false,
  capacity integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create player_imprisonments table
CREATE TABLE public.player_imprisonments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prison_id uuid NOT NULL REFERENCES prisons(id) ON DELETE CASCADE,
  imprisoned_at timestamptz NOT NULL DEFAULT now(),
  original_sentence_days integer NOT NULL,
  remaining_sentence_days integer NOT NULL,
  release_date timestamptz NOT NULL,
  released_at timestamptz,
  debt_amount_cleared bigint NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'debt_default',
  status text NOT NULL DEFAULT 'imprisoned' CHECK (status IN ('imprisoned', 'released', 'escaped', 'bailed')),
  behavior_score integer NOT NULL DEFAULT 50 CHECK (behavior_score >= 0 AND behavior_score <= 100),
  songs_written integer NOT NULL DEFAULT 0,
  good_behavior_days_earned integer NOT NULL DEFAULT 0,
  escape_attempts integer NOT NULL DEFAULT 0,
  bail_amount bigint,
  bail_paid_by uuid REFERENCES auth.users(id),
  cellmate_name text,
  cellmate_skill text,
  cellmate_skill_bonus integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create player_criminal_record table
CREATE TABLE public.player_criminal_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imprisonment_id uuid NOT NULL REFERENCES player_imprisonments(id) ON DELETE CASCADE,
  offense_type text NOT NULL,
  sentence_served_days integer NOT NULL,
  behavior_rating text NOT NULL CHECK (behavior_rating IN ('exemplary', 'good', 'average', 'poor')),
  escaped boolean NOT NULL DEFAULT false,
  pardoned boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Create prison_events table
CREATE TABLE public.prison_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('opportunity', 'danger', 'social', 'escape')),
  is_common boolean NOT NULL DEFAULT false,
  behavior_min integer,
  behavior_max integer,
  option_a_text text NOT NULL,
  option_a_effects jsonb NOT NULL DEFAULT '{}',
  option_b_text text NOT NULL,
  option_b_effects jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create player_prison_events table
CREATE TABLE public.player_prison_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imprisonment_id uuid NOT NULL REFERENCES player_imprisonments(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES prison_events(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  choice_made text CHECK (choice_made IN ('a', 'b')),
  outcome_applied boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired'))
);

-- Create community_service_assignments table
CREATE TABLE public.community_service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_amount bigint NOT NULL,
  required_busking_sessions integer NOT NULL DEFAULT 10,
  completed_sessions integer NOT NULL DEFAULT 0,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS debt_started_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_imprisoned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_wanted boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_imprisonments integer NOT NULL DEFAULT 0;

-- Enable RLS on all new tables
ALTER TABLE public.prisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_imprisonments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_criminal_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prison_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_prison_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_service_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prisons (public read)
CREATE POLICY "Prisons are publicly readable" ON public.prisons FOR SELECT USING (true);

-- RLS Policies for player_imprisonments
CREATE POLICY "Users can view their own imprisonments" ON public.player_imprisonments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert imprisonments" ON public.player_imprisonments FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update imprisonments" ON public.player_imprisonments FOR UPDATE USING (true);

-- RLS Policies for player_criminal_record
CREATE POLICY "Users can view their own criminal record" ON public.player_criminal_record FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert criminal records" ON public.player_criminal_record FOR INSERT WITH CHECK (true);

-- RLS Policies for prison_events (public read)
CREATE POLICY "Prison events are publicly readable" ON public.prison_events FOR SELECT USING (true);

-- RLS Policies for player_prison_events
CREATE POLICY "Users can view their own prison events" ON public.player_prison_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert prison events" ON public.player_prison_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own prison events" ON public.player_prison_events FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for community_service_assignments
CREATE POLICY "Users can view their own community service" ON public.community_service_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert community service" ON public.community_service_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update community service" ON public.community_service_assignments FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX idx_player_imprisonments_user_id ON public.player_imprisonments(user_id);
CREATE INDEX idx_player_imprisonments_status ON public.player_imprisonments(status);
CREATE INDEX idx_player_criminal_record_user_id ON public.player_criminal_record(user_id);
CREATE INDEX idx_player_prison_events_user_id ON public.player_prison_events(user_id);
CREATE INDEX idx_player_prison_events_status ON public.player_prison_events(status);
CREATE INDEX idx_community_service_user_id ON public.community_service_assignments(user_id);
CREATE INDEX idx_community_service_status ON public.community_service_assignments(status);
CREATE INDEX idx_prisons_city_id ON public.prisons(city_id);

-- Function to check if user is imprisoned
CREATE OR REPLACE FUNCTION public.is_user_imprisoned(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_user_id
    AND is_imprisoned = true
  );
END;
$$;

-- Function to calculate bail amount
CREATE OR REPLACE FUNCTION public.calculate_bail_amount(p_imprisonment_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt_cleared bigint;
  v_remaining_days integer;
BEGIN
  SELECT debt_amount_cleared, remaining_sentence_days
  INTO v_debt_cleared, v_remaining_days
  FROM player_imprisonments
  WHERE id = p_imprisonment_id;
  
  RETURN FLOOR(v_debt_cleared * 0.5) + (v_remaining_days * 500);
END;
$$;

-- Function to calculate early release days based on behavior
CREATE OR REPLACE FUNCTION public.calculate_early_release_days(p_behavior_score integer, p_original_sentence integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN p_behavior_score >= 90 THEN CEIL(p_original_sentence * 0.25)
    WHEN p_behavior_score >= 75 THEN CEIL(p_original_sentence * 0.15)
    WHEN p_behavior_score >= 60 THEN CEIL(p_original_sentence * 0.10)
    ELSE 0
  END;
END;
$$;