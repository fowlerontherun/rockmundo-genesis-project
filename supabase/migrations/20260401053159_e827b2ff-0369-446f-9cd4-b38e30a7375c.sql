
-- Jam Session 2.0: Add venue traits, challenges, and session roles

-- Add venue_trait and challenge columns to jam_sessions
ALTER TABLE public.jam_sessions 
  ADD COLUMN IF NOT EXISTS venue_trait text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS venue_trait_bonus jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS challenge_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS challenge_completed boolean DEFAULT false;

-- Jam session challenges table
CREATE TABLE IF NOT EXISTS public.jam_session_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  genre_requirement text DEFAULT NULL,
  min_participants integer DEFAULT 2,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'legendary')),
  xp_bonus_pct integer DEFAULT 25,
  requirements jsonb DEFAULT '{}',
  rewards jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Jam session participant roles
ALTER TABLE public.jam_session_participants
  ADD COLUMN IF NOT EXISTS session_role text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instrument text DEFAULT NULL;

-- Seed some venue traits
INSERT INTO public.jam_session_challenges (name, description, genre_requirement, difficulty, xp_bonus_pct, requirements) VALUES
  ('Genre Master', 'All participants must match the session genre with their primary skill', NULL, 'easy', 15, '{"genre_match": true}'),
  ('Speed Demons', 'Complete a session at 180+ BPM tempo', NULL, 'medium', 25, '{"min_tempo": 180}'),
  ('Full House', 'Fill the session to max capacity before starting', NULL, 'easy', 20, '{"full_capacity": true}'),
  ('Acoustic Unplugged', 'Run a session with acoustic instruments only', NULL, 'medium', 30, '{"acoustic_only": true}'),
  ('Marathon Jam', 'Complete a session lasting 3+ hours', NULL, 'hard', 50, '{"min_duration_hours": 3}'),
  ('Genre Fusion', 'Mix 3+ different instrument types in one session', NULL, 'medium', 35, '{"min_instrument_types": 3}'),
  ('Synergy Masters', 'Achieve 80%+ synergy score by session end', NULL, 'hard', 40, '{"min_synergy": 80}'),
  ('Vibe Check', 'Reach 90%+ mood score during the session', NULL, 'hard', 45, '{"min_mood": 90}'),
  ('Legendary Jam', 'Max capacity, 80%+ synergy, 90%+ mood, and 3+ hours', NULL, 'legendary', 100, '{"full_capacity": true, "min_synergy": 80, "min_mood": 90, "min_duration_hours": 3}')
ON CONFLICT DO NOTHING;

-- Enable RLS on challenges
ALTER TABLE public.jam_session_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON public.jam_session_challenges FOR SELECT
  TO authenticated
  USING (is_active = true);
