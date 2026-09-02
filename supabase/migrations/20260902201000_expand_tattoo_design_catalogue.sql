-- Expand tattoo catalogue so every supported body region has designs and
-- the tattooing specialisms added to the skill tree have matching artwork.

INSERT INTO public.tattoo_designs
  (name, category, body_slot, base_price, ink_color_primary, ink_color_secondary, description, genre_affinity)
SELECT *
FROM (VALUES
  ('Traditional Rose Shoulder','traditional','right_shoulder',650,'#1a1a1a','#b91c1c','Bold traditional rose with classic linework.','{"rock":2,"punk":2}'::jsonb),
  ('Fine Line Moon Shoulder','fine_line','right_shoulder',800,'#202020',NULL,'Delicate crescent moon and stars.','{"indie":2,"pop":1}'::jsonb),
  ('Blackwork Dagger Inner Arm','blackwork','left_inner_arm',900,'#111111',NULL,'Heavy blackwork dagger for the inner arm.','{"metal":2,"punk":2}'::jsonb),
  ('Fine Line Wildflower Inner Arm','fine_line','left_inner_arm',850,'#202020',NULL,'Fine botanical linework designed for the inner arm.','{"folk":2,"indie":2}'::jsonb),
  ('Traditional Swallow Inner Arm','traditional','right_inner_arm',750,'#1a1a1a','#1d4ed8','Classic swallow tattoo with bold colour accents.','{"rock":2,"country":1}'::jsonb),
  ('Realism Eye Inner Arm','realism','right_inner_arm',1800,'#161616','#6b7280','Detailed realistic eye study.','{"alternative":2,"rock":1}'::jsonb),
  ('Blackwork Sun Stomach','blackwork','stomach',1400,'#101010',NULL,'Large radial blackwork sun centred on the stomach.','{"metal":2,"electronic":1}'::jsonb),
  ('Traditional Panther Stomach','traditional','stomach',1600,'#171717','#ca8a04','Classic crawling panther composition.','{"rock":2,"punk":2}'::jsonb),
  ('Realism Tiger Thigh','realism','left_thigh',2600,'#151515','#92400e','Large realistic tiger portrait for the thigh.','{"rock":2,"metal":1}'::jsonb),
  ('Fine Line Botanical Thigh','fine_line','left_thigh',1500,'#242424',NULL,'Extended fine-line botanical piece.','{"folk":2,"indie":2}'::jsonb),
  ('Traditional Eagle Thigh','traditional','right_thigh',1900,'#181818','#b91c1c','Bold traditional eagle with colour highlights.','{"rock":2,"country":2}'::jsonb),
  ('Blackwork Serpent Thigh','blackwork','right_thigh',2100,'#0f0f0f',NULL,'Coiling blackwork serpent with strong negative space.','{"metal":2,"hip_hop":1}'::jsonb),
  ('Fine Line Vine Calf','fine_line','left_calf',1050,'#252525',NULL,'Long flowing vine designed to follow the calf.','{"folk":2,"pop":1}'::jsonb),
  ('Traditional Lightning Calf','traditional','left_calf',950,'#181818','#eab308','Classic lightning bolt flash piece.','{"rock":2,"punk":1}'::jsonb),
  ('Realism Wolf Calf','realism','right_calf',2200,'#151515','#6b7280','Highly detailed wolf portrait.','{"metal":2,"folk":1}'::jsonb),
  ('Blackwork Geometric Calf','blackwork','right_calf',1500,'#101010',NULL,'Dense geometric blackwork panel.','{"electronic":2,"metal":1}'::jsonb)
) AS v(name, category, body_slot, base_price, ink_color_primary, ink_color_secondary, description, genre_affinity)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tattoo_designs d WHERE d.name = v.name
);
