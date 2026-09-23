-- Expand the curated catalogue with additional safe variants built from
-- already-shipped avatar parts. These do not create new geometry.

DO $$
DECLARE
  starter_collection uuid;
  punk_collection uuid;
BEGIN
  SELECT id INTO starter_collection FROM public.skin_collections
  WHERE lower(name) = 'starter wardrobe' ORDER BY created_at LIMIT 1;
  SELECT id INTO punk_collection FROM public.skin_collections
  WHERE lower(name) = 'punk essentials' ORDER BY created_at LIMIT 1;

  IF starter_collection IS NULL OR punk_collection IS NULL THEN
    RAISE EXCEPTION 'Curated skin collections are missing';
  END IF;

  INSERT INTO public.avatar_clothing_items (
    name, description, category, wearable_slot, price, is_premium, rarity,
    color_variants, collection_id, release_date, is_limited_edition, featured,
    curated_asset_key, curated_asset_status, supported_frames, validation_notes,
    material_config, pattern_config, fit_config, wear_config, customization_zones,
    render_config, variant_matrix, preview_status, schema_version, external_key
  ) VALUES
    (
      'Plain White Tee','A clean white tee based on the validated casual top.',
      't-shirt','top',75,false,'common','["#ece9df","#f7f5ee"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.plain-white-tee','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual body","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#ece9df"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#ece9df","fabric":"plain"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.plain-white-tee'
    ),
    (
      'Vintage Charcoal Tee','A faded charcoal tee using the validated casual top.',
      't-shirt','top',100,false,'common','["#3b3d42","#2e3034"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.vintage-charcoal-tee','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual body","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#3b3d42"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"vintage"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#3b3d42","fabric":"plain"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.vintage-charcoal-tee'
    ),
    (
      'Blue Straight Jeans','Classic blue jeans using the validated casual leg mesh.',
      'jeans','bottom',150,false,'common','["#40566d","#27384b"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.blue-straight-jeans','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual legs","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"denim","primaryColor":"#40566d"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"washed"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"legs","color":"#40566d","fabric":"denim"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.blue-straight-jeans'
    ),
    (
      'Black Straight Jeans','Straight black jeans using the validated casual leg mesh.',
      'jeans','bottom',150,false,'common','["#17191d","#25272c"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.black-straight-jeans','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual legs","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"denim","primaryColor":"#17191d"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"legs","color":"#17191d","fabric":"denim"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.black-straight-jeans'
    ),
    (
      'Canvas Trainers','Everyday canvas trainers using the validated casual footwear mesh.',
      'trainers','footwear',120,false,'common','["#ece9df","#171717","#a92736"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.canvas-trainers','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual feet","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"canvas","primaryColor":"#ece9df"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"feet","color":"#ece9df","fabric":"canvas"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.canvas-trainers'
    ),
    (
      'Black Boots','Simple black boots using the proven punk footwear mesh.',
      'boots','footwear',180,false,'common','["#151515"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.black-boots','published',ARRAY['masculine','feminine'],
      '{"source":"validated punk feet","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#151515"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"feet","color":"#151515","fabric":"plain"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.black-boots'
    ),
    (
      'Brown Boots','Brown leather-look boots using the proven punk footwear mesh.',
      'boots','footwear',180,false,'common','["#513a29","#2e231c"]'::jsonb,
      starter_collection,current_date,false,false,
      'clothing.starter.brown-boots','published',ARRAY['masculine','feminine'],
      '{"source":"validated punk feet","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#513a29"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"feet","color":"#513a29","fabric":"plain"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.starter.brown-boots'
    ),
    (
      'Red Tartan Trousers','Red tartan punk trousers using the tested punk leg mesh with plaid fabric.',
      'pants','bottom',450,false,'rare','["#9f2634","#191919","#d2b79d"]'::jsonb,
      punk_collection,current_date,false,false,
      'clothing.punk.red-tartan-trousers','published',ARRAY['masculine','feminine'],
      '{"source":"validated punk legs","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plaid","primaryColor":"#9f2634"}'::jsonb,'{"type":"tartan"}'::jsonb,
      '{"fit":"slim"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"legs","color":"#9f2634","fabric":"plaid"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.red-tartan-trousers'
    ),
    (
      'Black Tartan Trousers','Black tartan punk trousers using the tested punk leg mesh with plaid fabric.',
      'pants','bottom',450,false,'rare','["#181818","#515151","#8c2431"]'::jsonb,
      punk_collection,current_date,false,false,
      'clothing.punk.black-tartan-trousers','published',ARRAY['masculine','feminine'],
      '{"source":"validated punk legs","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plaid","primaryColor":"#181818"}'::jsonb,'{"type":"tartan"}'::jsonb,
      '{"fit":"slim"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"legs","color":"#181818","fabric":"plaid"}}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.black-tartan-trousers'
    )
  ON CONFLICT (curated_asset_key) WHERE curated_asset_key IS NOT NULL
  DO UPDATE SET
    name=EXCLUDED.name,description=EXCLUDED.description,category=EXCLUDED.category,
    wearable_slot=EXCLUDED.wearable_slot,price=EXCLUDED.price,rarity=EXCLUDED.rarity,
    color_variants=EXCLUDED.color_variants,collection_id=EXCLUDED.collection_id,
    curated_asset_status=EXCLUDED.curated_asset_status,supported_frames=EXCLUDED.supported_frames,
    validation_notes=EXCLUDED.validation_notes,material_config=EXCLUDED.material_config,
    pattern_config=EXCLUDED.pattern_config,fit_config=EXCLUDED.fit_config,
    wear_config=EXCLUDED.wear_config,render_config=EXCLUDED.render_config,
    preview_status=EXCLUDED.preview_status,external_key=EXCLUDED.external_key;
END $$;

NOTIFY pgrst, 'reload schema';
