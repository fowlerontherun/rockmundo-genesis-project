-- Table to store uploaded audio for default practice tracks
CREATE TABLE public.practice_track_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id text NOT NULL UNIQUE,
  track_title text NOT NULL,
  genre text NOT NULL,
  audio_url text,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.practice_track_audio ENABLE ROW LEVEL SECURITY;

-- Anyone can read (players need to fetch audio URLs)
CREATE POLICY "Anyone can read practice track audio"
  ON public.practice_track_audio FOR SELECT
  USING (true);

-- Storage bucket for practice track audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-tracks', 'practice-tracks', true);

-- Anyone can read from the bucket
CREATE POLICY "Public read access for practice tracks"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'practice-tracks');

-- Authenticated users can upload (admin check done in app)
CREATE POLICY "Authenticated upload practice tracks"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'practice-tracks');

CREATE POLICY "Authenticated update practice tracks"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'practice-tracks');

CREATE POLICY "Authenticated delete practice tracks"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'practice-tracks');