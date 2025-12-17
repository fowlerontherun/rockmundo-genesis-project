-- Update Christmas MotherCluckers song with the manually uploaded audio file
UPDATE songs 
SET 
  audio_url = '/music/christmas-mothercluckers.mp3',
  audio_generation_status = 'completed',
  audio_generated_at = NOW()
WHERE id = '021a09ba-c97e-4929-8649-59b1ff3d49eb';