-- Add audio generation columns to songs table if they don't exist
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_generation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS audio_prompt TEXT;

-- Add constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'songs_audio_generation_status_check'
  ) THEN
    ALTER TABLE public.songs 
    ADD CONSTRAINT songs_audio_generation_status_check 
    CHECK (audio_generation_status IN ('pending', 'generating', 'completed', 'failed'));
  END IF;
END $$;