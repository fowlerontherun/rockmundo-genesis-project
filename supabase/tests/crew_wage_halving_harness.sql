-- Non-destructive release check; run after the September 2026 wage balance.
-- The dry-run integration check additionally snapshots every catalog entry,
-- hired contract and historic outcome before executing the migration in a
-- rolled-back transaction, then replays it to verify no second reduction.
BEGIN;

DO $checks$
DECLARE v public.crew_wage_balance_history%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.crew_wage_balance_history
  WHERE balance_version='2026-09-half-crew-wages';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The 50%% crew wage balance migration is not deployed';
  END IF;

  IF v.catalog_salary_after > v.catalog_salary_before
    OR v.hired_salary_after > v.hired_salary_before
    OR v.catalog_salary_after < v.catalog_salary_before/2
    OR v.hired_salary_after < v.hired_salary_before/2
    OR v.catalog_salary_after > (v.catalog_salary_before+v.catalog_rows)/2
    OR v.hired_salary_after > (v.hired_salary_before+v.hired_rows)/2
  THEN
    RAISE EXCEPTION 'Saved payroll totals do not describe a 50%% cut';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.band_crew_members c
    JOIN public.crew_catalog cat ON cat.id=c.catalog_crew_id
    WHERE c.salary_per_gig IS DISTINCT FROM cat.salary
  ) THEN
    RAISE EXCEPTION 'Existing staff salaries differ from their hire catalog';
  END IF;

  IF has_table_privilege('authenticated','public.crew_wage_balance_history','SELECT')
    OR has_table_privilege('authenticated','public.crew_wage_balance_history','UPDATE')
  THEN
    RAISE EXCEPTION 'Internal economy balance ledger exposed to regular players';
  END IF;
END $checks$;

SELECT 'Crew wages halved, catalog and contracts aligned, balance history secure' AS result;
ROLLBACK;
