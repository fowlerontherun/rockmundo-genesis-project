-- Cancel stuck generating songs so they can be regenerated with the new model
UPDATE songs 
SET audio_generation_status = 'failed', 
    audio_url = NULL,
    audio_generated_at = NULL
WHERE audio_generation_status = 'generating';

-- Also mark any generating attempts as cancelled
UPDATE song_generation_attempts
SET status = 'cancelled',
    completed_at = NOW(),
    error_message = 'Cancelled to allow regeneration with new model'
WHERE status = 'generating';