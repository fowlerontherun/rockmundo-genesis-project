-- Publish the first five curated skins using the already-shipped, tested
-- Rockmundo avatar meshes as donor parts. This gives the curated system real
-- usable content without reintroducing procedural garment geometry.

DO $$
DECLARE
  starter_collection uuid;
  punk_collection uuid;
BEGIN
  SELECT id INTO starter_collection
  FROM public.skin_collections
  WHERE lower(name) = 'starter wardrobe'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO punk_collection
  FROM public.skin_collections
  WHERE lower(name) = 'punk essentials'
  ORDER BY created_at
  LIMIT 1;

  IF starter_collection IS NULL OR punk_collection IS NULL THEN
    RAISE EXCEPTION 'Curated skin collections are missing; apply 20260923130000_curated_skin_packs.sql first';
  END IF;

  INSERT INTO public.avatar_clothing_items (
    name, description, category, wearable_slot, price, is_premium, rarity,
    color_variants, collection_id, release_date, is_limited_edition, featured,
    curated_asset_key, curated_asset_status, supported_frames, validation_notes,
    material_config, pattern_config, fit_config, wear_config, customization_zones,
    render_config, variant_matrix, preview_status, schema_version, external_key
  ) VALUES
    (
      'Rockmundo Logo Tee',
      'The classic Rockmundo logo T-shirt, built from the proven casual avatar top.',
      't-shirt', 'top', 0, false, 'common',
      '["#20232b","#eee8db","#bd3548"]'::jsonb,
      starter_collection, current_date, false, true,
      'clothing.starter.logo-tee', 'published', ARRAY['masculine','feminine'],
      '{"source":"validated starter avatar body","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#20232b"}'::jsonb,
      '{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,
      '{"condition":"new"}'::jsonb,
      '[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#20232b","fabric":"plain"},"wordmark":"rockmundo"}'::jsonb,
      '[]'::jsonb, 'ready', 1, 'rockmundo.curated.starter.logo-tee'
    ),
    (
      'Plain Black Tee',
      'A clean black stage T-shirt using the validated casual avatar top.',
      't-shirt', 'top', 75, false, 'common',
      '["#151515","#30343b","#eee8db"]'::jsonb,
      starter_collection, current_date, false, false,
      'clothing.starter.plain-black-tee', 'published', ARRAY['masculine','feminine'],
      '{"source":"validated starter avatar body","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#151515"}'::jsonb,
      '{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,
      '{"condition":"new"}'::jsonb,
      '[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#151515","fabric":"plain"}}'::jsonb,
      '[]'::jsonb, 'ready', 1, 'rockmundo.curated.starter.plain-black-tee'
    ),
    (
      'Dark Slim Jeans',
      'Dark stage jeans based on the existing validated punk leg mesh.',
      'jeans', 'bottom', 150, false, 'common',
      '["#20252d","#111318","#343942"]'::jsonb,
      starter_collection, current_date, false, false,
      'clothing.starter.dark-slim-jeans', 'published', ARRAY['masculine','feminine'],
      '{"source":"validated punk avatar legs","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"denim","primaryColor":"#20252d"}'::jsonb,
      '{"type":"solid"}'::jsonb,
      '{"fit":"slim"}'::jsonb,
      '{"condition":"washed"}'::jsonb,
      '[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"legs","color":"#20252d","fabric":"denim"}}'::jsonb,
      '[]'::jsonb, 'ready', 1, 'rockmundo.curated.starter.dark-slim-jeans'
    ),
    (
      'Biker Jacket',
      'A black punk stage top using Rockmundo''s existing validated punk body mesh.',
      'jacket', 'top', 700, false, 'rare',
      '["#111111","#262626","#68262d"]'::jsonb,
      punk_collection, current_date, false, true,
      'clothing.punk.biker-jacket', 'published', ARRAY['masculine','feminine'],
      '{"source":"validated punk avatar body","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#111111"}'::jsonb,
      '{"type":"solid"}'::jsonb,
      '{"fit":"slim"}'::jsonb,
      '{"condition":"stage-worn"}'::jsonb,
      '[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"body","color":"#111111","fabric":"plain"}}'::jsonb,
      '[]'::jsonb, 'ready', 1, 'rockmundo.curated.punk.biker-jacket'
    ),
    (
      'Combat Boots',
      'Heavy black stage boots using the existing validated punk footwear mesh.',
      'boots', 'footwear', 350, false, 'uncommon',
      '["#111111","#332a24"]'::jsonb,
      punk_collection, current_date, false, false,
      'clothing.punk.combat-boots', 'published', ARRAY['masculine','feminine'],
      '{"source":"validated punk avatar feet","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#111111"}'::jsonb,
      '{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,
      '{"condition":"stage-worn"}'::jsonb,
      '[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"feet","color":"#111111","fabric":"plain"}}'::jsonb,
      '[]'::jsonb, 'ready', 1, 'rockmundo.curated.punk.combat-boots'
    )
  ON CONFLICT (curated_asset_key) WHERE curated_asset_key IS NOT NULL
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    wearable_slot = EXCLUDED.wearable_slot,
    price = EXCLUDED.price,
    rarity = EXCLUDED.rarity,
    color_variants = EXCLUDED.color_variants,
    collection_id = EXCLUDED.collection_id,
    curated_asset_status = EXCLUDED.curated_asset_status,
    supported_frames = EXCLUDED.supported_frames,
    validation_notes = EXCLUDED.validation_notes,
    material_config = EXCLUDED.material_config,
    pattern_config = EXCLUDED.pattern_config,
    fit_config = EXCLUDED.fit_config,
    wear_config = EXCLUDED.wear_config,
    render_config = EXCLUDED.render_config,
    preview_status = EXCLUDED.preview_status,
    external_key = EXCLUDED.external_key;
END $$;

NOTIFY pgrst, 'reload schema';
