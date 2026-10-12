-- Prevent concurrent copies of one band's activity in the same member diary.
-- Preserve historical rows; mark duplicate active mirrors as cancelled.
WITH duplicates AS (
 SELECT id,row_number() OVER(PARTITION BY profile_id,activity_type,linked_gig_id
 ORDER BY scheduled_start,id) AS position FROM public.player_scheduled_activities
 WHERE linked_gig_id IS NOT NULL AND status IN ('scheduled','in_progress')
)
UPDATE public.player_scheduled_activities a SET status='cancelled'
FROM duplicates d WHERE a.id=d.id AND d.position>1;
WITH duplicates AS (
 SELECT id,row_number() OVER(PARTITION BY profile_id,activity_type,linked_recording_id
 ORDER BY scheduled_start,id) AS position FROM public.player_scheduled_activities
 WHERE linked_recording_id IS NOT NULL AND status IN ('scheduled','in_progress')
)
UPDATE public.player_scheduled_activities a SET status='cancelled'
FROM duplicates d WHERE a.id=d.id AND d.position>1;
WITH duplicates AS (
 SELECT id,row_number() OVER(PARTITION BY profile_id,activity_type,linked_rehearsal_id
 ORDER BY scheduled_start,id) AS position FROM public.player_scheduled_activities
 WHERE linked_rehearsal_id IS NOT NULL AND status IN ('scheduled','in_progress')
)
UPDATE public.player_scheduled_activities a SET status='cancelled'
FROM duplicates d WHERE a.id=d.id AND d.position>1;
WITH duplicates AS (
 SELECT id,row_number() OVER(PARTITION BY profile_id,activity_type,scheduled_start,
 scheduled_end,(metadata->>'band_id')) AS position FROM public.player_scheduled_activities
 WHERE linked_gig_id IS NULL AND linked_recording_id IS NULL AND linked_rehearsal_id IS NULL
 AND metadata->>'is_band_activity'='true' AND status IN ('scheduled','in_progress')
)
UPDATE public.player_scheduled_activities a SET status='cancelled'
FROM duplicates d WHERE a.id=d.id AND d.position>1;

CREATE UNIQUE INDEX IF NOT EXISTS band_diary_unique_gig
 ON public.player_scheduled_activities(profile_id,activity_type,linked_gig_id)
 WHERE linked_gig_id IS NOT NULL AND status IN ('scheduled','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS band_diary_unique_recording
 ON public.player_scheduled_activities(profile_id,activity_type,linked_recording_id)
 WHERE linked_recording_id IS NOT NULL AND status IN ('scheduled','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS band_diary_unique_rehearsal
 ON public.player_scheduled_activities(profile_id,activity_type,linked_rehearsal_id)
 WHERE linked_rehearsal_id IS NOT NULL AND status IN ('scheduled','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS band_diary_unique_unlinked
 ON public.player_scheduled_activities(profile_id,activity_type,scheduled_start,scheduled_end,(metadata->>'band_id'))
 WHERE linked_gig_id IS NULL AND linked_recording_id IS NULL AND linked_rehearsal_id IS NULL
 AND metadata->>'is_band_activity'='true' AND status IN ('scheduled','in_progress');
