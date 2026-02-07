-- Add thumbnail_url column to dikcok_videos
ALTER TABLE public.dikcok_videos 
ADD COLUMN thumbnail_url TEXT;

-- Create storage bucket for DikCok thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('dikcok-thumbnails', 'dikcok-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to thumbnails
CREATE POLICY "DikCok thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'dikcok-thumbnails');

-- Allow authenticated users to upload thumbnails
CREATE POLICY "Authenticated users can upload DikCok thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dikcok-thumbnails' AND auth.role() = 'authenticated');
