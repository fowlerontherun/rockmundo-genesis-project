-- Repair public.start_songwriting_session RPC signature for the live frontend.
--
-- The authoritative implementation is the scheduling-aware RPC from
-- 20260713143000_authoritative_songwriting_scheduling.sql.  PostgREST matches RPCs
-- by the named argument set supplied by the client, and the current frontend calls
-- this RPC with exactly:
--   p_profile_id, p_project_id, p_effort_hours, p_idempotency_key
-- The scheduling-aware implementation also accepts p_session_type and p_activity_id,
-- so expose a four-argument compatibility signature that delegates to the
-- authoritative flow using the default balanced session type and no scheduled
-- activity handoff.

CREATE OR REPLACE FUNCTION public.start_songwriting_session(
  p_profile_id uuid,
  p_project_id uuid,
  p_effort_hours integer DEFAULT 1,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.start_songwriting_session(
    p_profile_id := p_profile_id,
    p_project_id := p_project_id,
    p_effort_hours := p_effort_hours,
    p_session_type := 'balanced',
    p_idempotency_key := p_idempotency_key,
    p_activity_id := NULL::uuid
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
