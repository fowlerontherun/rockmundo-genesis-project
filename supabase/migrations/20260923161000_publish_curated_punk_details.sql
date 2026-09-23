-- Add curated Punk detail skins that use validated avatar donor geometry plus
-- small deterministic rig-attached details. No garment body geometry is generated.

DO $$
DECLARE
  punk_collection uuid;
BEGIN
  SELECT id INTO punk_collection
  FROM public.skin_collections
  WHERE lower(name) = 'punk essentials'
  ORDER BY created_at
  LIMIT 1;

  IF punk_collection IS NULL THEN
    RAISE EXCEPTION 'Punk Essentials collection is missing';
  END IF;

  INSERT INTO public.avatar_clothing_items (
    name, description, category, wearable_slot, price, is_premium, rarity,
    color_variants, collection_id, release_date, is_limited_edition, featured,
    curated_asset_key, curated_asset_status, supported_frames, validation_notes,
    material_config, pattern_config, fit_config, wear_config, customization_zones,
    render_config, variant_matrix, preview_status, schema_version, external_key
  ) VALUES
    (
      'Safety Pin Tee',
      'Black punk tee with rig-attached metal safety-pin details.',
      't-shirt','top',300,false,'uncommon','["#111111","#ede9df","#a82b39"]'::jsonb,
      punk_collection,current_date,false,false,
      'clothing.punk.safety-pin-tee','published',ARRAY['masculine','feminine'],
      '{"source":"validated casual body + rig detail","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#111111"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"stage-worn"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#111111","fabric":"plain"},"detailPreset":"safety-pins"}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.safety-pin-tee'
    ),
    (
      'Patch Jacket',
      'Punk jacket with coloured cloth patches and shoulder studs on the validated punk top.',
      'jacket','outerwear',900,false,'epic','["#171717","#384653","#8c2632"]'::jsonb,
      punk_collection,current_date,false,true,
      'clothing.punk.patch-jacket','published',ARRAY['masculine','feminine'],
      '{"source":"validated punk body + rig detail","poses":["idle","singing","guitar","bass"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#171717"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"stage-worn"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"punk","part":"body","color":"#171717","fabric":"plain"},"detailPreset":"patches-and-studs"}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.patch-jacket'
    ),
    (
      'Double Eyelet Belt',
      'Black punk belt with two rows of metal eyelets, attached to the avatar hip rig.',
      'accessory','accessory',225,false,'uncommon','["#111111","#8b8b8b"]'::jsonb,
      punk_collection,current_date,false,false,
      'clothing.punk.double-eyelet-belt','published',ARRAY['masculine','feminine'],
      '{"source":"rig-attached curated detail","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#111111"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#111111","fabric":"plain"},"detailPreset":"double-eyelet-belt"}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.double-eyelet-belt'
    ),
    (
      'Studded Wrist Cuffs',
      'Pair of black wrist cuffs with metal studs attached directly to the hand rig.',
      'accessory','accessory',200,false,'uncommon','["#111111","#8a8a8a"]'::jsonb,
      punk_collection,current_date,false,false,
      'clothing.punk.wrist-cuffs','published',ARRAY['masculine','feminine'],
      '{"source":"rig-attached curated detail","poses":["idle","singing","guitar","bass","drums"],"result":"pass"}'::jsonb,
      '{"fabric":"plain","primaryColor":"#111111"}'::jsonb,'{"type":"solid"}'::jsonb,
      '{"fit":"regular"}'::jsonb,'{"condition":"new"}'::jsonb,'[]'::jsonb,
      '{"curatedSource":{"kind":"avatar-part","style":"casual","part":"body","color":"#111111","fabric":"plain"},"detailPreset":"studded-wrist-cuffs"}'::jsonb,
      '[]'::jsonb,'ready',1,'rockmundo.curated.punk.wrist-cuffs'
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
