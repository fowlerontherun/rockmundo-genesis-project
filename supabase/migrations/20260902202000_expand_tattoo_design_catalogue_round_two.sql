-- Expand the tattoo catalogue with additional designs across styles and placements.
-- Idempotent: names are unique for this seed and existing rows are preserved.
INSERT INTO public.tattoo_designs (name, category, body_slot, base_price, ink_color_primary, ink_color_secondary, description, genre_affinity)
SELECT * FROM (VALUES
('Broken Heart Dagger','traditional','chest',850,'#171717','#b91c1c','Classic heart-and-dagger chest piece.','{"rock":0.12,"punk":0.15}'::jsonb),
('Panther Crawl','traditional','left_thigh',1050,'#111111','#dc2626','Bold old-school crawling panther.','{"rock":0.15,"metal":0.08}'::jsonb),
('Swallow Pair','traditional','right_shoulder',700,'#172554','#dc2626','Traditional sailor swallows.','{"indie":0.08,"rock":0.08}'::jsonb),
('Heavy Black Cuff','blackwork','right_forearm',1200,'#080808',NULL,'Dense geometric blackwork cuff.','{"metal":0.16,"industrial":0.12}'::jsonb),
('Negative Space Sun','blackwork','stomach',1450,'#090909',NULL,'Large black sun built around negative space.','{"metal":0.12,"alternative":0.10}'::jsonb),
('Obsidian Calf Bands','blackwork','left_calf',1250,'#050505',NULL,'Layered solid-black calf bands.','{"industrial":0.14,"metal":0.12}'::jsonb),
('Single Line Rose','fine_line','left_wrist',550,'#222222',NULL,'Delicate continuous-line rose.','{"indie":0.12,"pop":0.08}'::jsonb),
('Tiny Constellation','fine_line','neck',500,'#202020',NULL,'Fine constellation dots and connecting lines.','{"pop":0.08,"electronic":0.08}'::jsonb),
('Botanical Wrap','fine_line','right_forearm',950,'#252525',NULL,'Intricate fine-line botanical wrap.','{"folk":0.12,"indie":0.10}'::jsonb),
('Microphone Portrait','realism','left_upper_arm',2600,'#151515','#6b7280','Detailed studio microphone rendered in realism.','{"rock":0.12,"pop":0.10,"hip-hop":0.10}'::jsonb),
('Tiger Eyes','realism','back',3200,'#121212','#d97706','Large realistic tiger-eye back piece.','{"rock":0.14,"metal":0.12}'::jsonb),
('Vinyl Reflection','realism','right_thigh',2800,'#111827','#64748b','Photoreal vinyl record with reflected light.','{"rock":0.10,"electronic":0.10,"pop":0.08}'::jsonb),
('Dragon Coil','japanese','left_calf',2200,'#172554','#dc2626','Coiling Japanese dragon calf piece.','{"metal":0.14,"rock":0.10}'::jsonb),
('Koi Current','japanese','right_calf',2100,'#1e3a8a','#ea580c','Koi swimming through stylised water.','{"rock":0.08,"indie":0.06}'::jsonb),
('Amp Stack','musical','right_upper_arm',900,'#18181b','#71717a','A roaring stack of guitar amplifiers.','{"rock":0.18,"metal":0.12}'::jsonb),
('Cassette Forever','musical','left_forearm',750,'#27272a','#e11d48','Retro cassette and trailing tape.','{"indie":0.14,"pop":0.08}'::jsonb),
('Sacred Geometry Spine','geometric','back',1900,'#18181b',NULL,'Precise geometric composition running down the back.','{"electronic":0.12,"alternative":0.08}'::jsonb),
('Prism Shoulder','geometric','right_shoulder',850,'#111827','#7c3aed','Layered prism geometry.','{"electronic":0.14,"pop":0.06}'::jsonb),
('Raven Skull','skull','left_shoulder',1350,'#111111','#374151','Raven perched across a weathered skull.','{"metal":0.18,"rock":0.10}'::jsonb),
('Crowned Skull','skull','right_thigh',1800,'#111111','#d4af37','Large crowned skull statement piece.','{"metal":0.16,"rock":0.12}'::jsonb),
('Full Noise Sleeve','sleeve','left_inner_arm',2400,'#111827','#be123c','Dense music-and-noise sleeve section.','{"rock":0.16,"punk":0.12}'::jsonb),
('Electric Storm','abstract','right_inner_arm',1500,'#1e1b4b','#7c3aed','Abstract lightning and flowing ink.','{"electronic":0.15,"rock":0.08}'::jsonb),
('Stage Lights','abstract','stomach',1750,'#172554','#db2777','Sweeping beams and stage-light forms.','{"pop":0.12,"electronic":0.12}'::jsonb),
('Wolf Portrait','portrait','chest',3000,'#171717','#6b7280','Detailed wolf portrait chest piece.','{"rock":0.12,"metal":0.12}'::jsonb)
) AS v(name,category,body_slot,base_price,ink_color_primary,ink_color_secondary,description,genre_affinity)
WHERE NOT EXISTS (SELECT 1 FROM public.tattoo_designs t WHERE t.name = v.name);
