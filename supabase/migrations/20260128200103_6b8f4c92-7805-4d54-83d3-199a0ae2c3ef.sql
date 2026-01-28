-- Update placeholder assets with real generated sprite URLs
-- Body sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/body-male-slim.png'
WHERE category = 'body' AND subcategory = 'male_slim';

UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/body-female-slim.png'
WHERE category = 'body' AND subcategory = 'female_slim';

-- Hair sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/hair-mohawk-red.png', name = 'Red Mohawk'
WHERE category = 'hair' AND name = 'Mohawk';

UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/hair-messy-black.png', name = 'Messy Black'
WHERE category = 'hair' AND name = 'Liberty Spikes';

-- Eyes sprites  
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/eyes-angry.png', name = 'Angry'
WHERE category = 'eyes' AND name = 'Neutral';

UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/eyes-neutral.png', name = 'Neutral'
WHERE category = 'eyes' AND name = 'Angry';

-- Nose sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/nose-medium.png', name = 'Medium'
WHERE category = 'nose' AND name = 'Medium';

-- Mouth sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/mouth-sneer.png', name = 'Sneer'
WHERE category = 'mouth' AND name = 'Neutral';

UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/mouth-neutral.png', name = 'Neutral'  
WHERE category = 'mouth' AND name = 'Sneer';

-- Jacket sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/jacket-leather-black.png', name = 'Black Leather'
WHERE category = 'jacket' AND name = 'Leather Jacket';

-- Shirt sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/shirt-band-tee-black.png', name = 'Band Tee'
WHERE category = 'shirt' AND name = 'Band T-Shirt';

-- Trousers sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/trousers-plaid-red.png', name = 'Red Plaid'
WHERE category = 'trousers' AND name = 'Skinny Jeans';

-- Shoes sprites
UPDATE character_sprite_assets 
SET asset_url = '/src/assets/sprites/shoes-combat-boots.png', name = 'Combat Boots'
WHERE category = 'shoes' AND name = 'Combat Boots';