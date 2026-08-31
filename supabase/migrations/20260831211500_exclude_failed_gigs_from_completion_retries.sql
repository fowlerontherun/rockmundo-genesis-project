-- Failed gigs are terminal for complete-gig and must not consume automatic
-- completion retry attempts. Keep retries limited to recoverable completion states.

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
  WHERE g.status IN ('in_progress', 'ready_for_completion', 'processing_outcome')
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

REVOKE ALL ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer) IS
  'Lists overdue non-terminal gig completion retries only after the performance duration has elapsed plus the retry grace period; failed gigs require explicit recovery/admin action.';
