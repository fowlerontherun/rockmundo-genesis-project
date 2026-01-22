-- Add tour_leg_id to player_travel_history for tracking tour-based travel
ALTER TABLE public.player_travel_history 
ADD COLUMN IF NOT EXISTS tour_leg_id uuid REFERENCES public.tour_travel_legs(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_player_travel_history_tour_leg 
ON public.player_travel_history(tour_leg_id) WHERE tour_leg_id IS NOT NULL;

-- Ensure RLS allows service role to write to band_song_familiarity
-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Service role can manage band song familiarity" ON public.band_song_familiarity;

CREATE POLICY "Service role can manage band song familiarity"
ON public.band_song_familiarity
FOR ALL
USING (true)
WITH CHECK (true);