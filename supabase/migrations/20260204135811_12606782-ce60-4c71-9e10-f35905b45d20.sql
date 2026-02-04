-- Add video generation tracking columns to music_videos
ALTER TABLE public.music_videos
ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
ADD COLUMN IF NOT EXISTS generation_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS generation_error text;

-- Create index for finding generating videos
CREATE INDEX IF NOT EXISTS idx_music_videos_status ON public.music_videos(status);

-- Update any stuck "generating" videos older than 10 minutes to "failed"
UPDATE public.music_videos
SET 
  status = 'failed',
  generation_error = 'Generation timed out after 10 minutes'
WHERE 
  status = 'generating' 
  AND generation_started_at < NOW() - INTERVAL '10 minutes';