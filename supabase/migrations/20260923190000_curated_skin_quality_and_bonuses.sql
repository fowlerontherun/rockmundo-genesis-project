-- Give the first curated packs stronger visual material identity and meaningful,
-- capped gameplay perks. Per-item values stay within the existing clothing bonus
-- validator and aggregate outfit caps.

UPDATE public.avatar_clothing_items
SET
  bonus_enabled = true,
  bonus_config = CASE curated_asset_key
    WHEN 'clothing.starter.logo-tee' THEN '{"daily_xp":10,"performance_pct":1}'::jsonb
    WHEN 'clothing.starter.plain-black-tee' THEN '{"performance_pct":2}'::jsonb
    WHEN 'clothing.starter.plain-white-tee' THEN '{"recording_pct":2}'::jsonb
    WHEN 'clothing.starter.vintage-charcoal-tee' THEN '{"songwriting_pct":2}'::jsonb
    WHEN 'clothing.starter.dark-slim-jeans' THEN '{"performance_pct":1,"recording_pct":1}'::jsonb
    WHEN 'clothing.starter.blue-straight-jeans' THEN '{"daily_xp":5}'::jsonb
    WHEN 'clothing.starter.black-straight-jeans' THEN '{"performance_pct":1,"songwriting_pct":1}'::jsonb
    WHEN 'clothing.starter.canvas-trainers' THEN '{"daily_ap":1}'::jsonb
    WHEN 'clothing.starter.black-boots' THEN '{"performance_pct":2}'::jsonb
    WHEN 'clothing.starter.brown-boots' THEN '{"recording_pct":2}'::jsonb
    WHEN 'clothing.punk.biker-jacket' THEN '{"daily_xp":10,"performance_pct":5}'::jsonb
    WHEN 'clothing.punk.red-tartan-trousers' THEN '{"performance_pct":3,"songwriting_pct":3}'::jsonb
    WHEN 'clothing.punk.black-tartan-trousers' THEN '{"performance_pct":3,"recording_pct":3}'::jsonb
    WHEN 'clothing.punk.combat-boots' THEN '{"daily_ap":2,"performance_pct":2}'::jsonb
    ELSE bonus_config
  END,
  render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
    'curatedFinish',
    CASE curated_asset_key
      WHEN 'clothing.starter.logo-tee' THEN 'cotton'
      WHEN 'clothing.starter.plain-black-tee' THEN 'cotton'
      WHEN 'clothing.starter.plain-white-tee' THEN 'cotton'
      WHEN 'clothing.starter.vintage-charcoal-tee' THEN 'vintage-cotton'
      WHEN 'clothing.starter.dark-slim-jeans' THEN 'denim'
      WHEN 'clothing.starter.blue-straight-jeans' THEN 'denim'
      WHEN 'clothing.starter.black-straight-jeans' THEN 'denim'
      WHEN 'clothing.starter.canvas-trainers' THEN 'canvas'
      WHEN 'clothing.starter.black-boots' THEN 'polished-leather'
      WHEN 'clothing.starter.brown-boots' THEN 'leather'
      WHEN 'clothing.punk.biker-jacket' THEN 'leather'
      WHEN 'clothing.punk.red-tartan-trousers' THEN 'tartan'
      WHEN 'clothing.punk.black-tartan-trousers' THEN 'tartan'
      WHEN 'clothing.punk.combat-boots' THEN 'leather'
      ELSE COALESCE(render_config->>'curatedFinish', 'cotton')
    END
  ),
  material_config = COALESCE(material_config, '{}'::jsonb) || jsonb_build_object(
    'finish',
    CASE curated_asset_key
      WHEN 'clothing.starter.logo-tee' THEN 'cotton'
      WHEN 'clothing.starter.plain-black-tee' THEN 'cotton'
      WHEN 'clothing.starter.plain-white-tee' THEN 'cotton'
      WHEN 'clothing.starter.vintage-charcoal-tee' THEN 'vintage-cotton'
      WHEN 'clothing.starter.dark-slim-jeans' THEN 'denim'
      WHEN 'clothing.starter.blue-straight-jeans' THEN 'denim'
      WHEN 'clothing.starter.black-straight-jeans' THEN 'denim'
      WHEN 'clothing.starter.canvas-trainers' THEN 'canvas'
      WHEN 'clothing.starter.black-boots' THEN 'polished-leather'
      WHEN 'clothing.starter.brown-boots' THEN 'leather'
      WHEN 'clothing.punk.biker-jacket' THEN 'leather'
      WHEN 'clothing.punk.red-tartan-trousers' THEN 'tartan'
      WHEN 'clothing.punk.black-tartan-trousers' THEN 'tartan'
      WHEN 'clothing.punk.combat-boots' THEN 'leather'
      ELSE COALESCE(material_config->>'finish', 'cotton')
    END
  )
WHERE curated_asset_status = 'published'
  AND curated_asset_key IN (
    'clothing.starter.logo-tee',
    'clothing.starter.plain-black-tee',
    'clothing.starter.plain-white-tee',
    'clothing.starter.vintage-charcoal-tee',
    'clothing.starter.dark-slim-jeans',
    'clothing.starter.blue-straight-jeans',
    'clothing.starter.black-straight-jeans',
    'clothing.starter.canvas-trainers',
    'clothing.starter.black-boots',
    'clothing.starter.brown-boots',
    'clothing.punk.biker-jacket',
    'clothing.punk.red-tartan-trousers',
    'clothing.punk.black-tartan-trousers',
    'clothing.punk.combat-boots'
  );

NOTIFY pgrst, 'reload schema';
