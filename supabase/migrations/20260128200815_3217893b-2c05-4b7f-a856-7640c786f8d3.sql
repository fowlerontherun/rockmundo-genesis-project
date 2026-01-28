-- Insert new sprite assets for the character creator
INSERT INTO character_sprite_assets (category, subcategory, name, asset_url, layer_order, gender_filter, body_type_filter, is_default)
VALUES
  -- New body types
  ('body', 'male_athletic', 'Athletic Male', '/src/assets/sprites/body-male-athletic.png', 1, ARRAY['male'], ARRAY['any'], true),
  ('body', 'female_curvy', 'Curvy Female', '/src/assets/sprites/body-female-curvy.png', 1, ARRAY['female'], ARRAY['any'], true),
  
  -- New hair styles
  ('hair', 'braids', 'Braids', '/src/assets/sprites/hair-braids-black.png', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'long_wavy', 'Long Wavy Blonde', '/src/assets/sprites/hair-long-wavy-blonde.png', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'buzzcut', 'Buzzcut Brown', '/src/assets/sprites/hair-buzzcut-brown.png', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'afro', 'Afro', '/src/assets/sprites/hair-afro-black.png', 9, ARRAY['any'], ARRAY['any'], true),
  ('hair', 'emo', 'Emo Purple', '/src/assets/sprites/hair-emo-black-purple.png', 9, ARRAY['any'], ARRAY['any'], true),
  
  -- New eyes
  ('eyes', 'cool', 'Cool Eyes', '/src/assets/sprites/eyes-cool.png', 4, ARRAY['any'], ARRAY['any'], true),
  ('eyes', 'happy', 'Happy Eyes', '/src/assets/sprites/eyes-happy.png', 4, ARRAY['any'], ARRAY['any'], true),
  
  -- New noses
  ('nose', 'small', 'Small Nose', '/src/assets/sprites/nose-small.png', 5, ARRAY['any'], ARRAY['any'], true),
  ('nose', 'large', 'Large Nose', '/src/assets/sprites/nose-large.png', 5, ARRAY['any'], ARRAY['any'], true),
  
  -- New mouths
  ('mouth', 'smirk', 'Smirk', '/src/assets/sprites/mouth-smirk.png', 6, ARRAY['any'], ARRAY['any'], true),
  ('mouth', 'singing', 'Singing', '/src/assets/sprites/mouth-singing.png', 6, ARRAY['any'], ARRAY['any'], true),
  
  -- New jackets
  ('jacket', 'hoodie', 'Grey Hoodie', '/src/assets/sprites/jacket-hoodie-grey.png', 3, ARRAY['any'], ARRAY['any'], true),
  ('jacket', 'denim', 'Denim Jacket', '/src/assets/sprites/jacket-denim-blue.png', 3, ARRAY['any'], ARRAY['any'], true),
  ('jacket', 'varsity', 'Varsity Red', '/src/assets/sprites/jacket-varsity-red.png', 3, ARRAY['any'], ARRAY['any'], true),
  
  -- New shirts
  ('shirt', 'graphic', 'Graphic Tee White', '/src/assets/sprites/shirt-graphic-white.png', 2, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'flannel', 'Flannel Red', '/src/assets/sprites/shirt-flannel-red.png', 2, ARRAY['any'], ARRAY['any'], true),
  ('shirt', 'tank', 'Tank Top Black', '/src/assets/sprites/shirt-tank-black.png', 2, ARRAY['any'], ARRAY['any'], true),
  
  -- New trousers
  ('trousers', 'baggy_jeans', 'Baggy Jeans', '/src/assets/sprites/trousers-baggy-jeans.png', 2, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'skinny', 'Skinny Black', '/src/assets/sprites/trousers-skinny-black.png', 2, ARRAY['any'], ARRAY['any'], true),
  ('trousers', 'cargo', 'Cargo Green', '/src/assets/sprites/trousers-cargo-green.png', 2, ARRAY['any'], ARRAY['any'], true),
  
  -- New shoes
  ('shoes', 'sneakers', 'White Sneakers', '/src/assets/sprites/shoes-sneakers-white.png', 1, ARRAY['any'], ARRAY['any'], true),
  ('shoes', 'hightops', 'Red High-tops', '/src/assets/sprites/shoes-hightops-red.png', 1, ARRAY['any'], ARRAY['any'], true),
  ('shoes', 'chelsea', 'Brown Chelsea Boots', '/src/assets/sprites/shoes-chelsea-brown.png', 1, ARRAY['any'], ARRAY['any'], true),
  
  -- New hats
  ('hat', 'flatcap', 'Grey Flatcap', '/src/assets/sprites/hat-flatcap-grey.png', 10, ARRAY['any'], ARRAY['any'], true),
  ('hat', 'snapback', 'Black Snapback', '/src/assets/sprites/hat-snapback-black.png', 10, ARRAY['any'], ARRAY['any'], true),
  ('hat', 'beanie', 'Red Beanie', '/src/assets/sprites/hat-beanie-red.png', 10, ARRAY['any'], ARRAY['any'], true),
  
  -- New glasses
  ('glasses', 'aviator', 'Gold Aviators', '/src/assets/sprites/glasses-aviator-gold.png', 10, ARRAY['any'], ARRAY['any'], true),
  ('glasses', 'round', 'Round Black', '/src/assets/sprites/glasses-round-black.png', 10, ARRAY['any'], ARRAY['any'], true),
  
  -- New facial hair
  ('facial_hair', 'beard', 'Brown Beard', '/src/assets/sprites/facial-hair-beard-brown.png', 7, ARRAY['male'], ARRAY['any'], true),
  ('facial_hair', 'goatee', 'Black Goatee', '/src/assets/sprites/facial-hair-goatee-black.png', 7, ARRAY['male'], ARRAY['any'], true),
  ('facial_hair', 'handlebar', 'Handlebar Mustache', '/src/assets/sprites/facial-hair-handlebar.png', 7, ARRAY['male'], ARRAY['any'], true);