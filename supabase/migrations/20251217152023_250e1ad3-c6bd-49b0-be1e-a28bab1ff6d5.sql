-- Create music storage bucket for AI-generated songs
INSERT INTO storage.buckets (id, name, public)
VALUES ('music', 'music', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to music files
CREATE POLICY "Music files are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'music');

-- Allow authenticated users to upload music
CREATE POLICY "Authenticated users can upload music" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'music' AND auth.role() = 'authenticated');

-- Allow service role to upload (for edge functions)
CREATE POLICY "Service role can manage music" ON storage.objects
FOR ALL USING (bucket_id = 'music');