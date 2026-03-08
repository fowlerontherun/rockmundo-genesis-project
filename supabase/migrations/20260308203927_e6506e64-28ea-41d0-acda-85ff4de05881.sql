INSERT INTO storage.buckets (id, name, public) VALUES ('hub-tile-images', 'hub-tile-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for hub tile images" ON storage.objects FOR SELECT USING (bucket_id = 'hub-tile-images');

CREATE POLICY "Service role can upload hub tile images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hub-tile-images');

CREATE POLICY "Service role can update hub tile images" ON storage.objects FOR UPDATE USING (bucket_id = 'hub-tile-images');