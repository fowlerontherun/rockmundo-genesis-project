-- 19 Oct 2026: prevent repeatedly failing BOTB settlements from
-- monopolising the 500-event hourly cycle and delaying healthy cities.
-- The failed event remains upcoming and retryable after a short backoff.
-- Only the queue selection changes; prize/XP/treasury logic stays intact.

DO $patch_botb_queue$
DECLARE
  v_old text;
  v_new text;
BEGIN
  v_old := pg_get_functiondef('public.run_botb_cycle()'::regprocedure);

  IF position('public.botb_resolution_failures' IN v_old)=0
     OR position('FOR UPDATE SKIP LOCKED' IN v_old)=0
  THEN
    RAISE EXCEPTION 'BOTB_QUEUE_RUNTIME_DRIFT: inspect resolver first';
  END IF;

  v_new := replace(v_old,
$old$  FOR v_event IN
    SELECT id FROM public.botb_events
    WHERE status='upcoming' AND scheduled_date<=now()
    ORDER BY scheduled_date ASC,id ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  LOOP$old$,
$new$  FOR v_event IN
    SELECT e.id
    FROM public.botb_events e
    LEFT JOIN public.botb_resolution_failures f
      ON f.event_id=e.id AND f.recovered_at IS NULL
    WHERE e.status='upcoming' AND e.scheduled_date<=now()
      -- Failed events are retried after 30 minutes rather than repeatedly
      -- occupying the batch on back-to-back manual/hourly invocations.
      AND (f.event_id IS NULL OR
           f.last_failed_at <= now()-interval '30 minutes')
    -- Fresh eligible events first: even hundreds of old failed attempts
    -- must not starve cities whose battles have not yet been tried.
    ORDER BY COALESCE(f.attempt_count,0) ASC,
             e.scheduled_date ASC,e.id ASC
    LIMIT 500
    FOR UPDATE OF e SKIP LOCKED
  LOOP$new$);

  IF v_new=v_old OR
     position('ORDER BY COALESCE(f.attempt_count,0) ASC' IN v_new)=0 THEN
    RAISE EXCEPTION 'BOTB_QUEUE_EXPECTED_PATCH_POINT_MISSING';
  END IF;

  EXECUTE v_new;
END;
$patch_botb_queue$;

REVOKE ALL ON FUNCTION public.run_botb_cycle()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role;
