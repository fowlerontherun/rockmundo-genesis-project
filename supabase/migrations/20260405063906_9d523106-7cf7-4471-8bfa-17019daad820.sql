-- Fix promotional_campaigns INSERT policy to also allow band-member inserts
DROP POLICY IF EXISTS "Users can create campaigns for their releases" ON public.promotional_campaigns;

CREATE POLICY "Users can create campaigns for their releases or bands"
ON public.promotional_campaigns
FOR INSERT
WITH CHECK (
  (release_id IN (SELECT id FROM releases WHERE user_id = auth.uid()))
  OR
  (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);

-- Add missing activity types to the check constraint
ALTER TABLE public.player_scheduled_activities
  DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;

ALTER TABLE public.player_scheduled_activities
  ADD CONSTRAINT player_scheduled_activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'songwriting','gig','rehearsal','busking','recording','travel','work',
    'university','reading','mentorship','youtube_video','health',
    'skill_practice','open_mic','pr_appearance','film_production',
    'jam_session','festival_attendance','festival_performance',
    'release_manufacturing','release_promo','teaching','other'
  ]));
