
-- Add stage_behavior column to player_behavior_settings
ALTER TABLE public.player_behavior_settings 
ADD COLUMN IF NOT EXISTS stage_behavior text NOT NULL DEFAULT 'standard';

-- Create table for unlockable stage behavior types
CREATE TABLE public.player_unlocked_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  behavior_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlock_source text, -- e.g. 'skill_mastery', 'level_up', 'achievement', 'experience'
  UNIQUE(user_id, behavior_key)
);

ALTER TABLE public.player_unlocked_behaviors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own unlocked behaviors"
  ON public.player_unlocked_behaviors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unlocked behaviors"
  ON public.player_unlocked_behaviors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
