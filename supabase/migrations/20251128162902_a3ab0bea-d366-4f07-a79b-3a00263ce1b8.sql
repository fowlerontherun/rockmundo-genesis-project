-- Add texture support to stage_templates
ALTER TABLE stage_templates 
ADD COLUMN IF NOT EXISTS floor_texture_url TEXT,
ADD COLUMN IF NOT EXISTS backdrop_texture_url TEXT,
ADD COLUMN IF NOT EXISTS crowd_sprite_set TEXT DEFAULT 'default';

-- Update existing stage templates with default texture paths
UPDATE stage_templates SET 
  floor_texture_url = 'floors/stage-floor-wood.png',
  backdrop_texture_url = 'backdrops/backdrop-curtain-black.png',
  crowd_sprite_set = 'default'
WHERE floor_texture_url IS NULL;

-- Create storage bucket for stage textures (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stage-textures', 'stage-textures', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for stage-textures bucket (public read, authenticated write)
CREATE POLICY "Public read access for stage textures"
ON storage.objects FOR SELECT
USING (bucket_id = 'stage-textures');

CREATE POLICY "Authenticated users can upload stage textures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stage-textures' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update stage textures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'stage-textures' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete stage textures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'stage-textures' 
  AND auth.role() = 'authenticated'
);