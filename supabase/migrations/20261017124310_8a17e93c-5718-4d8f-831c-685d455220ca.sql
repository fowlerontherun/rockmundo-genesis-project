-- Cool Britannia '96: 90s Britpop collection.
-- Clothing reuses already-validated Avatar V1 donor parts (casual/punk body,
-- casual legs/feet) and the validated bucket headwear geometry, recoloured.
INSERT INTO public.skin_collections (name, description, theme, starts_at, ends_at, is_active, sort_order)
SELECT 'Cool Britannia ''96', 'Bucket hats, parkas, mod stripes and a Union Jack axe. Mad for it. Equipped pieces boost gigs and recording sessions.', 'limited', now(), NULL, true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.skin_collections WHERE name = 'Cool Britannia ''96');

ALTER TABLE public.instrument_skin_items DROP CONSTRAINT IF EXISTS instrument_skin_items_design_key_check;
ALTER TABLE public.instrument_skin_items ADD CONSTRAINT instrument_skin_items_design_key_check
  CHECK (design_key IN ('solid','two_tone','sunburst','racing_stripes','checker','flames','lightning','union_jack'));

INSERT INTO public.instrument_skin_items (external_key, name, description, target_instrument, price, rarity, is_limited_edition, featured, collection_id, design_key, body_color, secondary_color, pickguard_color, hardware_color, color_variants)
SELECT v.k, v.n, v.d, v.t, v.p, 'epic', true, true, c.id, 'union_jack', '#012169', '#c8102e', '#ffffff', '#d9dce1', '["#012169","#c8102e","#ffffff"]'::jsonb
FROM public.skin_collections c,
(VALUES
 ('rockmundo.britpop.union-jack-guitar','Union Jack Guitar','The flag-painted six-string of every 1996 Knebworth dream. Navy, red and white across the whole body.','electric_guitar',4500),
 ('rockmundo.britpop.union-jack-bass','Union Jack Bass','A four-string flag for the low end of Cool Britannia.','bass_guitar',4500)
) v(k,n,d,t,p)
WHERE c.name = 'Cool Britannia ''96'
ON CONFLICT (external_key) DO UPDATE SET design_key = EXCLUDED.design_key, collection_id = EXCLUDED.collection_id, body_color = EXCLUDED.body_color, secondary_color = EXCLUDED.secondary_color, pickguard_color = EXCLUDED.pickguard_color, hardware_color = EXCLUDED.hardware_color, is_active = true;

INSERT INTO public.avatar_clothing_items (
  name, description, category, wearable_slot, price, is_premium, rarity, color_variants, collection_id,
  release_date, is_limited_edition, featured, curated_asset_key, curated_asset_status, supported_frames,
  validation_notes, material_config, pattern_config, fit_config, wear_config, customization_zones,
  render_config, garment_config, detail_layers, variant_matrix, preview_status, schema_version, external_key,
  bonus_enabled, bonus_config
)
SELECT v.name, v.descr, v.cat, v.slot, v.price, false, v.rarity, jsonb_build_array(v.color), c.id,
  current_date, true, v.featured, v.akey, 'published', ARRAY['masculine','feminine'],
  jsonb_build_object('result','pass','source',v.src,'poses',jsonb_build_array('idle','singing','guitar','bass','drums'),
    'checks',jsonb_build_object('surface_attachment',true,'graphic_alignment',true,'distance_readability',true,'silhouette_readability',true,'material_readability',true)),
  jsonb_build_object('fabric',v.fabric,'finish',v.finish,'primaryColor',v.color),
  jsonb_build_object('type',v.pattern),
  jsonb_build_object('fit',v.fit), '{"condition":"new"}'::jsonb, '[]'::jsonb,
  v.render, jsonb_build_object('visualRead',v.vread), '[]'::jsonb, '[]'::jsonb, 'ready', 1, 'rockmundo.' || v.akey,
  true, v.bonus
FROM public.skin_collections c,
(VALUES
 ('Britpop Bucket Hat','The definitive terrace bucket hat. Pulled low, swagger on.','hat','headwear',1200,'rare',true,'clothing.britpop.bucket-hat','#e8e0c8','plain','cotton','solid','regular','validated bucket headwear',
   '{"headwearStyle":"bucket","renderFamily":"avatar-v1-accessory"}'::jsonb,'cream cotton bucket hat','{"performance_pct":2,"recording_pct":3}'::jsonb),
 ('Mod Stripe Tee','Navy and white Breton stripes straight off a Camden market rail.','t-shirt','top',900,'uncommon',false,'clothing.britpop.mod-stripe-tee','#1d2b53','stripe','cotton','stripe','regular','validated casual body',
   '{"curatedSource":{"kind":"avatar-part","part":"body","style":"casual","fabric":"stripe","color":"#1d2b53","secondaryColor":"#f2efe6"},"curatedFinish":"cotton","attachmentPolicy":"surface-bound-v1"}'::jsonb,'navy breton stripe tee','{"performance_pct":2,"recording_pct":1}'::jsonb),
 ('Terrace Parka','Olive fishtail-style parka for windswept festival fields.','jacket','top',2800,'epic',true,'clothing.britpop.terrace-parka','#55603a','canvas','canvas','solid','regular','validated punk body',
   '{"curatedSource":{"kind":"avatar-part","part":"body","style":"punk","fabric":"canvas","color":"#55603a"},"curatedFinish":"canvas","attachmentPolicy":"surface-bound-v1"}'::jsonb,'olive canvas parka','{"performance_pct":4}'::jsonb),
 ('Baggy Stonewash Jeans','Light-wash 90s denim, slightly too long.','jeans','bottom',1100,'uncommon',false,'clothing.britpop.stonewash-jeans','#7d98b3','denim','denim','solid','regular','validated casual legs',
   '{"curatedSource":{"kind":"avatar-part","part":"legs","style":"casual","fabric":"denim","color":"#7d98b3"},"curatedFinish":"denim","attachmentPolicy":"surface-bound-v1"}'::jsonb,'light stonewash denim','{"recording_pct":2}'::jsonb),
 ('Terrace Trainers','Navy suede-look terrace trainers with a white sole.','trainers','footwear',1000,'uncommon',false,'clothing.britpop.terrace-trainers','#1f2f5c','canvas','canvas','solid','regular','validated casual feet',
   '{"curatedSource":{"kind":"avatar-part","part":"feet","style":"casual","fabric":"canvas","color":"#1f2f5c"},"curatedFinish":"canvas","attachmentPolicy":"surface-bound-v1"}'::jsonb,'navy terrace trainer','{"performance_pct":1}'::jsonb)
) v(name,descr,cat,slot,price,rarity,featured,akey,color,fabric,finish,pattern,fit,src,render,vread,bonus)
WHERE c.name = 'Cool Britannia ''96'
ON CONFLICT (curated_asset_key) WHERE curated_asset_key IS NOT NULL DO UPDATE
SET collection_id = EXCLUDED.collection_id, render_config = EXCLUDED.render_config, material_config = EXCLUDED.material_config,
    bonus_enabled = EXCLUDED.bonus_enabled, bonus_config = EXCLUDED.bonus_config, price = EXCLUDED.price;

-- Restore the band-level outfit resolver complete-gig already calls (it was never applied live).
CREATE OR REPLACE FUNCTION public.get_band_equipped_clothing_performance_bonus(p_band_id uuid)
RETURNS TABLE (performance_pct numeric, member_count integer, members_with_bonus integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (
    SELECT DISTINCT bm.profile_id FROM public.band_members bm
    WHERE bm.band_id = p_band_id AND bm.member_status = 'active'
      AND COALESCE(bm.is_touring_member, false) = false AND bm.profile_id IS NOT NULL
  ), r AS (
    SELECT COALESCE((SELECT b.performance_pct FROM public.get_equipped_clothing_bonuses(m.profile_id) b), 0)::numeric AS pct FROM m
  )
  SELECT LEAST(20, COALESCE(AVG(pct), 0))::numeric, COUNT(*)::integer, COUNT(*) FILTER (WHERE pct > 0)::integer FROM r;
$$;
REVOKE ALL ON FUNCTION public.get_band_equipped_clothing_performance_bonus(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_band_equipped_clothing_performance_bonus(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';