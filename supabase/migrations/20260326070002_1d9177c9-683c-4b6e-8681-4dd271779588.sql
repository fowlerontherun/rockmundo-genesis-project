-- Fix songs with audio but status='failed' → set to completed
UPDATE songs SET audio_generation_status = 'completed'
WHERE id IN ('0c9e525b-9091-418f-b426-9a3c51307dab', 'a3c65086-7cc4-43d2-894b-ded858c3c084', '2cf0e5bc-aad8-4e0b-a0e2-24e9a0514a61')
AND audio_url IS NOT NULL AND audio_generation_status = 'failed';

-- Reset stuck/failed songs without audio → allow retry
UPDATE songs SET audio_generation_status = NULL, audio_generation_started_at = NULL
WHERE id IN ('0024b633-d5d0-47da-9c90-cebdf343096b', '58b4e080-3128-41c9-976e-4938d176f496', '4967d592-c67f-4556-b4b8-879c2e890c3a', '032912b6-a066-4da7-a2c6-e5ddfe809e4d', '063ca8a8-2aa6-4195-bfad-9a016ec900a9')
AND audio_url IS NULL;

-- Reset stuck recording sessions so the fixed function can reprocess them
UPDATE recording_sessions SET status = 'in_progress'
WHERE status = 'in_progress' AND scheduled_end < NOW();