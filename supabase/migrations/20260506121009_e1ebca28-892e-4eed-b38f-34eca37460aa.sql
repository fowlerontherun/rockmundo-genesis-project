
INSERT INTO public.crafting_materials (name, category, rarity, quality_tier, base_cost, description) VALUES
('Mahogany Body Blank','wood','common',1,12000,'Warm, resonant tonewood for guitar/bass bodies.'),
('Alder Body Blank','wood','common',1,9000,'Balanced bright tonewood.'),
('Maple Neck Blank','wood','common',1,7500,'Bright, snappy neck wood.'),
('Rosewood Fretboard','wood','uncommon',2,5500,'Smooth dark fretboard.'),
('Ebony Fretboard','wood','rare',3,12500,'Premium fretboard.'),
('Humbucker Pickup Set','electronics','uncommon',2,18000,'Hot, thick output for metal/rock.'),
('Single-Coil Pickup Set','electronics','uncommon',2,14000,'Bright, articulate output.'),
('Active EMG Pickup Set','electronics','rare',3,26000,'High-output active pickups.'),
('Bass Pickup Set','electronics','uncommon',2,16000,'PJ-style bass pickups.'),
('Pots and Caps Kit','electronics','common',1,2500,'Tone/volume pots and caps.'),
('Birch Drum Shell','wood','uncommon',2,22000,'Punchy birch shells.'),
('Maple Drum Shell','wood','uncommon',2,24000,'Warm rich maple shells.'),
('B20 Bronze Blank','hardware','rare',3,18000,'Cymbal forging blank.'),
('Dynamic Mic Capsule','electronics','uncommon',2,9000,'Standard dynamic capsule.'),
('Condenser Capsule','electronics','rare',3,22000,'Studio condenser capsule.'),
('Pedal Chassis','hardware','common',1,2000,'Aluminium stompbox enclosure.'),
('Overdrive PCB','electronics','uncommon',2,6500,'Pre-etched OD circuit board.'),
('Digital Delay PCB','electronics','rare',3,12000,'Delay/echo circuit board.'),
('Bridge and Hardware Kit','hardware','common',1,6000,'Bridge, tuners, strap pegs.');

WITH m AS (SELECT id, name FROM public.crafting_materials)
INSERT INTO public.crafting_recipes (name, result_category, result_subcategory, required_skill_slug, min_skill_level, materials_required, base_craft_time_minutes, difficulty_tier, rarity_output, description)
SELECT * FROM (VALUES
  ('Apprentice S-Style Guitar','instrument','electric_guitar','luthiery',1,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Alder Body Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Neck Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Rosewood Fretboard'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Single-Coil Pickup Set'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),180,1,'common','Single-coil bolt-on guitar. Bright and articulate.'),
  ('Journeyman LP-Style Guitar','instrument','electric_guitar','luthiery',15,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Mahogany Body Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Neck Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Rosewood Fretboard'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Humbucker Pickup Set'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),240,2,'uncommon','Mahogany set-neck humbucker guitar.'),
  ('EMG Metal Axe','instrument','electric_guitar','luthiery',30,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Mahogany Body Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Neck Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Ebony Fretboard'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Active EMG Pickup Set'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),300,3,'rare','High-output mahogany metal guitar.'),
  ('PJ Bass','instrument','electric_bass','luthiery',10,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Alder Body Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Neck Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Rosewood Fretboard'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bass Pickup Set'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),240,2,'uncommon','Versatile PJ-config bass.'),
  ('Active Metal Bass','instrument','electric_bass','luthiery',35,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Mahogany Body Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Neck Blank'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Ebony Fretboard'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Active EMG Pickup Set'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),300,3,'rare','High-output ebony-board metal bass.'),
  ('Birch Drum Kit','instrument','drum_kit','percussion',10,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Birch Drum Shell'),'qty',5),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',2)
    ),360,2,'uncommon','Punchy 5-piece birch shell pack.'),
  ('Maple Drum Kit','instrument','drum_kit','percussion',25,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Maple Drum Shell'),'qty',5),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',2)
    ),420,3,'rare','Warm 5-piece maple shells.'),
  ('Stage Dynamic Mic','equipment','dynamic_mic','luthiery',1,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Dynamic Mic Capsule'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),120,1,'common','Workhorse dynamic vocal mic.'),
  ('Studio Condenser Mic','equipment','condenser_mic','luthiery',25,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Condenser Capsule'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Bridge and Hardware Kit'),'qty',1)
    ),180,3,'rare','Large-diaphragm condenser.'),
  ('Boutique Overdrive','equipment','overdrive_pedal','luthiery',1,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pedal Chassis'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Overdrive PCB'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1)
    ),90,1,'common','Tube-screamer style OD pedal.'),
  ('Digital Delay Pedal','equipment','delay_pedal','luthiery',15,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pedal Chassis'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Digital Delay PCB'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1)
    ),120,2,'uncommon','Tap-tempo digital delay.'),
  ('Metal Distortion Pedal','equipment','distortion_pedal','luthiery',25,
    jsonb_build_array(
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pedal Chassis'),'qty',1),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Overdrive PCB'),'qty',2),
      jsonb_build_object('material_id',(SELECT id FROM m WHERE name='Pots and Caps Kit'),'qty',1)
    ),150,3,'rare','Tight high-gain distortion.')
) AS v(name, result_category, result_subcategory, required_skill_slug, min_skill_level, materials_required, base_craft_time_minutes, difficulty_tier, rarity_output, description);
