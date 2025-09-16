-- Add audio layer metadata to songs for storing recording references
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS audio_layers jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.songs.audio_layers IS 'Collection of recording layer metadata objects ({name, url, storagePath, duration}).';
