-- #2158: expose stale completion claims for safe, explicit retry.
-- This does NOT claim that advanced consequences have been applied.
CREATE OR REPLACE FUNCTION public.reconcile_stale_gig_post_processing(
  p_min_age interval DEFAULT interval '30 minutes',
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT (SELECT coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF p_min_age < interval '5 minutes' OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid reconciliation parameters';
  END IF;

  WITH stale AS (
    SELECT p.id
    FROM public.gig_post_processing p
    JOIN public.gigs g ON g.id = p.gig_id
    WHERE p.status = 'processing'
      AND coalesce(p.started_at, p.updated_at, p.created_at) < now() - p_min_age
      AND g.status = 'completed'
      AND g.result_ready_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.gig_consequence_snapshots s
        WHERE s.processing_id = p.id
      )
    ORDER BY p.created_at, p.id
    LIMIT p_limit
    FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.gig_post_processing p
  SET status = 'retry_required',
      completed_at = NULL,
      error_snapshot = jsonb_build_object(
        'reason', 'stale_processing_without_snapshots',
        'reconciled_at', now(),
        'note', 'Advanced consequences have not been verified or applied'
      ),
      audit_history = coalesce(p.audit_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('event', 'stale_processing_reconciled', 'at', now(), 'previous_status', p.status)
      ),
      updated_at = now()
  FROM stale
  WHERE p.id = stale.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_stale_gig_post_processing(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_gig_post_processing(interval, integer) TO service_role;
