-- Add new layered sprite assets (keeping old ones for backwards compatibility)
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, gender_filter, body_type_filter, is_default)
VALUES
  -- Base bodies
  ('body', 'male_slim_base', 'Male Slim Base', '/src/assets/sprites/base-male-slim.png', 1, ARRAY['male'], ARRAY['any'], true),
  ('body', 'female_slim_base', 'Female Slim Base', '/src/assets/sprites/base-female-slim.png', 1, ARRAY['female'], ARRAY['any'], true),
  
  -- Layered hair
  ('hair', 'mohawk_red_layer', 'Red Mohawk', '/src/assets/sprites/layer-hair-mohawk-red-male.png', 9, ARRAY['male'], ARRAY['any'], true),
  ('hair', 'messy_black_layer', 'Messy Black', '/src/assets/sprites/layer-hair-messy-black-male.png', 9, ARRAY['male'], ARRAY['any'], true),
  ('hair', 'afro_male_layer', 'Afro', '/src/assets/sprites/layer-hair-afro-male.png', 9, ARRAY['male'], ARRAY['any'], true),
  ('hair', 'wavy_blonde_layer', 'Wavy Blonde', '/src/assets/sprites/layer-hair-wavy-blonde-female.png', 9, ARRAY['female'], ARRAY['any'], true),
  ('hair', 'pixie_pink_layer', 'Pixie Pink', '/src/assets/sprites/layer-hair-pixie-pink-female.png', 9, ARRAY['female'], ARRAY['any'], true),
  ('hair', 'afro_female_layer', 'Afro', '/src/assets/sprites/layer-hair-afro-female.png', 9, ARRAY['female'], ARRAY['any'], true),
  
  -- Layered clothing
  ('jacket', 'hoodie_grey_layer', 'Grey Hoodie', '/src/assets/sprites/layer-hoodie-grey-male.png', 3, ARRAY['male'], ARRAY['any'], true),
  ('jacket', 'flannel_red_layer', 'Red Flannel', '/src/assets/sprites/layer-flannel-red-male.png', 3, ARRAY['male'], ARRAY['any'], true),
  ('jacket', 'hoodie_black_layer', 'Black Hoodie', '/src/assets/sprites/layer-hoodie-black-female.png', 3, ARRAY['female'], ARRAY['any'], true),
  ('jacket', 'varsity_red_layer', 'Varsity Red', '/src/assets/sprites/layer-jacket-varsity-female.png', 3, ARRAY['female'], ARRAY['any'], true),
  ('shirt', 'black_tee_layer', 'Black T-Shirt', '/src/assets/sprites/layer-shirt-black-male.png', 2, ARRAY['male'], ARRAY['any'], true),
  ('shirt', 'tank_purple_layer', 'Purple Tank', '/src/assets/sprites/layer-tank-purple-female.png', 2, ARRAY['female'], ARRAY['any'], true),
  ('trousers', 'skinny_boots_layer', 'Skinny & Boots', '/src/assets/sprites/layer-pants-skinny-boots-male.png', 2, ARRAY['male'], ARRAY['any'], true),
  ('trousers', 'baggy_jeans_layer', 'Baggy Jeans', '/src/assets/sprites/layer-pants-baggy-male.png', 2, ARRAY['male'], ARRAY['any'], true),
  ('trousers', 'cargo_layer', 'Cargo Pants', '/src/assets/sprites/layer-pants-cargo-male.png', 2, ARRAY['male'], ARRAY['any'], true),
  ('trousers', 'jeans_sneakers_layer', 'Jeans & Sneakers', '/src/assets/sprites/layer-pants-jeans-sneakers-female.png', 2, ARRAY['female'], ARRAY['any'], true),
  ('trousers', 'skinny_female_layer', 'Skinny Black', '/src/assets/sprites/layer-pants-skinny-female.png', 2, ARRAY['female'], ARRAY['any'], true),
  ('trousers', 'plaid_skirt_layer', 'Plaid Skirt', '/src/assets/sprites/layer-skirt-plaid-female.png', 2, ARRAY['female'], ARRAY['any'], true);