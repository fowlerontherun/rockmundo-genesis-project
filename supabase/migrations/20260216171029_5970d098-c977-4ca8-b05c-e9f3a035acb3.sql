
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS poster_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('festival-posters', 'festival-posters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Festival posters are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'festival-posters');

CREATE POLICY "Service role can upload festival posters"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'festival-posters');

CREATE POLICY "Service role can update festival posters"
ON storage.objects FOR UPDATE
USING (bucket_id = 'festival-posters');
