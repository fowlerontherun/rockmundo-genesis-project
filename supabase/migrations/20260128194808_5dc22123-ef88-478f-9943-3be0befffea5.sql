-- Character Sprite System - Complete RPM Replacement
-- Creates sprite asset library and updates player avatar config

-- 1. Create character_sprite_assets table for all sprite assets
CREATE TABLE IF NOT EXISTS public.character_sprite_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  name TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  layer_order INTEGER NOT NULL,
  anchor_x FLOAT DEFAULT 0.5,
  anchor_y FLOAT DEFAULT 0.5,
  supports_recolor BOOLEAN DEFAULT true,
  color_variants JSONB DEFAULT '[]'::jsonb,
  is_premium BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  collection_id UUID REFERENCES public.skin_collections(id),
  gender_filter TEXT[] DEFAULT ARRAY['any']::TEXT[],
  body_type_filter TEXT[] DEFAULT ARRAY['any']::TEXT[],
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sprite_assets_category ON public.character_sprite_assets(category);
CREATE INDEX IF NOT EXISTS idx_sprite_assets_gender ON public.character_sprite_assets USING GIN(gender_filter);
CREATE INDEX IF NOT EXISTS idx_sprite_assets_body_type ON public.character_sprite_assets USING GIN(body_type_filter);
CREATE INDEX IF NOT EXISTS idx_sprite_assets_default ON public.character_sprite_assets(is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE public.character_sprite_assets ENABLE ROW LEVEL SECURITY;

-- Everyone can view sprites (public catalog)
CREATE POLICY "Anyone can view sprite assets"
  ON public.character_sprite_assets FOR SELECT
  USING (true);

-- Only admins can insert/update/delete sprites (using user_roles table)
CREATE POLICY "Admins can manage sprite assets"
  ON public.character_sprite_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Add sprite selection columns to player_avatar_config
ALTER TABLE public.player_avatar_config
  ADD COLUMN IF NOT EXISTS body_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS eyes_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS nose_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS mouth_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS hair_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS jacket_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS shirt_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS trousers_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS shoes_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS hat_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS glasses_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS facial_hair_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS face_detail_sprite_id UUID REFERENCES public.character_sprite_assets(id),
  ADD COLUMN IF NOT EXISTS rendered_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS render_hash TEXT,
  ADD COLUMN IF NOT EXISTS selected_skin_tone TEXT DEFAULT 'medium';

-- 3. Create storage bucket for character sprites
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-sprites', 'character-sprites', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for character sprites bucket
CREATE POLICY "Character sprites are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'character-sprites');

CREATE POLICY "Admins can upload character sprites"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'character-sprites' 
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update character sprites"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'character-sprites'
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete character sprites"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'character-sprites'
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Seed default body types 
INSERT INTO public.character_sprite_assets (category, subcategory, name, asset_url, layer_order, gender_filter, body_type_filter, is_default)
VALUES 
  -- Male body types (layer 1)
  ('body', 'male_slim', 'Slim Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['slim'], true),
  ('body', 'male_athletic', 'Athletic Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['athletic'], true),
  ('body', 'male_average', 'Average Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['average'], true),
  ('body', 'male_muscular', 'Muscular Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['muscular'], true),
  ('body', 'male_stocky', 'Stocky Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['stocky'], true),
  ('body', 'male_heavyset', 'Heavyset Male', '/placeholder.svg', 1, ARRAY['male'], ARRAY['heavyset'], true),
  ('body', 'female_slim', 'Slim Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['slim'], true),
  ('body', 'female_athletic', 'Athletic Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['athletic'], true),
  ('body', 'female_average', 'Average Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['average'], true),
  ('body', 'female_curvy', 'Curvy Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['curvy'], true),
  ('body', 'female_petite', 'Petite Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['petite'], true),
  ('body', 'female_muscular', 'Muscular Female', '/placeholder.svg', 1, ARRAY['female'], ARRAY['muscular'], true),
  ('eyes', 'neutral', 'Neutral Eyes', '/placeholder.svg', 4, ARRAY['any'], ARRAY['any'], true),
  ('eyes', 'angry', 'Angry Eyes', '/placeholder.svg', 4, ARRAY['any'], ARRAY['any'], true),
  ('eyes', 'tired', 'Tired Eyes', '/placeholder.svg', 4, ARRAY['any'], ARRAY['any'], true),
  ('eyes', 'happy', 'Happy Eyes', '/placeholder.svg', 4, ARRAY['any'], ARRAY['any'], true),
  ('eyes', 'squinting', 'Squinting Eyes', '/placeholder.svg', 4, ARRAY['any'], ARRAY['any'], true),
  ('nose', 'default', 'Standard Nose', '/placeholder.svg', 5, ARRAY['any'], ARRAY['any'], true),
  ('nose', 'pointed', 'Pointed Nose', '/placeholder.svg', 5, ARRAY['any'], ARRAY['any'], true),
  ('nose', 'wide', 'Wide Nose', '/placeholder.svg', 5, ARRAY['any'], ARRAY['any'], true),
  ('nose', 'button', 'Button Nose', '/placeholder.svg', 5, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'neutral', 'Neutral Mouth', '/placeholder.svg', 6, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'smirk', 'Smirk', '/placeholder.svg', 6, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'grin', 'Grin', '/placeholder.svg', 6, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'frown', 'Frown', '/placeholder.svg', 6, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'cigarette', 'With Cigarette', '/placeholder.svg', 6, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'mohawk', 'Mohawk', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'liberty_spikes', 'Liberty Spikes', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'shaved_sides', 'Shaved Sides', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'messy_short', 'Messy Short', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'long_messy', 'Long Messy', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'ponytail', 'Ponytail', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'bald', 'Bald', '/placeholder.svg', 9, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'band_tee', 'Band T-Shirt', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'plain_tee', 'Plain T-Shirt', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'tank_top', 'Tank Top', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'torn_tee', 'Torn T-Shirt', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('jacket', 'leather', 'Leather Jacket', '/placeholder.svg', 3, ARRAY['any'], ARRAY['any'], true),
  ('jacket', 'denim', 'Denim Jacket', '/placeholder.svg', 3, ARRAY['any'], ARRAY['any'], true),
  ('jacket', 'biker', 'Biker Jacket', '/placeholder.svg', 3, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'jeans', 'Jeans', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'ripped_jeans', 'Ripped Jeans', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'skinny_jeans', 'Skinny Jeans', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'plaid', 'Plaid Trousers', '/placeholder.svg', 2, ARRAY['any'], ARRAY['any'], true),
  ('shoes', 'boots', 'Combat Boots', '/placeholder.svg', 1, ARRAY['any'], ARRAY['any'], true),
  ('shoes', 'converse', 'High Tops', '/placeholder.svg', 1, ARRAY['any'], ARRAY['any'], true),
  ('shoes', 'docs', 'Doc Martens', '/placeholder.svg', 1, ARRAY['any'], ARRAY['any'], true),
  ('hat', 'beanie', 'Beanie', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('hat', 'cap', 'Cap', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('hat', 'bucket', 'Bucket Hat', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('glasses', 'aviator', 'Aviator Sunglasses', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('glasses', 'round', 'Round Glasses', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('glasses', 'square', 'Square Frames', '/placeholder.svg', 10, ARRAY['any'], ARRAY['any'], true),
  ('facial_hair', 'stubble', 'Stubble', '/placeholder.svg', 7, ARRAY['male'], ARRAY['any'], true),
  ('facial_hair', 'goatee', 'Goatee', '/placeholder.svg', 7, ARRAY['male'], ARRAY['any'], true),
  ('facial_hair', 'full_beard', 'Full Beard', '/placeholder.svg', 7, ARRAY['male'], ARRAY['any'], true),
  ('facial_hair', 'mutton_chops', 'Mutton Chops', '/placeholder.svg', 7, ARRAY['male'], ARRAY['any'], true);