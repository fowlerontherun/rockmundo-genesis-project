
-- Character slots table
CREATE TABLE public.character_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  max_slots integer NOT NULL DEFAULT 1,
  extra_slots_purchased integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.character_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slots" ON public.character_slots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own slots" ON public.character_slots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own slots" ON public.character_slots
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Add columns to profiles for multi-character and permadeath
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS died_at timestamptz,
  ADD COLUMN IF NOT EXISTS death_cause text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS slot_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_profile_id uuid,
  ADD COLUMN IF NOT EXISTS generation_number integer DEFAULT 1;

-- Hall of Immortals table (dead characters memorial)
CREATE TABLE public.hall_of_immortals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid NOT NULL,
  character_name text NOT NULL,
  avatar_url text,
  bio text,
  cause_of_death text NOT NULL DEFAULT 'neglect',
  died_at timestamptz NOT NULL DEFAULT now(),
  age_at_death integer,
  years_active integer,
  total_fame integer DEFAULT 0,
  total_cash_at_death numeric DEFAULT 0,
  total_songs integer DEFAULT 0,
  total_gigs integer DEFAULT 0,
  total_albums integer DEFAULT 0,
  peak_chart_position integer,
  final_skills jsonb DEFAULT '{}',
  final_attributes jsonb DEFAULT '{}',
  notable_achievements jsonb DEFAULT '[]',
  band_history jsonb DEFAULT '[]',
  generation_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hall_of_immortals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view immortals" ON public.hall_of_immortals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own immortals" ON public.hall_of_immortals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
