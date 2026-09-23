-- Increase the visual quality of the existing tartan skins without adding new catalogue items.
-- Each named colourway now carries an explicit secondary weave colour so the renderer
-- can produce a true multi-tone cloth instead of a monochrome tinted check.

UPDATE public.avatar_clothing_items
SET variant_matrix = CASE curated_asset_key
  WHEN 'clothing.punk.red-tartan-trousers' THEN
    '[
      {"id":"anarchy-red","name":"Anarchy Red","primaryColor":"#9f2634","secondaryColor":"#171717","material":"plaid","pattern":"tartan"},
      {"id":"dark-red","name":"Dark Red Tartan","primaryColor":"#641c27","secondaryColor":"#101114","material":"plaid","pattern":"tartan"},
      {"id":"sand-red","name":"Sand & Red","primaryColor":"#d2b79d","secondaryColor":"#8c2431","material":"plaid","pattern":"tartan"}
    ]'::jsonb
  WHEN 'clothing.punk.black-tartan-trousers' THEN
    '[
      {"id":"black-watch","name":"Black Watch","primaryColor":"#181818","secondaryColor":"#32463f","material":"plaid","pattern":"tartan"},
      {"id":"ash-tartan","name":"Ash Tartan","primaryColor":"#515151","secondaryColor":"#171717","material":"plaid","pattern":"tartan"},
      {"id":"bloodline","name":"Bloodline","primaryColor":"#29272b","secondaryColor":"#8c2431","material":"plaid","pattern":"tartan"}
    ]'::jsonb
  ELSE variant_matrix
END,
render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
  'patternRendering', 'multi-tone-woven-v1',
  'surfaceNormalDetail', 'high'
)
WHERE curated_asset_key IN (
  'clothing.punk.red-tartan-trousers',
  'clothing.punk.black-tartan-trousers'
);

NOTIFY pgrst, 'reload schema';
