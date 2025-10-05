-- Add missing columns to songwriting_projects table
ALTER TABLE public.songwriting_projects
ADD COLUMN IF NOT EXISTS song_rating integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS creative_brief jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS purpose character varying DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mode character varying DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sessions_completed integer DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.songwriting_projects.song_rating IS 'Song quality rating from 0-1000';
COMMENT ON COLUMN public.songwriting_projects.creative_brief IS 'JSON object containing creative brief details';
COMMENT ON COLUMN public.songwriting_projects.genres IS 'Array of genre tags for the project';
COMMENT ON COLUMN public.songwriting_projects.purpose IS 'Purpose of the song (e.g., personal, commercial)';
COMMENT ON COLUMN public.songwriting_projects.mode IS 'Writing mode (solo, collaborative, etc.)';
COMMENT ON COLUMN public.songwriting_projects.sessions_completed IS 'Number of completed songwriting sessions';