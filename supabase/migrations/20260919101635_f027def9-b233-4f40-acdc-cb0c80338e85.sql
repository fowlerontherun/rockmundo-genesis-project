CREATE TABLE IF NOT EXISTS public.totp_render_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  manifest_checksum text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','rendering','succeeded','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  qc jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  requested_by uuid,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_render_jobs_episode_idx ON public.totp_render_jobs (episode_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS totp_render_jobs_active_idx ON public.totp_render_jobs (episode_id) WHERE state IN ('queued','rendering');

GRANT SELECT ON public.totp_render_jobs TO authenticated;
GRANT ALL ON public.totp_render_jobs TO service_role;

ALTER TABLE public.totp_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view render jobs" ON public.totp_render_jobs;
CREATE POLICY "Admins can view render jobs"
  ON public.totp_render_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.totp_touch_render_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_render_jobs_touch ON public.totp_render_jobs;
CREATE TRIGGER totp_render_jobs_touch BEFORE UPDATE ON public.totp_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.totp_touch_render_job();

CREATE OR REPLACE FUNCTION public.totp_admin_enqueue_render(
  p_episode_id uuid,
  p_manifest_checksum text,
  p_plan jsonb DEFAULT '{}'::jsonb
)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
  v_stored text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can queue episode renders';
  END IF;

  SELECT checksum INTO v_stored
  FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id;

  IF v_stored IS NULL THEN
    RAISE EXCEPTION 'Save the episode running sheet before queueing a render';
  END IF;

  IF v_stored <> p_manifest_checksum THEN
    RAISE EXCEPTION 'The running sheet has changed since this render was requested';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_render_jobs
    WHERE episode_id = p_episode_id AND state IN ('queued','rendering')
  ) THEN
    RAISE EXCEPTION 'A render is already in progress for this episode';
  END IF;

  INSERT INTO public.totp_render_jobs (episode_id, manifest_checksum, plan, requested_by)
  VALUES (p_episode_id, p_manifest_checksum, COALESCE(p_plan, '{}'::jsonb), auth.uid())
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_cancel_render(p_job_id uuid)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can cancel episode renders';
  END IF;

  UPDATE public.totp_render_jobs
  SET state = 'cancelled', finished_at = now()
  WHERE id = p_job_id AND state IN ('queued','rendering')
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'That render job is no longer running';
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_claim_render_job()
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  UPDATE public.totp_render_jobs
  SET state = 'rendering', attempts = attempts + 1, claimed_at = now()
  WHERE id = (
    SELECT id FROM public.totp_render_jobs
    WHERE state = 'queued'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_complete_render_job(
  p_job_id uuid,
  p_artifacts jsonb,
  p_qc jsonb
)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
  v_passed boolean := COALESCE((p_qc->>'passed')::boolean, false);
BEGIN
  UPDATE public.totp_render_jobs
  SET state = CASE WHEN v_passed THEN 'succeeded' ELSE 'failed' END,
      artifacts = COALESCE(p_artifacts, '[]'::jsonb),
      qc = COALESCE(p_qc, '{}'::jsonb),
      error_message = CASE WHEN v_passed THEN NULL ELSE 'Quality control checks failed' END,
      finished_at = now()
  WHERE id = p_job_id AND state = 'rendering'
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'That render job is not currently rendering';
  END IF;

  IF v_passed THEN
    UPDATE public.totp_episode_manifests
    SET production_state = 'rendered_master'
    WHERE episode_id = v_job.episode_id
      AND checksum = v_job.manifest_checksum
      AND production_state IN ('gameplay','production_ready');
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_fail_render_job(p_job_id uuid, p_error text)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  UPDATE public.totp_render_jobs
  SET state = 'failed', error_message = COALESCE(NULLIF(TRIM(p_error), ''), 'Render failed'), finished_at = now()
  WHERE id = p_job_id AND state IN ('queued','rendering')
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'That render job is no longer running';
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_episode_render_jobs(p_episode_id uuid DEFAULT NULL)
RETURNS SETOF public.totp_render_jobs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.*
  FROM public.totp_render_jobs j
  WHERE public.has_role(auth.uid(), 'admin')
    AND (p_episode_id IS NULL OR j.episode_id = p_episode_id)
  ORDER BY j.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_enqueue_render(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_admin_cancel_render(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_claim_render_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_fail_render_job(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_episode_render_jobs(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.totp_admin_enqueue_render(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.totp_admin_cancel_render(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.totp_episode_render_jobs(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.totp_claim_render_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_fail_render_job(uuid, text) TO service_role;