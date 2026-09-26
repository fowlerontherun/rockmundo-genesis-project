-- Never expose a simplified or rich annual recap while the published
-- edition dates are still underway. Historical early-settled editions, such as
-- Shock Festival 2026, remain internally inspectable without being replayed.
-- This patch preserves the existing public-history payload and its grants.
DO $migration$
DECLARE
  definition text;
  anchor constant text := '  SELECT * INTO v_simplified FROM public.festival_simplified_edition_results WHERE festival_edition_id=p_edition_id;';
  phase_guard constant text := $guard$
  -- v_edition was resolved and validated above. Public recap is available only
  -- after the last scheduled local date, independent of early result insertion.
  IF v_edition.ends_on IS NOT NULL
     AND (now() AT TIME ZONE coalesce(
       (SELECT nullif(city.timezone, '')
        FROM public.cities city WHERE city.id = v_edition.city_id),
       'UTC'
     ))::date <= v_edition.ends_on THEN
    RETURN NULL;
  END IF;

$guard$;
BEGIN
  SELECT pg_get_functiondef(
    'public.get_public_festival_edition_history(uuid)'::regprocedure
  ) INTO definition;

  IF definition IS NULL THEN
    RAISE EXCEPTION 'festival_public_history_function_missing';
  END IF;
  IF position('v_edition.ends_on IS NOT NULL' IN definition) > 0 THEN
    RETURN;
  END IF;
  IF position(anchor IN definition) = 0 THEN
    RAISE EXCEPTION 'festival_public_history_anchor_changed';
  END IF;

  EXECUTE replace(definition, anchor, phase_guard || anchor);
END;
$migration$;

NOTIFY pgrst, 'reload schema';
