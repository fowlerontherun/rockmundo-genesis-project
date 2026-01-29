-- Create gear-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gear-images', 'gear-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for public access
CREATE POLICY "Gear images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'gear-images');

-- Allow authenticated users to upload gear images (for admin)
CREATE POLICY "Authenticated users can upload gear images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gear-images' AND auth.role() = 'authenticated');

-- Update gear items with category-based images
-- Using placeholder URLs that will be replaced once images are uploaded to storage

-- Electric guitars
UPDATE equipment_catalog 
SET image_url = '/gear/electric-guitar.jpg'
WHERE category = 'instrument' AND subcategory IN ('electric_guitar', 'guitar');

-- Acoustic guitars
UPDATE equipment_catalog 
SET image_url = '/gear/acoustic-guitar.jpg'
WHERE category = 'instrument' AND subcategory = 'acoustic_guitar';

-- Bass guitars
UPDATE equipment_catalog 
SET image_url = '/gear/bass-guitar.jpg'
WHERE category = 'instrument' AND subcategory = 'bass';

-- Drums
UPDATE equipment_catalog 
SET image_url = '/gear/drums.jpg'
WHERE category = 'instrument' AND subcategory IN ('drums', 'electronic_drums');

-- Cymbals
UPDATE equipment_catalog 
SET image_url = '/gear/cymbals.jpg'
WHERE category = 'instrument' AND subcategory = 'cymbals';

-- Keyboards
UPDATE equipment_catalog 
SET image_url = '/gear/keyboard.jpg'
WHERE category = 'instrument' AND subcategory IN ('keyboard', 'synthesizer');

-- Amplifiers
UPDATE equipment_catalog 
SET image_url = '/gear/amplifier.jpg'
WHERE category = 'amplifier';

-- Effects pedals
UPDATE equipment_catalog 
SET image_url = '/gear/effects.jpg'
WHERE category = 'effects' OR (category = 'stage' AND subcategory = 'effects');

-- Microphones
UPDATE equipment_catalog 
SET image_url = '/gear/microphone.jpg'
WHERE category = 'recording';

-- Stage equipment
UPDATE equipment_catalog 
SET image_url = '/gear/stage.jpg'
WHERE category = 'stage' AND subcategory NOT IN ('effects');