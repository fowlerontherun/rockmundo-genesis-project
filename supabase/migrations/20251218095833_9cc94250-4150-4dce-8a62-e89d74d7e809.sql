-- Add age and character_birth_date columns to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 16,
ADD COLUMN IF NOT EXISTS character_birth_date DATE,
ADD COLUMN IF NOT EXISTS last_retirement_prompt_age INTEGER DEFAULT 0;

-- Create skill snapshots table for age 60+ tracking
CREATE TABLE IF NOT EXISTS public.player_skill_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_at_age INTEGER NOT NULL DEFAULT 60,
  skills_snapshot JSONB NOT NULL,
  attributes_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, snapshot_at_age)
);

-- Enable RLS
ALTER TABLE public.player_skill_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for skill snapshots
CREATE POLICY "Users can view own skill snapshots" ON public.player_skill_snapshots
  FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own skill snapshots" ON public.player_skill_snapshots
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Hall of Fame table for retired characters
CREATE TABLE IF NOT EXISTS public.hall_of_fame (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  avatar_url TEXT,
  final_age INTEGER NOT NULL,
  years_active INTEGER NOT NULL,
  total_fame BIGINT DEFAULT 0,
  total_cash_earned BIGINT DEFAULT 0,
  total_songs INTEGER DEFAULT 0,
  total_gigs INTEGER DEFAULT 0,
  total_albums INTEGER DEFAULT 0,
  peak_chart_position INTEGER,
  notable_achievements JSONB DEFAULT '[]'::jsonb,
  final_skills JSONB,
  final_attributes JSONB,
  retired_at TIMESTAMPTZ DEFAULT now(),
  retirement_type TEXT DEFAULT 'voluntary', -- 'voluntary' | 'mandatory'
  generation_number INTEGER DEFAULT 1
);

-- Enable RLS on hall_of_fame
ALTER TABLE public.hall_of_fame ENABLE ROW LEVEL SECURITY;

-- Hall of fame is publicly viewable
CREATE POLICY "Hall of fame is publicly viewable" ON public.hall_of_fame
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own hall of fame entries" ON public.hall_of_fame
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Character generations table for tracking lineage and inheritance
CREATE TABLE IF NOT EXISTS public.character_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_number INTEGER DEFAULT 1,
  parent_character_id UUID REFERENCES public.hall_of_fame(id),
  inherited_cash BIGINT DEFAULT 0,
  inherited_skills JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.character_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own character generations" ON public.character_generations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own character generations" ON public.character_generations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_total_fame ON public.hall_of_fame(total_fame DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_user_id ON public.hall_of_fame(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_snapshots_profile ON public.player_skill_snapshots(profile_id);
CREATE INDEX IF NOT EXISTS idx_character_generations_user ON public.character_generations(user_id);