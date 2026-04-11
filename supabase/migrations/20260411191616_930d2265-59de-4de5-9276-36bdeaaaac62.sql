-- Fix player_dj_performances RLS policies
-- The old policies check auth.uid() = user_id, but user_id is being set to profile_id
-- Fix to use profile_id matching like all other tables

DROP POLICY IF EXISTS "Users can insert own DJ performances" ON public.player_dj_performances;
DROP POLICY IF EXISTS "Users can view own DJ performances" ON public.player_dj_performances;

CREATE POLICY "Users can insert own DJ performances"
ON public.player_dj_performances
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can view own DJ performances"
ON public.player_dj_performances
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);