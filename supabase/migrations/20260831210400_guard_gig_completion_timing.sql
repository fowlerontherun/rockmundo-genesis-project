-- Prevent auto-completion retries from treating a live gig as overdue before its
-- setlist has actually finished. The retry selector and completion claim both
-- calculate the expected end independently so a bad caller cannot fast-forward
-- a performance.

CREATE OR REPLACE FUNCTION public.list_gig_completion_retry_candidates(
  p_limit integer DEFAULT 25,
  p_overdue_minutes integer DEFAULT 10,
  p_max_attempts integer DEFAULT 6
)
RETURNS TABLE(
  gig_id uuid,
  status text,
  started_at timestamp with time zone,
  scheduled_date timestamp with time zone,
  attempt_count integer,
  last_error text,
  next_retry_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    g.id,
    g.status::text,
    g.started_at,
    g.scheduled_date,
    g.completion_attempt_count,
    g.completion_last_error,
    g.completion_next_retry_at
  FROM public.gigs g
  LEFT JOIN LATERAL (
    SELECT sum(coalesce(s.duration_seconds, pic.duration_seconds, 180))::integer AS duration_seconds
    FROM public.setlist_songs ss
    LEFT JOIN public.songs s ON s.id = ss.song_id
    LEFT JOIN public.performance_items_catalog pic ON pic.id = ss.performance_item_id
    WHERE ss.setlist_id = g.setlist_id
  ) d ON true
  WHERE g.status IN ('in_progress', 'ready_for_completion', 'processing_outcome', 'failed')
    AND g.completion_needs_attention = false
    AND g.completion_attempt_count < p_max_attempts
    AND (g.completion_next_retry_at IS NULL OR g.completion_next_retry_at <= now())
    AND (
      CASE
        WHEN coalesce(d.duration_seconds, 0) > 0
          THEN coalesce(g.started_at, g.scheduled_date) + make_interval(secs => d.duration_seconds)
        WHEN g.scheduled_end IS NOT NULL
          THEN g.scheduled_end
        ELSE coalesce(g.started_at, g.scheduled_date) + interval '1 hour'
      END
    ) < now() - make_interval(mins => greatest(0, coalesce(p_overdue_minutes, 10)))
    AND g.result_ready_at IS NULL
  ORDER BY coalesce(g.started_at, g.scheduled_date) ASC
  LIMIT greatest(1, coalesce(p_limit, 25));
$function$;

CREATE OR REPLACE FUNCTION public.claim_gig_completion(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  g public.gigs%ROWTYPE;
  v_duration_seconds integer := 0;
  v_expected_end timestamptz;
BEGIN
  SELECT *
    INTO g
  FROM public.gigs
  WHERE id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_not_found';
  END IF;

  IF g.status = 'completed' AND g.result_ready_at IS NOT NULL THEN
    RETURN jsonb_build_object('alreadyCompleted', true, 'alreadyProcessing', false);
  END IF;

  IF g.status NOT IN ('in_progress', 'ready_for_completion', 'processing_outcome') THEN
    RAISE EXCEPTION 'gig_not_ready_for_completion:%', g.status;
  END IF;

  IF g.setlist_id IS NOT NULL THEN
    SELECT coalesce(sum(coalesce(s.duration_seconds, pic.duration_seconds, 180)), 0)::integer
      INTO v_duration_seconds
    FROM public.setlist_songs ss
    LEFT JOIN public.songs s ON s.id = ss.song_id
    LEFT JOIN public.performance_items_catalog pic ON pic.id = ss.performance_item_id
    WHERE ss.setlist_id = g.setlist_id;
  END IF;

  v_expected_end := CASE
    WHEN v_duration_seconds > 0
      THEN coalesce(g.started_at, g.scheduled_date) + make_interval(secs => v_duration_seconds)
    WHEN g.scheduled_end IS NOT NULL
      THEN g.scheduled_end
    ELSE coalesce(g.started_at, g.scheduled_date) + interval '1 hour'
  END;

  IF v_expected_end IS NULL THEN
    RAISE EXCEPTION 'gig_completion_time_unavailable';
  END IF;

  IF now() < v_expected_end THEN
    RAISE EXCEPTION 'gig_not_due_for_completion:%', v_expected_end;
  END IF;

  IF g.completion_claimed_at IS NOT NULL
     AND g.completion_claimed_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('alreadyCompleted', false, 'alreadyProcessing', true);
  END IF;

  UPDATE public.gigs
  SET completion_claimed_at = now(),
      updated_at = now()
  WHERE id = p_gig_id;

  INSERT INTO public.gig_post_processing (gig_id, status)
  VALUES (p_gig_id, 'processing');

  RETURN jsonb_build_object(
    'alreadyCompleted', false,
    'alreadyProcessing', false,
    'claimedAt', now(),
    'expectedEndAt', v_expected_end
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_gig_completion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_completion(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.claim_gig_completion(uuid) IS
  'Claims gig completion only after the actual setlist duration (or scheduled end fallback) has elapsed.';

COMMENT ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer) IS
  'Lists overdue gig completion retries only after the performance duration has elapsed plus the retry grace period.';
