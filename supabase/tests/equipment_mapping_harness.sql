\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.equipment_catalog
    WHERE category='instrument' AND subcategory='guitar'
  ) THEN
    RAISE EXCEPTION 'generic instrument/guitar catalogue rows remain';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_catalog
    WHERE category='instrument'
      AND lower(coalesce(description,'')) LIKE '%classical%'
      AND subcategory='acoustic_guitar'
  ) THEN
    RAISE EXCEPTION 'classical guitar remains mapped as acoustic guitar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_catalog
    WHERE category='recording'
      AND subcategory IN ('microphone','dynamic_mic','condenser_mic','ribbon_mic','tube_mic')
      AND (
        lower(coalesce(name,'')) LIKE '%scarlett%'
        OR lower(coalesce(name,'')) LIKE '%audiobox%'
        OR lower(coalesce(description,'')) LIKE '%audio interface%'
        OR lower(coalesce(description,'')) LIKE '%recording interface%'
      )
  ) THEN
    RAISE EXCEPTION 'audio interface remains mapped as a microphone';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_items
    WHERE skill_boost_slug LIKE 'instruments%acoustic_guitar'
      AND subcategory <> 'acoustic_guitar'
  ) THEN
    RAISE EXCEPTION 'legacy acoustic guitar equipment does not use acoustic_guitar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_items
    WHERE skill_boost_slug LIKE 'instruments%electric_guitar'
      AND subcategory <> 'electric_guitar'
  ) THEN
    RAISE EXCEPTION 'legacy electric guitar equipment does not use electric_guitar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_items
    WHERE skill_boost_slug LIKE 'instruments%bass_guitar'
      AND subcategory <> 'bass_guitar'
  ) THEN
    RAISE EXCEPTION 'legacy bass equipment does not use bass_guitar';
  END IF;
END
$$;

SELECT category, subcategory, count(*) AS item_count
FROM public.equipment_catalog
GROUP BY category, subcategory
ORDER BY category, subcategory;
