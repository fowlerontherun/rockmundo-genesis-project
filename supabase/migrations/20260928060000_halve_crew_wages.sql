-- Reduce per-gig crew payroll by 50% without rewriting the books of
-- completed gigs. A persisted version marker makes the data adjustment safe
-- if the same file is replayed through a second migration pipeline.
CREATE TABLE IF NOT EXISTS public.crew_wage_balance_history (
  balance_version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  catalog_rows integer NOT NULL,
  hired_rows integer NOT NULL,
  open_assignment_rows integer NOT NULL,
  catalog_salary_before bigint NOT NULL,
  catalog_salary_after bigint NOT NULL,
  hired_salary_before bigint NOT NULL,
  hired_salary_after bigint NOT NULL
);

ALTER TABLE public.crew_wage_balance_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crew_wage_balance_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crew_wage_balance_history TO service_role;

DO $crew_wages$
DECLARE
  v_catalog_before bigint;
  v_catalog_after bigint;
  v_hired_before bigint;
  v_hired_after bigint;
  v_catalog_count integer;
  v_hired_count integer;
  v_assignment_count integer;
BEGIN
  -- Lock this single-version adjustment so competing migration runners
  -- cannot apply the same 50% cut twice.
  PERFORM pg_advisory_xact_lock(hashtext('crew_wages_2026_half'));
  IF EXISTS (
    SELECT 1 FROM public.crew_wage_balance_history
    WHERE balance_version = '2026-09-half-crew-wages'
  ) THEN
    RAISE NOTICE 'Crew wages were already halved; skipping repeat migration';
    RETURN;
  END IF;

  SELECT coalesce(sum(salary),0) INTO v_catalog_before FROM public.crew_catalog;
  SELECT coalesce(sum(salary_per_gig),0) INTO v_hired_before
    FROM public.band_crew_members;

  -- Future hires read crew_catalog.salary through hire_band_crew; existing
  -- employees use band_crew_members.salary_per_gig.
  -- Whole-dollar wages are rounded to the nearest dollar (half up).
  UPDATE public.crew_catalog
  SET salary = round(salary::numeric / 2)::integer,
      updated_at = now();
  GET DIAGNOSTICS v_catalog_count = ROW_COUNT;

  UPDATE public.band_crew_members
  SET salary_per_gig = round(salary_per_gig::numeric / 2)::integer;
  GET DIAGNOSTICS v_hired_count = ROW_COUNT;

  -- Existing open or running assignments must show the new salary before
  -- the show is settled. For hired workers, trust the contract, not an old
  -- client-supplied cost. Preserve completed, cancelled and failed shows.
  UPDATE public.gig_crew_assignments a
  SET cost = coalesce(
        (SELECT c.salary_per_gig
         FROM public.band_crew_members c
         WHERE c.id = a.band_crew_member_id),
        round(a.cost::numeric / 2)::integer
      ),
      updated_at = now()
  WHERE EXISTS (
    SELECT 1 FROM public.gigs g
    WHERE g.id = a.gig_id
      AND g.status NOT IN ('completed', 'cancelled', 'failed')
      AND NOT EXISTS (
        SELECT 1 FROM public.gig_outcomes o
        WHERE o.gig_id = g.id AND o.completed_at IS NOT NULL
      )
  );
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  SELECT coalesce(sum(salary),0) INTO v_catalog_after FROM public.crew_catalog;
  SELECT coalesce(sum(salary_per_gig),0) INTO v_hired_after
    FROM public.band_crew_members;

  INSERT INTO public.crew_wage_balance_history (
    balance_version, catalog_rows, hired_rows, open_assignment_rows,
    catalog_salary_before, catalog_salary_after,
    hired_salary_before, hired_salary_after
  ) VALUES (
    '2026-09-half-crew-wages',
    v_catalog_count, v_hired_count, v_assignment_count,
    v_catalog_before, v_catalog_after,
    v_hired_before, v_hired_after
  );
END;
$crew_wages$;
