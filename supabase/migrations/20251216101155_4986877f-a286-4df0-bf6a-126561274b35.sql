-- Add missing columns to player_avatar_config table
ALTER TABLE public.player_avatar_config 
ADD COLUMN IF NOT EXISTS hair_style_key VARCHAR(50) DEFAULT 'messy',
ADD COLUMN IF NOT EXISTS hair_color VARCHAR(20) DEFAULT '#2d1a0a',
ADD COLUMN IF NOT EXISTS eye_style VARCHAR(30) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS nose_style VARCHAR(30) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS mouth_style VARCHAR(30) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS beard_style VARCHAR(30) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shirt_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shirt_color VARCHAR(20) DEFAULT '#2d0a0a',
ADD COLUMN IF NOT EXISTS pants_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pants_color VARCHAR(20) DEFAULT '#1a1a1a',
ADD COLUMN IF NOT EXISTS jacket_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS jacket_color VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shoes_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shoes_color VARCHAR(20) DEFAULT '#1a1a1a',
ADD COLUMN IF NOT EXISTS accessory_1_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accessory_2_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gender VARCHAR(30) DEFAULT 'male',
ADD COLUMN IF NOT EXISTS tattoo_style VARCHAR(30) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scar_style VARCHAR(30) DEFAULT NULL;

-- Add shoes to avatar_clothing_items
INSERT INTO public.avatar_clothing_items (name, category, price, is_premium, rarity, description, color_variants) VALUES
('Classic Sneakers', 'shoes', 0, false, 'common', 'Everyday sneakers', '["#ffffff", "#000000", "#1a1a1a", "#d4d4d4"]'),
('Leather Boots', 'shoes', 0, false, 'common', 'Classic leather boots', '["#3d2816", "#1a1a1a", "#5a4030"]'),
('High-Top Sneakers', 'shoes', 200, false, 'uncommon', 'Stylish high-tops', '["#ff0000", "#0000ff", "#ffffff", "#1a1a1a"]'),
('Platform Boots', 'shoes', 500, true, 'rare', 'Rock star platform boots', '["#1a1a1a", "#800020", "#ffffff"]'),
('Designer Kicks', 'shoes', 800, true, 'epic', 'Limited edition designer sneakers', '["#ffd700", "#c0c0c0", "#1a1a1a"]')
ON CONFLICT DO NOTHING;

-- Add more shirts if needed
INSERT INTO public.avatar_clothing_items (name, category, price, is_premium, rarity, description, color_variants) VALUES
('Band Tee', 'shirt', 0, false, 'common', 'Classic band t-shirt', '["#1a1a1a", "#2d0a0a", "#0a2d0a"]'),
('V-Neck', 'shirt', 0, false, 'common', 'Simple v-neck shirt', '["#ffffff", "#1a1a1a", "#2d2d2d"]'),
('Tank Top', 'shirt', 100, false, 'uncommon', 'Sleeveless tank top', '["#1a1a1a", "#ffffff", "#ff0000"]'),
('Polo Shirt', 'shirt', 150, false, 'uncommon', 'Smart casual polo', '["#000080", "#006400", "#800020"]'),
('Graphic Tee', 'shirt', 200, true, 'rare', 'Artistic graphic tee', '["#1a1a1a", "#2d2d2d"]')
ON CONFLICT DO NOTHING;

-- Add more pants if needed
INSERT INTO public.avatar_clothing_items (name, category, price, is_premium, rarity, description, color_variants) VALUES
('Jeans', 'pants', 0, false, 'common', 'Classic denim jeans', '["#1a3a5c", "#1a1a1a", "#4a4a4a"]'),
('Chinos', 'pants', 0, false, 'common', 'Smart casual chinos', '["#8b7355", "#2f4f4f", "#1a1a1a"]'),
('Cargo Pants', 'pants', 150, false, 'uncommon', 'Utility cargo pants', '["#4a5d23", "#1a1a1a", "#5a4030"]'),
('Leather Pants', 'pants', 400, true, 'rare', 'Rock star leather pants', '["#1a1a1a", "#2d1a0a"]'),
('Skinny Jeans', 'pants', 100, false, 'uncommon', 'Tight-fit skinny jeans', '["#1a1a1a", "#1a3a5c", "#4a4a4a"]')
ON CONFLICT DO NOTHING;

-- Add jackets
INSERT INTO public.avatar_clothing_items (name, category, price, is_premium, rarity, description, color_variants) VALUES
('Denim Jacket', 'jacket', 0, false, 'common', 'Classic denim jacket', '["#1a3a5c", "#1a1a1a"]'),
('Leather Jacket', 'jacket', 300, true, 'rare', 'Classic leather biker jacket', '["#1a1a1a", "#2d1a0a"]'),
('Hoodie', 'jacket', 100, false, 'uncommon', 'Casual zip-up hoodie', '["#1a1a1a", "#2d2d2d", "#800020"]'),
('Bomber Jacket', 'jacket', 250, false, 'rare', 'Military style bomber', '["#4a5d23", "#1a1a1a", "#2d1a0a"]')
ON CONFLICT DO NOTHING;

-- Add tattoo options to avatar_face_options
INSERT INTO public.avatar_face_options (feature_type, name, price, is_premium, description) VALUES
('tattoo', 'No Tattoo', 0, false, 'Clean skin'),
('tattoo', 'Sleeve Tattoo', 200, false, 'Full arm sleeve'),
('tattoo', 'Neck Tattoo', 300, true, 'Neck and throat ink'),
('tattoo', 'Face Tattoo', 500, true, 'Bold face tattoo'),
('tattoo', 'Back Piece', 400, true, 'Full back artwork')
ON CONFLICT DO NOTHING;

-- Add scar options to avatar_face_options
INSERT INTO public.avatar_face_options (feature_type, name, price, is_premium, description) VALUES
('scar', 'No Scar', 0, false, 'No visible scars'),
('scar', 'Cheek Scar', 100, false, 'Small cheek scar'),
('scar', 'Eye Scar', 150, false, 'Scar across eye'),
('scar', 'Lip Scar', 100, false, 'Scar on lip'),
('scar', 'Forehead Scar', 150, false, 'Scar on forehead')
ON CONFLICT DO NOTHING;