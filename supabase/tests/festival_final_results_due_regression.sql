-- Safe smoke checks for the final-result date guard. The SQL migration is
-- installed by the normal migration runner before this test. No fixtures or
-- destructive production actions are used.
DO $test$
DECLARE
  readiness_definition text;
  history_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public._simplified_festival_run_readiness(uuid,uuid)'::regprocedure
  ) INTO readiness_definition;
  IF readiness_definition NOT LIKE '%festival_final_results_not_due%' THEN
    RAISE EXCEPTION 'Final-results readiness guard is missing';
  END IF;
  SELECT pg_get_functiondef(
    'public.get_public_festival_edition_history(uuid)'::regprocedure
  ) INTO history_definition;
  IF history_definition NOT LIKE '%v_edition.ends_on IS NOT NULL%' THEN
    RAISE EXCEPTION 'Public-history end-date guard is missing';
  END IF;

  -- Shock is a UK Festival in British Summer Time. Even 22:59 UTC on the
  -- final day is still that day locally, so finalisation must remain blocked.
  IF (timestamptz '2026-09-27 22:59:00+00'
      AT TIME ZONE 'Europe/London')::date <> date '2026-09-27' THEN
    RAISE EXCEPTION 'Festival-local final-day conversion failed';
  END IF;

  -- The next instant is 00:00 local on September 28, at which point the
  -- final-result guard permits a properly authorised and ready edition.
  IF (timestamptz '2026-09-27 23:00:00+00'
      AT TIME ZONE 'Europe/London')::date <> date '2026-09-28' THEN
    RAISE EXCEPTION 'Festival-local next-day conversion failed';
  END IF;
END;
$test$;
