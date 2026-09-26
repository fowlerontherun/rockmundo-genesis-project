-- Finalise simplified annual Festivals only after the last scheduled local day.
-- run_simplified_festival_edition currently transitions directly to completed, emits
-- a completion digest, and posts financial settlement in one transaction. Keeping
-- its readiness guard closed while an edition is still running prevents premature
-- final results and duplicate-looking public lifecycle states.
--
-- Preserve the existing readiness implementation across baseline/reconciliation
-- variants, including artist and licence checks, by adding a single guard at its
-- last return rather than replacing the full function.
DO $migration$
DECLARE
  definition text;
  return_anchor constant text := '  RETURN result || jsonb_build_object(';
  end_date_guard constant text := $guard$
  -- Dates are interpreted in the Festival city's timezone, not the database
  -- server's timezone. The final results run opens on the following local day.
  IF edition.ends_on IS NOT NULL
     AND (now() AT TIME ZONE coalesce(
       (SELECT nullif(city.timezone, '')
        FROM public.cities city
        WHERE city.id = edition.city_id),
       'UTC'
     ))::date <= edition.ends_on
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(blockers) blocker
       WHERE blocker->>'code' = 'festival_final_results_not_due'
     ) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_final_results_not_due',
      'message', 'Final Festival simulation and financial results are available after the Festival''s final scheduled day.'
    ));
  END IF;

$guard$;
BEGIN
  SELECT pg_get_functiondef(
    'public._simplified_festival_run_readiness(uuid,uuid)'::regprocedure
  ) INTO definition;

  IF definition IS NULL THEN
    RAISE EXCEPTION 'festival_readiness_function_missing';
  END IF;

  IF position('festival_final_results_not_due' IN definition) > 0 THEN
    RETURN;
  END IF;

  IF position(return_anchor IN definition) = 0 THEN
    RAISE EXCEPTION 'festival_readiness_return_anchor_changed';
  END IF;

  definition := replace(definition, return_anchor, end_date_guard || return_anchor);
  EXECUTE definition;
END;
$migration$;

-- Retain the existing private helper grants. No new client-facing mutation API.
REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._simplified_festival_run_readiness(uuid,uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
