ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS completion_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_last_error text,
  ADD COLUMN IF NOT EXISTS completion_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_needs_attention boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gig_completion_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gig_completion_attempts TO authenticated;
GRANT ALL ON public.gig_completion_attempts TO service_role;

ALTER TABLE public.gig_completion_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read gig completion attempts" ON public.gig_completion_attempts;
CREATE POLICY "Authenticated users can read gig completion attempts"
  ON public.gig_completion_attempts FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_gig_completion_attempts_gig ON public.gig_completion_attempts(gig_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gigs_completion_retry ON public.gigs(completion_next_retry_at) WHERE status <> 'completed';

CREATE OR REPLACE FUNCTION public.set_updated_at_gig_completion_attempts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_gig_completion_attempts_updated_at ON public.gig_completion_attempts;
CREATE TRIGGER trg_gig_completion_attempts_updated_at
  BEFORE UPDATE ON public.gig_completion_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_gig_completion_attempts();

-- Claim a completion retry for a gig, honouring cooldown + attempt cap + idempotency key.
CREATE OR REPLACE FUNCTION public.claim_gig_completion_attempt(
  p_gig_id uuid,
  p_idempotency_key text,
  p_max_attempts integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.gigs%ROWTYPE;
  existing public.gig_completion_attempts%ROWTYPE;
  v_attempt public.gig_completion_attempts%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;

  SELECT * INTO existing FROM public.gig_completion_attempts WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'duplicate_idempotency_key',
      'attemptId', existing.id,
      'attemptNumber', existing.attempt_number,
      'status', existing.status
    );
  END IF;

  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;

  IF g.status = 'completed' AND g.result_ready_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_completed');
  END IF;

  IF g.status IN ('cancelled') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'terminal_status');
  END IF;

  IF g.completion_needs_attention THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'needs_attention');
  END IF;

  IF g.completion_next_retry_at IS NOT NULL AND g.completion_next_retry_at > now() THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'cooldown',
      'retryAt', g.completion_next_retry_at
    );
  END IF;

  IF g.completion_attempt_count >= p_max_attempts THEN
    UPDATE public.gigs
       SET completion_needs_attention = true, updated_at = now()
     WHERE id = p_gig_id;
    RETURN jsonb_build_object('claimed', false, 'reason', 'attempts_exhausted');
  END IF;

  INSERT INTO public.gig_completion_attempts (gig_id, idempotency_key, attempt_number, status)
  VALUES (p_gig_id, p_idempotency_key, g.completion_attempt_count + 1, 'processing')
  RETURNING * INTO v_attempt;

  UPDATE public.gigs
     SET completion_attempt_count = g.completion_attempt_count + 1,
         completion_last_attempt_at = now(),
         completion_next_retry_at = now() + interval '10 minutes',
         completion_claimed_at = NULL,
         updated_at = now()
   WHERE id = p_gig_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'attemptId', v_attempt.id,
    'attemptNumber', v_attempt.attempt_number
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('claimed', false, 'reason', 'duplicate_idempotency_key');
END; $$;

-- Record the outcome of a claimed attempt and schedule the next retry with backoff.
CREATE OR REPLACE FUNCTION public.record_gig_completion_attempt(
  p_attempt_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL,
  p_max_attempts integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.gig_completion_attempts%ROWTYPE;
  v_delay interval;
  v_exhausted boolean := false;
BEGIN
  SELECT * INTO a FROM public.gig_completion_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found'; END IF;

  IF a.status <> 'processing' THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already_recorded', 'status', a.status);
  END IF;

  UPDATE public.gig_completion_attempts
     SET status = CASE WHEN p_success THEN 'succeeded' ELSE 'failed' END,
         error_message = CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error, 'unknown_error'), 2000) END,
         finished_at = now()
   WHERE id = p_attempt_id;

  IF p_success THEN
    UPDATE public.gigs
       SET completion_next_retry_at = NULL,
           completion_last_error = NULL,
           completion_needs_attention = false,
           updated_at = now()
     WHERE id = a.gig_id;
    RETURN jsonb_build_object('recorded', true, 'success', true);
  END IF;

  v_delay := CASE a.attempt_number
    WHEN 1 THEN interval '2 minutes'
    WHEN 2 THEN interval '5 minutes'
    WHEN 3 THEN interval '15 minutes'
    WHEN 4 THEN interval '45 minutes'
    ELSE interval '2 hours'
  END;

  v_exhausted := a.attempt_number >= p_max_attempts;

  UPDATE public.gigs
     SET completion_last_error = left(coalesce(p_error, 'unknown_error'), 2000),
         completion_next_retry_at = CASE WHEN v_exhausted THEN NULL ELSE now() + v_delay END,
         completion_needs_attention = v_exhausted,
         completion_claimed_at = NULL,
         updated_at = now()
   WHERE id = a.gig_id;

  RETURN jsonb_build_object(
    'recorded', true,
    'success', false,
    'exhausted', v_exhausted,
    'retryAt', CASE WHEN v_exhausted THEN NULL ELSE now() + v_delay END
  );
END; $$;

-- Gigs whose completion is overdue and eligible for a retry right now.
CREATE OR REPLACE FUNCTION public.list_gig_completion_retry_candidates(
  p_limit integer DEFAULT 25,
  p_overdue_minutes integer DEFAULT 10,
  p_max_attempts integer DEFAULT 6
)
RETURNS TABLE (
  gig_id uuid,
  status text,
  started_at timestamptz,
  scheduled_date timestamptz,
  attempt_count integer,
  last_error text,
  next_retry_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.status::text, g.started_at, g.scheduled_date,
         g.completion_attempt_count, g.completion_last_error, g.completion_next_retry_at
  FROM public.gigs g
  WHERE g.status IN ('in_progress', 'ready_for_completion', 'processing_outcome', 'failed')
    AND g.completion_needs_attention = false
    AND g.completion_attempt_count < p_max_attempts
    AND (g.completion_next_retry_at IS NULL OR g.completion_next_retry_at <= now())
    AND coalesce(g.started_at, g.scheduled_date) < now() - make_interval(mins => p_overdue_minutes)
    AND g.result_ready_at IS NULL
  ORDER BY coalesce(g.started_at, g.scheduled_date) ASC
  LIMIT greatest(1, coalesce(p_limit, 25));
$$;

REVOKE ALL ON FUNCTION public.claim_gig_completion_attempt(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_gig_completion_attempt(uuid, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_completion_attempt(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_gig_completion_attempt(uuid, boolean, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_gig_completion_retry_candidates(integer, integer, integer) TO service_role, authenticated;