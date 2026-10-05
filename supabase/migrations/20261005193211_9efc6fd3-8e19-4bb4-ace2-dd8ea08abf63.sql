INSERT INTO private.luthiery_shape_options (id,name,instrument_kinds,required_tier,required_level,difficulty_penalty,is_active) VALUES
('compact-double','Compact Double Cut',ARRAY['electric_guitar'],'basic',4,1,true),
('slab-single','Slab Single Cut',ARRAY['electric_guitar'],'basic',8,1,true),
('semi-hollow','Semi-Hollow',ARRAY['electric_guitar'],'professional',8,4,true),
('jazz-bass','Jazz Offset Bass',ARRAY['electric_bass'],'basic',6,1,true),
('modern-bass','Sculpted Bass',ARRAY['electric_bass'],'professional',6,3,true),
('short-scale-bass','Short-Scale Bass',ARRAY['electric_bass'],'basic',3,1,true)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,instrument_kinds=EXCLUDED.instrument_kinds,required_tier=EXCLUDED.required_tier,required_level=EXCLUDED.required_level,difficulty_penalty=EXCLUDED.difficulty_penalty,is_active=EXCLUDED.is_active;
INSERT INTO private.luthiery_component_options (id,label,slot,catalog_names,required_tier,required_level,traits,is_active)
SELECT variant.id,variant.label,base.slot,base.catalog_names,base.required_tier,base.required_level,base.traits,true
FROM (VALUES
('body-chambered-alder','Chambered Alder','body-alder'),
('body-carved-mahogany','Carved Mahogany','body-mahogany'),
('neck-slim-maple','Slim C Maple','neck-maple'),
('neck-chunky-mahogany','Rounded C Mahogany','neck-mahogany'),
('fret-rosewood-block','Rosewood / Block Inlays','fret-rosewood'),
('fret-ebony-clean','Ebony / No Inlays','fret-ebony'),
('elec-p90','P-90 Soapbar','elec-single'),
('elec-jazz','Vintage Twin Single Coils','elec-single'),
('hw-black','Black Locking Hardware','hw-locking'),
('hw-aged','Aged Nickel Fixed Bridge','hw-tom'),
('finish-worn','Worn Satin','finish-satin'),
('finish-natural','Natural Clear Gloss','finish-gloss')
) AS variant(id,label,base_id)
JOIN private.luthiery_component_options base ON base.id=variant.base_id
ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,slot=EXCLUDED.slot,catalog_names=EXCLUDED.catalog_names,required_tier=EXCLUDED.required_tier,required_level=EXCLUDED.required_level,traits=EXCLUDED.traits,is_active=EXCLUDED.is_active;