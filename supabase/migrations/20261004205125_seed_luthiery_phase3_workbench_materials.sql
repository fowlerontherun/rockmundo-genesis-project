-- Ensure every material exposed by the Phase 3 Luthiery workbench exists in
-- the canonical crafting catalogue. Existing production rows win; this seed is
-- intentionally idempotent and does not rewrite prices or rarity.
WITH seed(name, category, rarity, quality_tier, base_cost, description) AS (
  VALUES
    ('Pine Body Blank','wood','common',1,6000,'Soft, lightweight tonewood suited to beginner builds.'),
    ('Poplar Body Blank','wood','common',1,7000,'Neutral, easy-working body wood.'),
    ('Ash Body Blank','wood','uncommon',2,15000,'Bright, resonant body wood with pronounced grain.'),
    ('Korina Body Blank','wood','epic',4,45000,'Rare tonewood with a distinctive resonant character.'),
    ('Brazilian Rosewood Set','wood','legendary',5,120000,'Extremely rare premium fretboard and decorative rosewood stock.'),
    ('Alnico V Pickup','electronics','uncommon',2,22000,'Alnico V pickup set with strong output and clarity.'),
    ('PAF Clone Pickup','electronics','rare',3,30000,'Vintage-voiced humbucker set inspired by classic PAF tone.'),
    ('Hand-Wound Boutique Pickup','electronics','epic',4,48000,'Hand-wound premium pickup set with artisan voicing.'),
    ('Locking Tuners Set','hardware','uncommon',2,12000,'Locking machine heads for improved tuning stability.'),
    ('Tune-O-Matic Bridge','hardware','common',1,7500,'Adjustable fixed bridge for precise intonation.'),
    ('Tremolo Bridge','hardware','uncommon',2,15000,'Vibrato bridge for expressive pitch bends.'),
    ('Floyd Rose Tremolo','hardware','rare',3,30000,'Double-locking tremolo system for extreme pitch effects.'),
    ('Gold Hardware Set','hardware','epic',4,42000,'Premium gold-plated bridge, tuners and fittings.'),
    ('Satin Lacquer','finish','common',1,5000,'Smooth matte protective instrument finish.'),
    ('Gloss Nitrocellulose','finish','uncommon',2,12000,'Classic high-gloss nitrocellulose finish.'),
    ('Burst Sunburst Finish','finish','rare',3,22000,'Layered sunburst finish with dark edge shading.'),
    ('Metallic Flake Finish','finish','rare',3,26000,'Stage-focused metallic flake finish.'),
    ('Custom Artwork Finish','finish','epic',4,55000,'Premium custom-artwork finish suitable for decals and hand-painted designs.')
)
INSERT INTO public.crafting_materials (name, category, rarity, quality_tier, base_cost, description)
SELECT seed.name, seed.category, seed.rarity, seed.quality_tier, seed.base_cost, seed.description
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crafting_materials existing
  WHERE lower(existing.name) = lower(seed.name)
);
