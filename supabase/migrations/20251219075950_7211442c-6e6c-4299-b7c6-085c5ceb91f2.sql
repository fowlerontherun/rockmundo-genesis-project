-- Add pr_appearance and film_production to the activity_type check constraint
ALTER TABLE public.player_scheduled_activities 
DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;

ALTER TABLE public.player_scheduled_activities 
ADD CONSTRAINT player_scheduled_activities_activity_type_check 
CHECK (activity_type IN (
  'songwriting', 'gig', 'rehearsal', 'busking', 'recording',
  'travel', 'work', 'university', 'reading', 'mentorship',
  'youtube_video', 'health', 'skill_practice', 'open_mic', 
  'pr_appearance', 'film_production', 'other'
));