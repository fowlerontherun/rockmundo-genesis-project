
-- Add profile_id column to player_behavior_settings
ALTER TABLE public.player_behavior_settings 
  ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Backfill profile_id from profiles table for existing rows
UPDATE public.player_behavior_settings pbs
SET profile_id = p.id
FROM public.profiles p
WHERE p.user_id = pbs.user_id;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view their own behavior settings" ON public.player_behavior_settings;
DROP POLICY IF EXISTS "Users can insert their own behavior settings" ON public.player_behavior_settings;
DROP POLICY IF EXISTS "Users can update their own behavior settings" ON public.player_behavior_settings;

-- Recreate RLS policies using auth.uid()
CREATE POLICY "Users can view their own behavior settings"
  ON public.player_behavior_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own behavior settings"
  ON public.player_behavior_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own behavior settings"
  ON public.player_behavior_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
