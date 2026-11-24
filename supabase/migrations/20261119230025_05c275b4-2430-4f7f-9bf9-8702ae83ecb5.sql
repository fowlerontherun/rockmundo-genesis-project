-- Genre stage wardrobes reuse shipped rigged donors and the existing paid-set checkout.
INSERT INTO public.skin_collections(name,description,theme,starts_at,is_active,sort_order)
SELECT v.name,v.description,v.theme,now(),true,v.sort_order FROM (VALUES
('Metal After Midnight','Charcoal cotton, black denim and leather stage boots.','monthly',20),
('Indie Soundcheck','Sea-green stripes, straight denim and canvas trainers.','monthly',21),
('Electronic Pulse','Rose-and-white stripes, graphite trousers and light trainers.','monthly',22),
('Jazz Club Sessions','Burgundy cotton, tailored trousers and polished boots.','monthly',23)
) v(name,description,theme,sort_order) WHERE NOT EXISTS (SELECT 1 FROM public.skin_collections c WHERE c.name=v.name);
INSERT INTO public.avatar_clothing_items(name,description,category,wearable_slot,price,is_premium,rarity,collection_id,release_date,featured,curated_asset_key,curated_asset_status,supported_frames,material_config,pattern_config,fit_config,render_config,validation_notes,external_key,preview_status)
SELECT v.name,v.genre||' stage wardrobe. Included in the full paid collection.',v.category,v.slot,0,false,'uncommon',c.id,current_date,true,'clothing.genre.'||v.pack||'.'||v.slot,'published',ARRAY['masculine','feminine'],
jsonb_build_object('primaryColor',v.color,'finish',v.finish),jsonb_build_object('type',CASE WHEN v.fabric='stripe' THEN 'stripes' ELSE 'solid' END),jsonb_build_object('fit','regular'),
jsonb_build_object('curatedSource',jsonb_build_object('kind','avatar-part','style',v.style,'part',v.part,'shape',v.shape,'color',v.color,'secondaryColor','#ece9df','fabric',v.fabric,'finish',v.finish)),
'{"result":"pass","source":"shipped rigged donor meshes","checks":{"surface_attachment":true,"graphic_alignment":true,"distance_readability":true,"silhouette_readability":true,"material_readability":true},"automatedChecks":["masculine","feminine","vocals","guitar","bass","drums"],"visualReview":"All four packs on both frames in singing previews; additional guitar and drummer previews. Patterns are mesh-bound; no detached graphic layers. Exhaustive clipping at every animation frame is not certified."}'::jsonb,
'rockmundo.genre.'||v.pack||'.'||v.slot,'ready'
FROM (VALUES
('metal','Metal After Midnight','Metal','After Midnight Tee','t-shirt','top','casual','body','tee','#24262b','plain','cotton'),
('metal','Metal After Midnight','Metal','Blackout Stage Jeans','pants','bottom','suit','legs','trousers','#17191d','denim','denim'),
('metal','Metal After Midnight','Metal','Iron Stage Boots','boots','footwear','punk','feet','as-is','#292b30','plain','leather'),
('indie','Indie Soundcheck','Indie Rock','Soundcheck Stripe Tee','t-shirt','top','casual','body','tee','#427b70','stripe','cotton'),
('indie','Indie Soundcheck','Indie Rock','Indie Straight Jeans','pants','bottom','suit','legs','trousers','#40566d','denim','denim'),
('indie','Indie Soundcheck','Indie Rock','Soundcheck Canvas Trainers','trainers','footwear','casual','feet','as-is','#ece9df','canvas','canvas'),
('electronic','Electronic Pulse','Electronic','Pulse Stripe Tee','t-shirt','top','casual','body','tee','#c34e7a','stripe','cotton'),
('electronic','Electronic Pulse','Electronic','Graphite Stage Trousers','pants','bottom','suit','legs','trousers','#30343b','plain','cotton'),
('electronic','Electronic Pulse','Electronic','Pulse Canvas Trainers','trainers','footwear','casual','feet','as-is','#ece9df','canvas','canvas'),
('jazz','Jazz Club Sessions','Jazz','Club Sessions Tee','t-shirt','top','casual','body','tee','#843f49','plain','vintage-cotton'),
('jazz','Jazz Club Sessions','Jazz','Club Tailored Trousers','pants','bottom','suit','legs','trousers','#343942','plain','cotton'),
('jazz','Jazz Club Sessions','Jazz','Club Polished Boots','boots','footwear','punk','feet','as-is','#292b30','plain','polished-leather')
) v(pack,collection,genre,name,category,slot,style,part,shape,color,fabric,finish)
JOIN public.skin_collections c ON c.name=v.collection
WHERE NOT EXISTS (SELECT 1 FROM public.avatar_clothing_items i WHERE i.curated_asset_key='clothing.genre.'||v.pack||'.'||v.slot);