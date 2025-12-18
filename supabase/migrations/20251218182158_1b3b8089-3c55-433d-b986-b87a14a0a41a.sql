-- Add open_mic to the activity_type check constraint
ALTER TABLE public.player_scheduled_activities 
DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;

ALTER TABLE public.player_scheduled_activities 
ADD CONSTRAINT player_scheduled_activities_activity_type_check 
CHECK (activity_type IN (
  'songwriting', 'gig', 'rehearsal', 'busking', 'recording',
  'travel', 'work', 'university', 'reading', 'mentorship',
  'youtube_video', 'health', 'skill_practice', 'open_mic', 'other'
));

-- Create missing scheduled activity for existing open mic performance
INSERT INTO public.player_scheduled_activities (
  user_id,
  profile_id,
  activity_type,
  status,
  scheduled_start,
  scheduled_end,
  title,
  description,
  metadata
)
SELECT 
  omp.user_id,
  p.id,
  'open_mic',
  CASE 
    WHEN omp.status = 'completed' THEN 'completed'
    WHEN omp.status = 'cancelled' THEN 'cancelled'
    WHEN omp.status = 'in_progress' THEN 'in_progress'
    ELSE 'scheduled'
  END,
  omp.scheduled_date,
  omp.scheduled_date + INTERVAL '30 minutes',
  'Open Mic at ' || omv.name,
  'Open mic night performance - 2 songs',
  jsonb_build_object('band_id', omp.band_id, 'linked_open_mic_id', omp.id)
FROM public.open_mic_performances omp
JOIN public.open_mic_venues omv ON omv.id = omp.venue_id
JOIN public.profiles p ON p.user_id = omp.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.player_scheduled_activities psa 
  WHERE psa.metadata->>'linked_open_mic_id' = omp.id::text
);