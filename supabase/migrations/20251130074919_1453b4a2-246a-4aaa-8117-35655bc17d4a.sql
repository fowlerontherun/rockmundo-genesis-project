-- Create player_avatar_config table
CREATE TABLE player_avatar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  skin_tone VARCHAR(7) DEFAULT '#d4a373',
  body_type VARCHAR(20) DEFAULT 'average',
  height INTEGER DEFAULT 170,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create avatar_hair_styles table
CREATE TABLE avatar_hair_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  style_key VARCHAR(30) NOT NULL UNIQUE,
  is_premium BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  rarity VARCHAR(20) DEFAULT 'common',
  description TEXT,
  preview_color VARCHAR(7) DEFAULT '#2c1810',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create avatar_clothing_items table
CREATE TABLE avatar_clothing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  rarity VARCHAR(20) DEFAULT 'common',
  description TEXT,
  color_variants JSONB DEFAULT '["#000000", "#FFFFFF", "#FF0000", "#0000FF"]'::jsonb,
  shape_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create avatar_face_options table
CREATE TABLE avatar_face_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  feature_type VARCHAR(30) NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  shape_config JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player_owned_skins table
CREATE TABLE player_owned_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  item_id UUID NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT false,
  UNIQUE(profile_id, item_type, item_id)
);

-- Create equipment_3d_models table
CREATE TABLE equipment_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment_catalog(id) ON DELETE CASCADE UNIQUE,
  model_type VARCHAR(30) NOT NULL,
  color_primary VARCHAR(7) DEFAULT '#000000',
  color_secondary VARCHAR(7) DEFAULT '#FFFFFF',
  color_accent VARCHAR(7) DEFAULT '#FFD700',
  shape_config JSONB DEFAULT '{}'::jsonb,
  rarity_effect VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE player_avatar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_hair_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_face_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_owned_skins ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_3d_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_avatar_config
CREATE POLICY "Players can view their own avatar config"
  ON player_avatar_config FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update their own avatar config"
  ON player_avatar_config FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert their own avatar config"
  ON player_avatar_config FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for avatar catalogs (viewable by all)
CREATE POLICY "Hair styles are viewable by everyone"
  ON avatar_hair_styles FOR SELECT
  USING (true);

CREATE POLICY "Clothing items are viewable by everyone"
  ON avatar_clothing_items FOR SELECT
  USING (true);

CREATE POLICY "Face options are viewable by everyone"
  ON avatar_face_options FOR SELECT
  USING (true);

-- RLS Policies for player_owned_skins
CREATE POLICY "Players can view their own skins"
  ON player_owned_skins FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert their own skins"
  ON player_owned_skins FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update their own skins"
  ON player_owned_skins FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for equipment_3d_models
CREATE POLICY "Equipment 3D models are viewable by everyone"
  ON equipment_3d_models FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage equipment 3D models"
  ON equipment_3d_models FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Seed hair styles
INSERT INTO avatar_hair_styles (name, style_key, is_premium, price, rarity, description, preview_color) VALUES
('Short Spiky', 'short-spiky', false, 0, 'common', 'Classic short spiky hair', '#2c1810'),
('Long Straight', 'long-straight', false, 0, 'common', 'Long flowing straight hair', '#2c1810'),
('Mohawk', 'mohawk', false, 0, 'common', 'Bold mohawk style', '#2c1810'),
('Bald', 'bald', false, 0, 'common', 'Clean shaved head', '#d4a373'),
('Ponytail', 'ponytail', false, 0, 'common', 'Classic ponytail', '#2c1810'),
('Curly', 'curly', false, 0, 'common', 'Natural curly hair', '#2c1810'),
('Rocker', 'rocker', false, 0, 'common', 'Long rocker hair', '#2c1810'),
('Messy', 'messy', false, 0, 'common', 'Casual messy style', '#2c1810'),
('Undercut', 'undercut', true, 500, 'rare', 'Trendy undercut style', '#2c1810'),
('Dreadlocks', 'dreadlocks', true, 750, 'rare', 'Cool dreadlocks', '#2c1810'),
('Afro', 'afro', true, 500, 'rare', 'Classic afro', '#2c1810'),
('Buzz Cut', 'buzz-cut', false, 0, 'common', 'Military-style buzz cut', '#2c1810'),
('Man Bun', 'man-bun', true, 600, 'rare', 'Stylish man bun', '#2c1810'),
('Side Part', 'side-part', false, 0, 'common', 'Professional side part', '#2c1810'),
('Slicked Back', 'slicked-back', true, 550, 'rare', 'Slicked back style', '#2c1810'),
('Bowl Cut', 'bowl-cut', false, 0, 'common', 'Retro bowl cut', '#2c1810'),
('Pixie Cut', 'pixie-cut', true, 500, 'rare', 'Short pixie cut', '#2c1810'),
('Bob Cut', 'bob-cut', true, 500, 'rare', 'Classic bob', '#2c1810'),
('Braids', 'braids', true, 800, 'epic', 'Intricate braids', '#2c1810'),
('Neon Mohawk', 'neon-mohawk', true, 1500, 'legendary', 'Glowing neon mohawk', '#00ff00');

-- Seed clothing items
INSERT INTO avatar_clothing_items (name, category, is_premium, price, rarity, description, color_variants) VALUES
('Basic T-Shirt', 'shirt', false, 0, 'common', 'Simple cotton t-shirt', '["#000000", "#FFFFFF", "#FF0000", "#0000FF", "#00FF00"]'::jsonb),
('Tank Top', 'shirt', false, 0, 'common', 'Sleeveless tank top', '["#000000", "#808080", "#FF4500"]'::jsonb),
('Band Tour Shirt', 'shirt', true, 300, 'rare', 'Vintage band tour shirt', '["#000000", "#8B0000", "#191970"]'::jsonb),
('Leather Jacket', 'jacket', true, 1000, 'epic', 'Classic leather jacket', '["#000000", "#8B4513"]'::jsonb),
('Hoodie', 'jacket', false, 250, 'common', 'Comfortable hoodie', '["#000000", "#808080", "#000080", "#8B0000"]'::jsonb),
('Denim Jacket', 'jacket', true, 600, 'rare', 'Stylish denim jacket', '["#4169E1", "#000080"]'::jsonb),
('Jeans', 'pants', false, 0, 'common', 'Classic blue jeans', '["#4169E1", "#000080", "#000000"]'::jsonb),
('Cargo Pants', 'pants', false, 150, 'common', 'Practical cargo pants', '["#556B2F", "#000000", "#8B4513"]'::jsonb),
('Leather Pants', 'pants', true, 800, 'epic', 'Rock star leather pants', '["#000000"]'::jsonb),
('Shorts', 'pants', false, 0, 'common', 'Casual shorts', '["#4169E1", "#000000", "#808080"]'::jsonb),
('Ripped Jeans', 'pants', true, 400, 'rare', 'Distressed ripped jeans', '["#4169E1", "#000000"]'::jsonb),
('Bandana', 'accessory', false, 100, 'common', 'Cool bandana', '["#FF0000", "#000000", "#0000FF"]'::jsonb),
('Sunglasses', 'accessory', true, 350, 'rare', 'Stylish sunglasses', '["#000000", "#FFD700"]'::jsonb),
('Spiked Wristband', 'accessory', true, 250, 'rare', 'Punk rock wristband', '["#000000", "#C0C0C0"]'::jsonb),
('Chain Necklace', 'accessory', true, 500, 'epic', 'Heavy chain necklace', '["#C0C0C0", "#FFD700"]'::jsonb),
('Beanie', 'accessory', false, 150, 'common', 'Warm beanie', '["#000000", "#FF0000", "#0000FF"]'::jsonb),
('Vest', 'jacket', true, 450, 'rare', 'Sleeveless vest', '["#000000", "#8B4513", "#696969"]'::jsonb),
('Crop Top', 'shirt', true, 300, 'rare', 'Trendy crop top', '["#000000", "#FF1493", "#FFFFFF"]'::jsonb),
('Flannel Shirt', 'shirt', true, 400, 'rare', 'Grunge flannel', '["#8B0000", "#000080", "#006400"]'::jsonb),
('Stage Outfit', 'shirt', true, 2000, 'legendary', 'Premium stage performance outfit', '["#FFD700", "#FF0000", "#0000FF"]'::jsonb);

-- Seed face options
INSERT INTO avatar_face_options (name, feature_type, is_premium, price, description, shape_config) VALUES
('Standard Eyes', 'eyes', false, 0, 'Basic eye style', '{"size": 0.015, "spacing": 0.08}'::jsonb),
('Large Eyes', 'eyes', true, 200, 'Larger expressive eyes', '{"size": 0.020, "spacing": 0.08}'::jsonb),
('Narrow Eyes', 'eyes', true, 200, 'Focused narrow eyes', '{"size": 0.012, "spacing": 0.07}'::jsonb),
('Standard Nose', 'nose', false, 0, 'Average nose', '{"width": 0.015, "length": 0.03}'::jsonb),
('Button Nose', 'nose', true, 150, 'Small button nose', '{"width": 0.012, "length": 0.025}'::jsonb),
('Prominent Nose', 'nose', true, 150, 'Larger nose', '{"width": 0.018, "length": 0.035}'::jsonb),
('Standard Mouth', 'mouth', false, 0, 'Normal mouth', '{"width": 0.05, "height": 0.008}'::jsonb),
('Wide Smile', 'mouth', true, 200, 'Broad friendly smile', '{"width": 0.065, "height": 0.01}'::jsonb),
('Small Mouth', 'mouth', true, 200, 'Petite mouth', '{"width": 0.04, "height": 0.006}'::jsonb),
('Goatee', 'beard', true, 300, 'Classic goatee', '{"style": "goatee"}'::jsonb),
('Full Beard', 'beard', true, 400, 'Full thick beard', '{"style": "full", "length": "long"}'::jsonb),
('Stubble', 'beard', true, 250, 'Short stubble', '{"style": "stubble"}'::jsonb),
('Mustache', 'beard', true, 300, 'Just a mustache', '{"style": "mustache"}'::jsonb),
('Soul Patch', 'beard', true, 200, 'Small soul patch', '{"style": "soul-patch"}'::jsonb),
('Van Dyke', 'beard', true, 350, 'Van Dyke beard style', '{"style": "van-dyke"}'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_player_avatar_config_updated_at
  BEFORE UPDATE ON player_avatar_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_3d_models_updated_at
  BEFORE UPDATE ON equipment_3d_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();