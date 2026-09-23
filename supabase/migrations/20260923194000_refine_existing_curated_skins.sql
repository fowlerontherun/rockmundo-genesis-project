-- Refine the existing curated catalogue with named colourways and richer
-- garment/detail metadata. These rows map directly to the material/detail pass
-- rendered by curatedSurfaceMaps.ts.

UPDATE public.avatar_clothing_items
SET
  variant_matrix = CASE curated_asset_key
    WHEN 'clothing.starter.logo-tee' THEN
      '[{"id":"charcoal","name":"Backstage Charcoal","primaryColor":"#20232b","material":"plain","pattern":"solid"},{"id":"bone","name":"Bone White","primaryColor":"#eee8db","material":"plain","pattern":"solid"},{"id":"crimson","name":"Tour Crimson","primaryColor":"#bd3548","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.plain-black-tee' THEN
      '[{"id":"pitch","name":"Pitch Black","primaryColor":"#151515","material":"plain","pattern":"solid"},{"id":"graphite","name":"Graphite","primaryColor":"#30343b","material":"plain","pattern":"solid"},{"id":"bone","name":"Bone","primaryColor":"#eee8db","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.plain-white-tee' THEN
      '[{"id":"studio-white","name":"Studio White","primaryColor":"#ece9df","material":"plain","pattern":"solid"},{"id":"bright-white","name":"Bright White","primaryColor":"#f7f5ee","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.vintage-charcoal-tee' THEN
      '[{"id":"washed-charcoal","name":"Washed Charcoal","primaryColor":"#3b3d42","material":"plain","pattern":"solid"},{"id":"smoke","name":"Stage Smoke","primaryColor":"#2e3034","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.dark-slim-jeans' THEN
      '[{"id":"ink","name":"Ink Wash","primaryColor":"#20252d","material":"denim","pattern":"solid"},{"id":"black-rinse","name":"Black Rinse","primaryColor":"#111318","material":"denim","pattern":"solid"},{"id":"graphite-wash","name":"Graphite Wash","primaryColor":"#343942","material":"denim","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.blue-straight-jeans' THEN
      '[{"id":"mid-blue","name":"Mid Blue Wash","primaryColor":"#40566d","material":"denim","pattern":"solid"},{"id":"night-blue","name":"Night Blue","primaryColor":"#27384b","material":"denim","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.black-straight-jeans' THEN
      '[{"id":"true-black","name":"True Black","primaryColor":"#17191d","material":"denim","pattern":"solid"},{"id":"washed-black","name":"Washed Black","primaryColor":"#25272c","material":"denim","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.canvas-trainers' THEN
      '[{"id":"off-white","name":"Off White","primaryColor":"#ece9df","material":"canvas","pattern":"solid"},{"id":"black","name":"Black Canvas","primaryColor":"#171717","material":"canvas","pattern":"solid"},{"id":"red","name":"Gig Red","primaryColor":"#a92736","material":"canvas","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.black-boots' THEN
      '[{"id":"polished-black","name":"Polished Black","primaryColor":"#151515","material":"patent","pattern":"solid"}]'::jsonb
    WHEN 'clothing.starter.brown-boots' THEN
      '[{"id":"chestnut","name":"Chestnut","primaryColor":"#513a29","material":"plain","pattern":"solid"},{"id":"dark-brown","name":"Dark Brown","primaryColor":"#2e231c","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.punk.biker-jacket' THEN
      '[{"id":"black-leather","name":"Black Leather","primaryColor":"#111111","material":"plain","pattern":"solid"},{"id":"charcoal-leather","name":"Charcoal Leather","primaryColor":"#262626","material":"plain","pattern":"solid"},{"id":"oxblood","name":"Oxblood","primaryColor":"#68262d","material":"plain","pattern":"solid"}]'::jsonb
    WHEN 'clothing.punk.red-tartan-trousers' THEN
      '[{"id":"anarchy-red","name":"Anarchy Red","primaryColor":"#9f2634","material":"plaid","pattern":"tartan"},{"id":"dark-red","name":"Dark Red Tartan","primaryColor":"#191919","material":"plaid","pattern":"tartan"},{"id":"sand-red","name":"Sand & Red","primaryColor":"#d2b79d","material":"plaid","pattern":"tartan"}]'::jsonb
    WHEN 'clothing.punk.black-tartan-trousers' THEN
      '[{"id":"black-watch","name":"Black Watch","primaryColor":"#181818","material":"plaid","pattern":"tartan"},{"id":"ash-tartan","name":"Ash Tartan","primaryColor":"#515151","material":"plaid","pattern":"tartan"},{"id":"bloodline","name":"Bloodline","primaryColor":"#8c2431","material":"plaid","pattern":"tartan"}]'::jsonb
    WHEN 'clothing.punk.combat-boots' THEN
      '[{"id":"black-leather","name":"Black Leather","primaryColor":"#111111","material":"plain","pattern":"solid"},{"id":"worn-brown","name":"Worn Brown","primaryColor":"#332a24","material":"plain","pattern":"solid"}]'::jsonb
    ELSE variant_matrix
  END,
  garment_config = COALESCE(garment_config, '{}'::jsonb) || CASE curated_asset_key
    WHEN 'clothing.punk.biker-jacket' THEN '{"silhouette":"fitted biker","construction":"panelled leather","visualRead":"asymmetric seams and centre zip"}'::jsonb
    WHEN 'clothing.punk.red-tartan-trousers' THEN '{"silhouette":"slim punk trouser","construction":"tartan twill","visualRead":"bold woven checks and seam definition"}'::jsonb
    WHEN 'clothing.punk.black-tartan-trousers' THEN '{"silhouette":"slim punk trouser","construction":"dark tartan twill","visualRead":"low-key checks and seam definition"}'::jsonb
    WHEN 'clothing.punk.combat-boots' THEN '{"silhouette":"heavy combat boot","construction":"stitched leather","visualRead":"toe seams and lace-zone detail"}'::jsonb
    WHEN 'clothing.starter.canvas-trainers' THEN '{"silhouette":"low canvas trainer","construction":"woven canvas","visualRead":"dense canvas weave and sole seam"}'::jsonb
    WHEN 'clothing.starter.dark-slim-jeans' THEN '{"silhouette":"slim jean","construction":"denim twill","visualRead":"twill, seams and thigh whiskers"}'::jsonb
    WHEN 'clothing.starter.blue-straight-jeans' THEN '{"silhouette":"straight jean","construction":"denim twill","visualRead":"classic wash, seams and whiskers"}'::jsonb
    WHEN 'clothing.starter.black-straight-jeans' THEN '{"silhouette":"straight jean","construction":"black denim","visualRead":"dark twill, seams and restrained whiskers"}'::jsonb
    ELSE '{"silhouette":"fitted stage basic","construction":"curated textile","visualRead":"high-detail woven surface"}'::jsonb
  END,
  detail_layers = CASE curated_asset_key
    WHEN 'clothing.punk.biker-jacket' THEN '[{"type":"stitching","name":"Panel seams"},{"type":"zip","name":"Centre zip"},{"type":"distress","name":"Leather grain"}]'::jsonb
    WHEN 'clothing.punk.red-tartan-trousers' THEN '[{"type":"trim","name":"Woven tartan structure"},{"type":"stitching","name":"Leg seams"},{"type":"embroidery","name":"Fabric relief"}]'::jsonb
    WHEN 'clothing.punk.black-tartan-trousers' THEN '[{"type":"trim","name":"Woven tartan structure"},{"type":"stitching","name":"Leg seams"},{"type":"embroidery","name":"Fabric relief"}]'::jsonb
    WHEN 'clothing.punk.combat-boots' THEN '[{"type":"stitching","name":"Toe seams"},{"type":"trim","name":"Lace zone"},{"type":"distress","name":"Leather grain"}]'::jsonb
    WHEN 'clothing.starter.black-boots' THEN '[{"type":"stitching","name":"Toe seams"},{"type":"distress","name":"Polished leather grain"}]'::jsonb
    WHEN 'clothing.starter.brown-boots' THEN '[{"type":"stitching","name":"Toe seams"},{"type":"distress","name":"Leather grain"}]'::jsonb
    WHEN 'clothing.starter.canvas-trainers' THEN '[{"type":"embroidery","name":"Canvas weave"},{"type":"stitching","name":"Sole seam"}]'::jsonb
    WHEN 'clothing.starter.dark-slim-jeans' THEN '[{"type":"embroidery","name":"Denim twill"},{"type":"stitching","name":"Leg seams"},{"type":"distress","name":"Whisker wear"}]'::jsonb
    WHEN 'clothing.starter.blue-straight-jeans' THEN '[{"type":"embroidery","name":"Denim twill"},{"type":"stitching","name":"Leg seams"},{"type":"distress","name":"Whisker wear"}]'::jsonb
    WHEN 'clothing.starter.black-straight-jeans' THEN '[{"type":"embroidery","name":"Denim twill"},{"type":"stitching","name":"Leg seams"},{"type":"distress","name":"Whisker wear"}]'::jsonb
    WHEN 'clothing.starter.vintage-charcoal-tee' THEN '[{"type":"embroidery","name":"Cotton weave"},{"type":"distress","name":"Faded wear"}]'::jsonb
    ELSE '[{"type":"stitching","name":"Textile surface detail"}]'::jsonb
  END
WHERE curated_asset_status='published'
  AND curated_asset_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
