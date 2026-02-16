
-- Expand pov_clip_templates table for video-based clips
ALTER TABLE public.pov_clip_templates 
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS instrument_family text,
  ADD COLUMN IF NOT EXISTS instrument_track text,
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS venue_size text DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generation_prompt text,
  ADD COLUMN IF NOT EXISTS generation_error text;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pov_clips_instrument_family ON public.pov_clip_templates(instrument_family);
CREATE INDEX IF NOT EXISTS idx_pov_clips_generation_status ON public.pov_clip_templates(generation_status);
CREATE INDEX IF NOT EXISTS idx_pov_clips_instrument_track ON public.pov_clip_templates(instrument_track);

-- Create storage bucket for POV clips
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pov-clips', 'pov-clips', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to pov-clips bucket
CREATE POLICY "POV clips are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'pov-clips');

-- Allow authenticated uploads to pov-clips bucket (admin use)
CREATE POLICY "Authenticated users can upload POV clips"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pov-clips' AND auth.role() = 'authenticated');

-- Allow authenticated updates to pov-clips bucket
CREATE POLICY "Authenticated users can update POV clips"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pov-clips' AND auth.role() = 'authenticated');
