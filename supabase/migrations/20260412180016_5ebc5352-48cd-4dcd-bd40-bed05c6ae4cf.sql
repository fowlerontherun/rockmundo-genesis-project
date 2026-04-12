
-- Create storage bucket for radio host avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('radio-hosts', 'radio-hosts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Radio host avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'radio-hosts');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload radio host avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'radio-hosts');

-- Allow updates (upsert)
CREATE POLICY "Authenticated users can update radio host avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'radio-hosts');
