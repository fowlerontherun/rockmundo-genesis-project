-- Canonicalise equipment subcategories so shop, role-fit, gig scoring and visuals
-- all resolve the same instrument family. This is deliberately idempotent.

-- Legacy generic "guitar" catalogue rows are all electric models.
UPDATE public.equipment_catalog
SET subcategory = 'electric_guitar',
    updated_at = now()
WHERE category = 'instrument'
  AND subcategory = 'guitar';

-- The live bass catalogue consists of bass guitars; use the canonical stage/skill id.
UPDATE public.equipment_catalog
SET subcategory = 'bass_guitar',
    updated_at = now()
WHERE category = 'instrument'
  AND subcategory = 'bass';

-- This Harley Benton model is a nylon-string classical guitar, not steel-string acoustic.
UPDATE public.equipment_catalog
SET subcategory = 'classical_guitar',
    updated_at = now()
WHERE category = 'instrument'
  AND brand = 'Harley Benton'
  AND name = 'Harley Benton CLA-15MCE'
  AND subcategory <> 'classical_guitar';

-- Normalise the two legacy condenser aliases.
UPDATE public.equipment_catalog
SET subcategory = 'condenser_mic',
    updated_at = now()
WHERE category = 'recording'
  AND subcategory = 'condenser';

-- Audio interfaces must never be treated as vocal microphones.
UPDATE public.equipment_catalog
SET subcategory = 'audio_interface',
    updated_at = now()
WHERE category = 'recording'
  AND (
    (brand = 'Focusrite' AND name = 'Focusrite Scarlett 2i2 4th Gen')
    OR (brand = 'PreSonus' AND name = 'PreSonus AudioBox USB 96')
  );

-- Resolve the remaining generic microphone rows to their actual microphone type.
UPDATE public.equipment_catalog
SET subcategory = 'condenser_mic',
    updated_at = now()
WHERE category = 'recording'
  AND subcategory = 'microphone'
  AND brand = 'Neumann'
  AND name = 'Neumann U87';

UPDATE public.equipment_catalog
SET subcategory = 'dynamic_mic',
    updated_at = now()
WHERE category = 'recording'
  AND subcategory = 'microphone'
  AND (
    (brand = 'Electro-Voice' AND name = 'Electro-Voice RE20')
    OR (brand = 'Sennheiser' AND name = 'Sennheiser e935')
    OR (brand = 'Shure' AND name IN ('Shure SM58', 'Shure SM7B', 'SM58'))
  );

-- These are controllers rather than self-contained keyboards.
UPDATE public.equipment_catalog
SET subcategory = 'midi_controller',
    updated_at = now()
WHERE category = 'instrument'
  AND (
    (brand = 'Arturia' AND name = 'Arturia KeyLab 61 MkII')
    OR (brand = 'Nektar' AND name = 'Nektar Impact LX88+')
  );

-- Montage is a synthesizer/workstation and should follow the synth role mapping.
UPDATE public.equipment_catalog
SET subcategory = 'synthesizer',
    updated_at = now()
WHERE category = 'instrument'
  AND brand = 'Yamaha'
  AND name = 'Yamaha Montage M8x';

-- Historical equipment_items used broad category/subcategory pairs. Keep them
-- compatible with the canonical skill ids when old saves or blind-box/crafted
-- items pass through the live scorer.
UPDATE public.equipment_items
SET subcategory = 'acoustic_guitar'
WHERE (
    category = 'guitar' AND subcategory IN ('acoustic', 'acoustic_guitar')
  )
  OR skill_boost_slug LIKE 'instruments%acoustic_guitar';

UPDATE public.equipment_items
SET subcategory = 'classical_guitar'
WHERE skill_boost_slug LIKE 'instruments%classical_guitar';

UPDATE public.equipment_items
SET subcategory = 'electric_guitar'
WHERE (
    category = 'guitar' AND subcategory IN ('electric', 'electric_guitar')
  )
  OR skill_boost_slug LIKE 'instruments%electric_guitar';

UPDATE public.equipment_items
SET subcategory = 'bass_guitar'
WHERE (
    category IN ('guitar', 'bass') AND subcategory IN ('bass', 'bass_guitar')
  )
  OR skill_boost_slug LIKE 'instruments%bass_guitar';

-- Migration guardrails for the specific catalogue errors repaired above.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.equipment_catalog
    WHERE category = 'instrument' AND subcategory = 'guitar'
  ) THEN
    RAISE EXCEPTION 'equipment mapping audit failed: generic instrument/guitar rows remain';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.equipment_catalog
    WHERE category = 'recording'
      AND subcategory IN ('microphone', 'dynamic_mic', 'condenser_mic', 'ribbon_mic', 'tube_mic')
      AND (
        lower(coalesce(name, '')) LIKE '%scarlett%'
        OR lower(coalesce(name, '')) LIKE '%audiobox%'
        OR lower(coalesce(description, '')) LIKE '%audio interface%'
        OR lower(coalesce(description, '')) LIKE '%recording interface%'
      )
  ) THEN
    RAISE EXCEPTION 'equipment mapping audit failed: audio interface still mapped as microphone';
  END IF;
END
$$;
