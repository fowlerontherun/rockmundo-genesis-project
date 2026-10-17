UPDATE public.avatar_clothing_items
SET detail_layers = '[{"type":"graphic","name":"Mod target","asset":"mod roundel","surface":"front","color":"#c8102e","secondaryColor":"#1f3c8f","scale":120,"offsetY":8}]'::jsonb
WHERE curated_asset_key = 'clothing.britpop.mod-stripe-tee';