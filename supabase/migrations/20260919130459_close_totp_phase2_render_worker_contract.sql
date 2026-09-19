INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'totp-broadcast-masters',
  'totp-broadcast-masters',
  false,
  2147483648,
  ARRAY['video/mp4','image/jpeg','text/vtt','text/plain','application/json']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "TOTP admins can read broadcast masters" ON storage.objects;
CREATE POLICY "TOTP admins can read broadcast masters"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'totp-broadcast-masters'
  AND public.has_role((select auth.uid()), 'admin')
);

ALTER TABLE public.totp_render_jobs
  ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS probe jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline_sha256 text,
  ADD COLUMN IF NOT EXISTS master_sha256 text,
  ADD COLUMN IF NOT EXISTS input_sha256 text;

CREATE INDEX IF NOT EXISTS totp_render_jobs_worker_lease_idx
  ON public.totp_render_jobs (state, heartbeat_at, attempts);

CREATE OR REPLACE FUNCTION public.totp_claim_render_job_v2(p_worker_id text)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
  v_worker text := NULLIF(btrim(coalesce(p_worker_id, '')), '');
BEGIN
  IF v_worker IS NULL THEN
    RAISE EXCEPTION 'A render worker id is required';
  END IF;

  UPDATE public.totp_render_jobs
  SET state = 'failed',
      error_message = 'Render worker stopped responding after the final retry',
      finished_at = now(),
      heartbeat_at = now()
  WHERE state = 'rendering'
    AND attempts >= 3
    AND coalesce(heartbeat_at, claimed_at, created_at) < now() - interval '15 minutes';

  UPDATE public.totp_render_jobs
  SET state = 'rendering',
      attempts = attempts + 1,
      worker_id = v_worker,
      claimed_at = now(),
      started_at = coalesce(started_at, now()),
      heartbeat_at = now(),
      progress_percent = CASE WHEN state = 'queued' THEN 0 ELSE progress_percent END,
      error_message = NULL
  WHERE id = (
    SELECT id
    FROM public.totp_render_jobs
    WHERE state = 'queued'
       OR (
         state = 'rendering'
         AND attempts < 3
         AND coalesce(heartbeat_at, claimed_at, created_at) < now() - interval '15 minutes'
       )
    ORDER BY
      CASE WHEN state = 'queued' THEN 0 ELSE 1 END,
      created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_heartbeat_render_job(
  p_job_id uuid,
  p_worker_id text,
  p_progress_percent integer DEFAULT NULL
)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  UPDATE public.totp_render_jobs
  SET heartbeat_at = now(),
      progress_percent = greatest(
        progress_percent,
        least(99, greatest(0, coalesce(p_progress_percent, progress_percent)))
      )
  WHERE id = p_job_id
    AND state = 'rendering'
    AND worker_id = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Render job lease is no longer owned by this worker';
  END IF;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_complete_render_job_v2(
  p_job_id uuid,
  p_worker_id text,
  p_artifacts jsonb,
  p_qc jsonb,
  p_probe jsonb,
  p_timeline_sha256 text,
  p_master_sha256 text,
  p_input_sha256 text
)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
  v_passed boolean := coalesce((p_qc->>'passed')::boolean, false);
BEGIN
  IF v_passed AND (
    p_master_sha256 IS NULL OR p_master_sha256 !~ '^[0-9a-f]{64}$'
    OR p_timeline_sha256 IS NULL OR p_timeline_sha256 !~ '^[0-9a-f]{64}$'
    OR p_input_sha256 IS NULL OR p_input_sha256 !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Successful render jobs require SHA-256 master, timeline and input fingerprints';
  END IF;

  UPDATE public.totp_render_jobs
  SET state = CASE WHEN v_passed THEN 'succeeded' ELSE 'failed' END,
      artifacts = coalesce(p_artifacts, '[]'::jsonb),
      qc = coalesce(p_qc, '{}'::jsonb),
      probe = coalesce(p_probe, '{}'::jsonb),
      timeline_sha256 = p_timeline_sha256,
      master_sha256 = p_master_sha256,
      input_sha256 = p_input_sha256,
      progress_percent = CASE WHEN v_passed THEN 100 ELSE progress_percent END,
      error_message = CASE WHEN v_passed THEN NULL ELSE 'Quality control checks failed' END,
      heartbeat_at = now(),
      finished_at = now()
  WHERE id = p_job_id
    AND state = 'rendering'
    AND worker_id = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Render job lease is no longer owned by this worker';
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

CREATE OR REPLACE FUNCTION public.totp_fail_render_job_v2(
  p_job_id uuid,
  p_worker_id text,
  p_error text
)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  UPDATE public.totp_render_jobs
  SET state = 'failed',
      error_message = left(coalesce(nullif(btrim(p_error), ''), 'Render failed'), 1200),
      heartbeat_at = now(),
      finished_at = now()
  WHERE id = p_job_id
    AND state = 'rendering'
    AND worker_id = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Render job lease is no longer owned by this worker';
  END IF;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_claim_render_job_v2(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_heartbeat_render_job(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_complete_render_job_v2(uuid, text, jsonb, jsonb, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_fail_render_job_v2(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.totp_claim_render_job_v2(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_heartbeat_render_job(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_complete_render_job_v2(uuid, text, jsonb, jsonb, jsonb, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_fail_render_job_v2(uuid, text, text) TO service_role;
