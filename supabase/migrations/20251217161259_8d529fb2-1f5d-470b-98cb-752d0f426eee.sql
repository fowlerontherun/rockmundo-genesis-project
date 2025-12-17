-- Reset songs with expired Replicate URLs so they can be regenerated
UPDATE songs 
SET 
  audio_url = NULL,
  audio_generation_status = 'pending',
  audio_generated_at = NULL
WHERE audio_url LIKE '%replicate.delivery%';