-- Add 'jam_session' to the allowed activity types
ALTER TABLE public.player_scheduled_activities 
DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;

ALTER TABLE public.player_scheduled_activities 
ADD CONSTRAINT player_scheduled_activities_activity_type_check 
CHECK (activity_type IN (
  'songwriting', 'gig', 'rehearsal', 'busking', 'recording',
  'travel', 'work', 'university', 'reading', 'mentorship',
  'youtube_video', 'health', 'skill_practice', 'open_mic', 
  'pr_appearance', 'film_production', 'jam_session', 'other'
));

-- Add linked_jam_session_id column to player_scheduled_activities
ALTER TABLE public.player_scheduled_activities
ADD COLUMN IF NOT EXISTS linked_jam_session_id UUID REFERENCES jam_sessions(id) ON DELETE SET NULL;