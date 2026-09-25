-- Run against a migrated database with psql -X -v ON_ERROR_STOP=1.
-- The optional genuine-gig integration fixture is always rolled back.
BEGIN;

DO $check$
DECLARE
  v_gig uuid;
  v_member uuid;
  v_salary integer;
  v_role text;
  v_before integer;
  v_after integer;
  v_first jsonb;
  v_repeat jsonb;
BEGIN
  IF to_regprocedure('public.reconcile_unsettled_completed_gig_crew(integer)') IS NULL THEN
    RAISE EXCEPTION 'Crew reconciliation RPC missing';
  END IF;
  IF has_function_privilege('authenticated',
    'public.reconcile_unsettled_completed_gig_crew(integer)', 'EXECUTE')
    OR has_function_privilege('anon',
    'public.reconcile_unsettled_completed_gig_crew(integer)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Crew repair RPC must be service-role only';
  END IF;

  -- Do not invent attendance for historical gigs with no crew assignments.
  -- An eligible real fixture exercises the same ledger as live gig completion.
  SELECT g.id, c.id, c.salary_per_gig, public.crew_role_key(c.crew_type::text)
    INTO v_gig,v_member,v_salary,v_role
    FROM public.gigs g
    JOIN public.band_crew_members c ON c.band_id = g.band_id
    JOIN public.gig_outcomes o ON o.gig_id = g.id
      AND o.completed_at IS NOT NULL
    WHERE g.status = 'completed'
      AND c.hire_date <= coalesce(g.started_at,g.scheduled_date)
      AND NOT EXISTS (
        SELECT 1 FROM public.gig_crew_assignments a WHERE a.gig_id=g.id
      )
    ORDER BY g.completed_at DESC NULLS LAST
    LIMIT 1;
  IF v_gig IS NULL THEN
    RAISE NOTICE 'Skipping crew settlement fixture: no genuine completed gig and eligible employee found';
    RETURN;
  END IF;

  SELECT career_xp INTO v_before
    FROM public.band_crew_members WHERE id=v_member;
  INSERT INTO public.gig_crew_assignments
    (gig_id,crew_role,worker_type,npc_staff_id,band_crew_member_id,assignment_status,cost)
    VALUES(v_gig,v_role,'npc_staff',v_member,v_member,'accepted',v_salary);

  SELECT public.reconcile_unsettled_completed_gig_crew(50) INTO v_first;
  SELECT public.reconcile_unsettled_completed_gig_crew(50) INTO v_repeat;
  SELECT career_xp INTO v_after FROM public.band_crew_members WHERE id=v_member;

  IF coalesce((v_first->>'crewRewarded')::integer,0) <> 1
    OR coalesce((v_repeat->>'crewRewarded')::integer,0) <> 0
    OR v_after <= v_before
    OR (SELECT count(*) FROM public.gig_crew_settlements
        WHERE gig_id=v_gig AND crew_member_id=v_member
          AND salary_paid=v_salary AND xp_awarded>0) <> 1
  THEN
    RAISE EXCEPTION 'Recovery must award exactly once: first %, second %, XP % → %',
      v_first,v_repeat,v_before,v_after;
  END IF;
END $check$;

-- Preparation payroll is the sum of attending employees' contract amounts,
-- and withdrawing attendance must remove that gig's salary.
DO $payroll$
DECLARE
  v_gig uuid;
  v_crew uuid;
  v_role text;
  v_wage integer;
  v_total integer;
  v_expected integer;
BEGIN
  SELECT g.id,c.id,public.crew_role_key(c.crew_type::text),c.salary_per_gig
    INTO v_gig,v_crew,v_role,v_wage
    FROM public.gigs g
    JOIN public.band_crew_members c ON c.band_id=g.band_id
    WHERE g.status IN ('scheduled','confirmed')
      AND NOT EXISTS(SELECT 1 FROM public.gig_crew_assignments a WHERE a.gig_id=g.id)
    ORDER BY g.scheduled_date LIMIT 1;
  IF v_gig IS NULL THEN
    RAISE NOTICE 'Skipping scheduled gig payroll fixture: none available';
    RETURN;
  END IF;
  INSERT INTO public.gig_crew_assignments
    (gig_id,crew_role,worker_type,npc_staff_id,band_crew_member_id,assignment_status,cost)
  VALUES(v_gig,v_role,'npc_staff',v_crew,v_crew,'accepted',v_wage);
  SELECT (public.process_gig_preparation_costs_and_rewards(v_gig)->>'crew_costs')::integer
    INTO v_total;
  SELECT coalesce(sum(cost),0)::integer INTO v_expected
    FROM public.gig_crew_assignments WHERE gig_id=v_gig AND assignment_status='accepted';
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'Crew cost mismatch for accepted workers: actual % expected %',v_total,v_expected;
  END IF;
  UPDATE public.gig_crew_assignments
    SET assignment_status='declined'
    WHERE gig_id=v_gig AND band_crew_member_id=v_crew;
  SELECT (public.process_gig_preparation_costs_and_rewards(v_gig)->>'crew_costs')::integer
    INTO v_total;
  SELECT coalesce(sum(cost),0)::integer INTO v_expected
    FROM public.gig_crew_assignments WHERE gig_id=v_gig AND assignment_status='accepted';
  IF v_total <> v_expected THEN
    RAISE EXCEPTION 'Declined crew must not receive gig wages: actual % expected %',v_total,v_expected;
  END IF;
END $payroll$;

SELECT 'Crew reconciliation permissions and recovery passed' AS result;
ROLLBACK;
