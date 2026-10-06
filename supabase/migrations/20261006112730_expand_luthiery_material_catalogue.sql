WITH seed(name,category,rarity,quality_tier,base_cost,description) AS (
  VALUES
    ('Basswood Body Blank','wood','common',1,8000,'Lightweight, easy-working body wood with a balanced midrange.'),
    ('Hard Maple Body Blank','wood','uncommon',2,18000,'Dense bright body wood with strong attack and sustain.'),
    ('Walnut Body Blank','wood','rare',3,30000,'Rich dark tonewood with a focused low-mid response.'),
    ('Bubinga Body Blank','wood','epic',4,52000,'Dense exotic body wood with huge sustain and striking grain.'),
    ('Flamed Maple Body Blank','wood','legendary',5,85000,'Highly figured premium maple reserved for showpiece instruments.'),
    ('Roasted Maple Neck Blank','wood','rare',3,26000,'Heat-treated maple with excellent dimensional stability.'),
    ('Wenge Neck Blank','wood','epic',4,46000,'Stiff open-grained neck stock with strong sustain and stability.'),
    ('Pau Ferro Fretboard','wood','uncommon',2,10500,'Smooth, articulate fretboard wood between maple and rosewood in response.'),
    ('Richlite Fretboard','wood','uncommon',2,9500,'Stable engineered fretboard material with consistent feel.'),
    ('Macassar Ebony Fretboard','wood','epic',4,40000,'Premium striped ebony with fast attack and exceptional stability.'),
    ('Ceramic Humbucker Set','electronics','common',1,12000,'Aggressive ceramic-magnet humbuckers with strong output.'),
    ('P-90 Pickup Set','electronics','uncommon',2,19000,'Broad single-coil voice with extra midrange bite.'),
    ('Bass P/J Pickup Set','electronics','uncommon',2,18000,'Versatile precision-and-jazz style bass pickup pairing.'),
    ('Noiseless Single-Coil Set','electronics','rare',3,32000,'Single-coil clarity with reduced hum for professional builds.'),
    ('Mini Humbucker Set','electronics','rare',3,34000,'Compact humbuckers with a tighter, brighter response.'),
    ('Active Bass Preamp Set','electronics','epic',4,50000,'High-headroom active bass electronics with onboard shaping.'),
    ('Piezo Bridge Pickup System','electronics','epic',4,52000,'Bridge-mounted piezo system for detailed acoustic-like attack.'),
    ('Brass Bridge and Nut Set','hardware','uncommon',2,16000,'Dense brass contact points for extra sustain and brightness.'),
    ('Lightweight Aluminum Hardware Set','hardware','uncommon',2,17000,'Low-mass bridge and fittings that keep the instrument light.'),
    ('Stainless Hardware Set','hardware','rare',3,28000,'Corrosion-resistant premium hardware with excellent stability.'),
    ('Black Chrome Hardware Set','hardware','rare',3,30000,'Professional black-chrome bridge, tuners and fittings.'),
    ('Titanium Hardware Set','hardware','legendary',5,95000,'Ultra-premium low-mass titanium hardware for masterwork builds.'),
    ('Tru-Oil Finish','finish','common',1,6000,'Thin hand-rubbed oil finish that keeps the wood feeling natural.'),
    ('Polyurethane Gloss Finish','finish','uncommon',2,15000,'Durable high-gloss finish suited to hard-working instruments.'),
    ('Relic Finish','finish','rare',3,24000,'Professionally aged finish with controlled wear and patina.'),
    ('Candy Colour Finish','finish','rare',3,28000,'Deep translucent colour over a reflective base coat.'),
    ('Pearlescent Finish','finish','epic',4,48000,'Multi-angle pearl finish that shifts under stage lighting.'),
    ('Holographic Finish','finish','legendary',5,90000,'Master-level prismatic finish with dramatic light-shifting effects.')
)
INSERT INTO public.crafting_materials(name,category,rarity,quality_tier,base_cost,description)
SELECT name,category,rarity,quality_tier,base_cost,description
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.crafting_materials existing WHERE lower(existing.name)=lower(s.name)
);

INSERT INTO private.luthiery_component_options
  (id,label,slot,catalog_names,required_tier,required_level,traits,is_active)
VALUES
  ('body-basswood','Basswood','body',ARRAY['Basswood Body Blank'],'basic',2,'{"tone":1,"sustain":0,"stability":1}'::jsonb,true),
  ('body-hard-maple','Hard Maple','body',ARRAY['Hard Maple Body Blank'],'basic',10,'{"tone":4,"sustain":3,"stability":4}'::jsonb,true),
  ('body-walnut','Walnut','body',ARRAY['Walnut Body Blank'],'professional',4,'{"tone":5,"sustain":4,"stability":3}'::jsonb,true),
  ('body-bubinga','Bubinga','body',ARRAY['Bubinga Body Blank'],'mastery',6,'{"tone":7,"sustain":7,"stability":5,"stagePresence":2}'::jsonb,true),
  ('body-flamed-maple','Flamed Maple','body',ARRAY['Flamed Maple Body Blank'],'mastery',14,'{"tone":7,"sustain":5,"stability":5,"stagePresence":5}'::jsonb,true),
  ('neck-roasted-maple','Roasted Maple','neck',ARRAY['Roasted Maple Neck Blank'],'professional',3,'{"tone":3,"sustain":3,"stability":6}'::jsonb,true),
  ('neck-wenge','Wenge','neck',ARRAY['Wenge Neck Blank'],'mastery',5,'{"tone":5,"sustain":6,"stability":7}'::jsonb,true),
  ('fret-pau-ferro','Pau Ferro','fretboard',ARRAY['Pau Ferro Fretboard'],'basic',10,'{"tone":4,"sustain":3,"stability":3}'::jsonb,true),
  ('fret-richlite','Richlite Composite','fretboard',ARRAY['Richlite Fretboard'],'basic',14,'{"tone":2,"sustain":3,"stability":6}'::jsonb,true),
  ('fret-macassar','Macassar Ebony','fretboard',ARRAY['Macassar Ebony Fretboard'],'mastery',10,'{"tone":6,"sustain":6,"stability":7,"stagePresence":2}'::jsonb,true),
  ('elec-ceramic','Ceramic Humbucker','electronics',ARRAY['Ceramic Humbucker Set'],'basic',2,'{"tone":1,"output":5}'::jsonb,true),
  ('elec-p90-set','Dedicated P-90 Set','electronics',ARRAY['P-90 Pickup Set'],'basic',8,'{"tone":4,"output":3}'::jsonb,true),
  ('elec-bass-pj','P/J Bass Set','electronics',ARRAY['Bass P/J Pickup Set'],'basic',5,'{"tone":3,"output":4,"stability":1}'::jsonb,true),
  ('elec-noiseless','Noiseless Single Coils','electronics',ARRAY['Noiseless Single-Coil Set'],'professional',4,'{"tone":5,"output":4,"stability":2}'::jsonb,true),
  ('elec-mini-humbucker','Mini Humbucker','electronics',ARRAY['Mini Humbucker Set'],'professional',7,'{"tone":5,"output":5,"stagePresence":1}'::jsonb,true),
  ('elec-active-bass','Active Bass Preamp','electronics',ARRAY['Active Bass Preamp Set'],'professional',13,'{"tone":4,"output":9,"stability":2}'::jsonb,true),
  ('elec-piezo','Piezo Bridge System','electronics',ARRAY['Piezo Bridge Pickup System'],'mastery',8,'{"tone":8,"output":5,"stagePresence":3}'::jsonb,true),
  ('hw-brass','Brass Bridge & Nut','hardware',ARRAY['Brass Bridge and Nut Set'],'basic',6,'{"tone":2,"sustain":5,"stability":2}'::jsonb,true),
  ('hw-aluminium','Lightweight Aluminium','hardware',ARRAY['Lightweight Aluminum Hardware Set'],'basic',10,'{"sustain":1,"stability":3,"stagePresence":2}'::jsonb,true),
  ('hw-stainless','Stainless Steel Hardware','hardware',ARRAY['Stainless Hardware Set'],'professional',4,'{"sustain":4,"stability":6}'::jsonb,true),
  ('hw-black-chrome','Black Chrome Hardware','hardware',ARRAY['Black Chrome Hardware Set'],'professional',8,'{"sustain":3,"stability":5,"stagePresence":5}'::jsonb,true),
  ('hw-titanium','Titanium Hardware','hardware',ARRAY['Titanium Hardware Set'],'mastery',12,'{"sustain":6,"stability":8,"stagePresence":6}'::jsonb,true),
  ('finish-tru-oil','Tru-Oil','finish',ARRAY['Tru-Oil Finish'],'basic',2,'{"tone":1,"sustain":1}'::jsonb,true),
  ('finish-poly','Polyurethane Gloss','finish',ARRAY['Polyurethane Gloss Finish'],'basic',6,'{"stability":2,"stagePresence":2}'::jsonb,true),
  ('finish-relic','Relic / Aged','finish',ARRAY['Relic Finish'],'professional',3,'{"stagePresence":5}'::jsonb,true),
  ('finish-candy','Candy Colour','finish',ARRAY['Candy Colour Finish'],'professional',6,'{"stagePresence":6}'::jsonb,true),
  ('finish-pearl','Pearlescent','finish',ARRAY['Pearlescent Finish'],'professional',14,'{"stagePresence":9}'::jsonb,true),
  ('finish-holographic','Holographic','finish',ARRAY['Holographic Finish'],'mastery',14,'{"stagePresence":12}'::jsonb,true)
ON CONFLICT (id) DO UPDATE SET
  label=EXCLUDED.label,
  slot=EXCLUDED.slot,
  catalog_names=EXCLUDED.catalog_names,
  required_tier=EXCLUDED.required_tier,
  required_level=EXCLUDED.required_level,
  traits=EXCLUDED.traits,
  is_active=EXCLUDED.is_active;
