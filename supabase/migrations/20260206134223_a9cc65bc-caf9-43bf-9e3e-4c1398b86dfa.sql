-- Reset all songs stuck in 'generating' status for more than 10 minutes to 'failed'
UPDATE songs 
SET audio_generation_status = 'failed'
WHERE audio_generation_status = 'generating' 
  AND audio_generation_started_at < NOW() - INTERVAL '10 minutes';
