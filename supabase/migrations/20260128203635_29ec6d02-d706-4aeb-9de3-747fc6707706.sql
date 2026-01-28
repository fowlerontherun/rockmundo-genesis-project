-- First clear all player avatar configurations to remove FK references
UPDATE player_avatar_config SET
  body_sprite_id = NULL,
  eyes_sprite_id = NULL,
  nose_sprite_id = NULL,
  mouth_sprite_id = NULL,
  hair_sprite_id = NULL,
  jacket_sprite_id = NULL,
  shirt_sprite_id = NULL,
  trousers_sprite_id = NULL,
  shoes_sprite_id = NULL,
  hat_sprite_id = NULL,
  glasses_sprite_id = NULL,
  facial_hair_sprite_id = NULL;

-- Now delete all existing character sprite assets to start fresh with aligned system
DELETE FROM character_sprite_assets;

-- Insert aligned body templates
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('body', 'aligned_male', 'Male Base', '/src/assets/sprites/aligned-base-male.png', 0, 0.5, 0.5, false, '{}', false, 0, '{male}', '{slim}', true),
('body', 'aligned_female', 'Female Base', '/src/assets/sprites/aligned-base-female.png', 0, 0.5, 0.5, false, '{}', false, 0, '{female}', '{slim}', true);

-- Insert aligned hair options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('hair', 'aligned', 'Red Mohawk', '/src/assets/sprites/aligned-hair-mohawk.png', 9, 0.5, 0.1, false, '{}', false, 0, '{any}', '{any}', true),
('hair', 'aligned', 'Black Afro', '/src/assets/sprites/aligned-hair-afro.png', 9, 0.5, 0.1, false, '{}', false, 0, '{any}', '{any}', false),
('hair', 'aligned', 'Emo Black', '/src/assets/sprites/aligned-hair-emo.png', 9, 0.5, 0.1, false, '{}', false, 0, '{any}', '{any}', false),
('hair', 'aligned', 'Blonde Pixie', '/src/assets/sprites/aligned-hair-pixie.png', 9, 0.5, 0.1, false, '{}', false, 0, '{any}', '{any}', false);

-- Insert aligned eyes options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('eyes', 'aligned', 'Neutral Eyes', '/src/assets/sprites/aligned-eyes-neutral.png', 5, 0.5, 0.2, false, '{}', false, 0, '{any}', '{any}', true),
('eyes', 'aligned', 'Angry Eyes', '/src/assets/sprites/aligned-eyes-angry.png', 5, 0.5, 0.2, false, '{}', false, 0, '{any}', '{any}', false);

-- Insert aligned nose options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('nose', 'aligned', 'Small Nose', '/src/assets/sprites/aligned-nose-small.png', 6, 0.5, 0.25, false, '{}', false, 0, '{any}', '{any}', true);

-- Insert aligned mouth options  
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('mouth', 'aligned', 'Neutral Mouth', '/src/assets/sprites/aligned-mouth-neutral.png', 7, 0.5, 0.3, false, '{}', false, 0, '{any}', '{any}', true),
('mouth', 'aligned', 'Smile', '/src/assets/sprites/aligned-mouth-smile.png', 7, 0.5, 0.3, false, '{}', false, 0, '{any}', '{any}', false);

-- Insert aligned jacket options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('jacket', 'aligned', 'Leather Jacket', '/src/assets/sprites/aligned-jacket-leather.png', 4, 0.5, 0.4, false, '{}', false, 0, '{any}', '{any}', true),
('jacket', 'aligned', 'Grey Hoodie', '/src/assets/sprites/aligned-jacket-hoodie.png', 4, 0.5, 0.4, false, '{}', false, 0, '{any}', '{any}', false),
('jacket', 'aligned', 'Red Flannel', '/src/assets/sprites/aligned-jacket-flannel.png', 4, 0.5, 0.4, false, '{}', false, 0, '{any}', '{any}', false);

-- Insert aligned shirt options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('shirt', 'aligned', 'Band Tee', '/src/assets/sprites/aligned-shirt-bandtee.png', 3, 0.5, 0.4, false, '{}', false, 0, '{any}', '{any}', true);

-- Insert aligned trousers options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('trousers', 'aligned', 'Skinny Jeans', '/src/assets/sprites/aligned-trousers-skinny.png', 2, 0.5, 0.6, false, '{}', false, 0, '{any}', '{any}', true),
('trousers', 'aligned', 'Cargo Pants', '/src/assets/sprites/aligned-trousers-cargo.png', 2, 0.5, 0.6, false, '{}', false, 0, '{any}', '{any}', false),
('trousers', 'aligned', 'Plaid Skirt', '/src/assets/sprites/aligned-trousers-plaidskirt.png', 2, 0.5, 0.6, false, '{}', false, 0, '{female}', '{any}', false);

-- Insert aligned shoes options
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('shoes', 'aligned', 'Combat Boots', '/src/assets/sprites/aligned-shoes-combat.png', 1, 0.5, 0.9, false, '{}', false, 0, '{any}', '{any}', true),
('shoes', 'aligned', 'Red High-tops', '/src/assets/sprites/aligned-shoes-hightops.png', 1, 0.5, 0.9, false, '{}', false, 0, '{any}', '{any}', false);

-- Insert aligned accessories
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, anchor_x, anchor_y, supports_recolor, color_variants, is_premium, price, gender_filter, body_type_filter, is_default) VALUES
('hat', 'aligned', 'Black Beanie', '/src/assets/sprites/aligned-hat-beanie.png', 10, 0.5, 0.05, false, '{}', false, 0, '{any}', '{any}', false),
('glasses', 'aligned', 'Aviator Sunglasses', '/src/assets/sprites/aligned-glasses-aviator.png', 11, 0.5, 0.2, false, '{}', false, 0, '{any}', '{any}', false),
('facial_hair', 'aligned', 'Full Beard', '/src/assets/sprites/aligned-facialhair-beard.png', 8, 0.5, 0.3, false, '{}', false, 0, '{male}', '{any}', false);