-- Fix the specific song: it has audio_url but status is 'failed'
UPDATE public.songs 
SET audio_generation_status = 'completed'
WHERE id = 'ed4d2171-e4bf-4aee-9376-bc6420f81dd7' 
  AND audio_url IS NOT NULL;