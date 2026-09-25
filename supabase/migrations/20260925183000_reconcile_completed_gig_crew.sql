-- Repair crew progression only when a completed gig has a recorded, accepted
-- named employee assignment but its individual reward ledger is incomplete.
-- Do not infer historical attendance from current roster membership.
CREATE OR REPLACE FUNCTION public.reconcile_unsettled_completed_gig_crew(
  p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_gig_id uuid;
  v_checked integer := 0;
  v_rewarded integer := 0;
  v_failed integer := 0;
  v_added integer;
BEGIN
  FOR v_gig_id IN
    SELECT g.id
    FROM public.gigs g
    JOIN public.gig_outcomes o ON o.gig_id = g.id
      AND o.completed_at IS NOT NULL
    WHERE g.status = 'completed'
      AND EXISTS (
        SELECT 1
        FROM public.gig_crew_assignments a
        JOIN public.band_crew_members c ON c.id = a.band_crew_member_id
          AND c.band_id = g.band_id
        WHERE a.gig_id = g.id
          AND a.assignment_status = 'accepted'
          AND c.hire_date <= coalesce(g.started_at, g.scheduled_date)
          AND NOT EXISTS (
            SELECT 1 FROM public.gig_crew_settlements s
            WHERE s.gig_id = g.id AND s.crew_member_id = c.id
          )
      )
    ORDER BY g.completed_at ASC NULLS LAST, g.id
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 100)
  LOOP
    v_checked := v_checked + 1;
    BEGIN
      -- The original settle function locks the worker row and writes a unique
      -- (gig, crew member) ledger entry before increasing XP or cohesion.
      v_added := public._settle_completed_gig_crew(v_gig_id);
      v_rewarded := v_rewarded + coalesce(v_added, 0);
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'Crew reward repair failed for gig %: %', v_gig_id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object(
    'gigsChecked', v_checked,
    'crewRewarded', v_rewarded,
    'failures', v_failed
  );
END;
$$;

-- Only trusted background workers can invoke this repair. Managers cannot
-- manufacture a reward by calling the routine with another band's gig.
REVOKE ALL ON FUNCTION public.reconcile_unsettled_completed_gig_crew(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_unsettled_completed_gig_crew(integer)
  TO service_role;
