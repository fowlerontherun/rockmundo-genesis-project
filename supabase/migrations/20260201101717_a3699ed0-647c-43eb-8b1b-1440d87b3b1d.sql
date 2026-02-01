-- Add video_url column to music_videos table to store AI-generated video files
ALTER TABLE public.music_videos ADD COLUMN video_url TEXT NULL;

-- Add generation metadata columns
ALTER TABLE public.music_videos ADD COLUMN generation_started_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.music_videos ADD COLUMN generation_error TEXT NULL;

-- Add index for queries on videos with generated content
CREATE INDEX idx_music_videos_video_url ON public.music_videos(video_url) WHERE video_url IS NOT NULL;