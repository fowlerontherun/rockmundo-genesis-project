-- Phase 2 deterministic offline rendering.
-- Adds worker progress/heartbeat/retry state and a private immutable artifact bucket.

ALTER TABLE public.totp_render_jobs
  ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0
    CHECK (progress_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS progress_stage text,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3
    CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS output_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'totp-renders',
  'totp-renders',
  false,
  2147483648,
  ARRAY[
    'video/mp4',
    'image/jpeg',
    'text/vtt',
    'text/plain',
    'application/json'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "TOTP admins can read render artifacts" ON storage.objects;
CREATE POLICY "TOTP admins can read render artifacts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'totp-renders'
  AND public.has_role((select auth.uid()), 'admin')
);

CREATE OR REPLACE FUNCTION public.totp_claim_render_job(p_worker_id text)
RETURNS public.totp_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.totp_render_jobs;
BEGIN
  UPDATE public.totp_render_jobs
  SET state = 'rendering',
      attempts = attempts + 1,
      claimed_at = now(),
      heartbeat_at = now(),
      worker_id = nullif(btrim(coalesce(p_worker_id, '')), ''),
      progress_percent = greatest(progress_percent, 1),
      progress_stage = 'claimed',
      error_message = NULL
  WHERE id = (
    SELECT id
    FROM public.totp_render_jobs
    WHERE state = 'queued'
      AND attempts < max_attempts
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_update_render_progress(
  p_job_id uuid,
  p_progress_percent integer,
  p_progress_stage text,
  p_worker_id text DEFAULT NULL,
  p_output_metadata jsonb DEFAULT NULL
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
  SET progress_percent = greatest(progress_percent, least(99, greatest(0, coalesce(p_progress_percent, progress_percent)))),
      progress_stage = nullif(btrim(coalesce(p_progress_stage, '')), ''),
      heartbeat_at = now(),
      worker_id = coalesce(nullif(btrim(coalesce(p_worker_id, '')), ''), worker_id),
      output_metadata = CASE
        WHEN p_output_metadata IS NULL THEN output_metadata
        ELSE output_metadata || p_output_metadata
      END
  WHERE id = p_job_id
    AND state = 'rendering'
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'That render job is no longer rendering';
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
  v_retry boolean;
BEGIN
  SELECT attempts < max_attempts
  INTO v_retry
  FROM public.totp_render_jobs
  WHERE id = p_job_id
    AND state IN ('queued','rendering')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That render job is no longer running';
  END IF;

  UPDATE public.totp_render_jobs
  SET state = CASE WHEN coalesce(v_retry, false) THEN 'queued' ELSE 'failed' END,
      error_message = coalesce(nullif(btrim(p_error), ''), 'Render failed'),
      progress_stage = CASE WHEN coalesce(v_retry, false) THEN 'retrying' ELSE 'failed' END,
      heartbeat_at = now(),
      claimed_at = CASE WHEN coalesce(v_retry, false) THEN NULL ELSE claimed_at END,
      worker_id = CASE WHEN coalesce(v_retry, false) THEN NULL ELSE worker_id END,
      finished_at = CASE WHEN coalesce(v_retry, false) THEN NULL ELSE now() END
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_requeue_stale_render_jobs(
  p_stale_after interval DEFAULT interval '10 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH changed AS (
    UPDATE public.totp_render_jobs
    SET state = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
        error_message = 'Render worker heartbeat expired',
        progress_stage = CASE WHEN attempts < max_attempts THEN 'retrying' ELSE 'failed' END,
        claimed_at = CASE WHEN attempts < max_attempts THEN NULL ELSE claimed_at END,
        worker_id = CASE WHEN attempts < max_attempts THEN NULL ELSE worker_id END,
        finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE now() END,
        heartbeat_at = now()
    WHERE state = 'rendering'
      AND coalesce(heartbeat_at, claimed_at, updated_at) < now() - p_stale_after
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM changed;

  RETURN v_count;
END;
$$;

-- Extend the Phase 0 completion function with immutable output metadata.
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
  v_candidate public.totp_render_jobs%ROWTYPE;
  v_master jsonb;
  v_passed boolean := coalesce((p_qc->>'passed')::boolean, false);
  v_error text := NULL;
BEGIN
  SELECT * INTO v_candidate
  FROM public.totp_render_jobs
  WHERE id = p_job_id AND state = 'rendering'
  FOR UPDATE;

  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'That render job is not currently rendering';
  END IF;

  SELECT artifact INTO v_master
  FROM jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb)) artifact
  WHERE artifact->>'kind' = 'master'
  LIMIT 1;

  IF v_passed AND (
    v_master IS NULL
    OR coalesce(v_master->>'url', '') = ''
    OR coalesce(v_master->>'sha256', '') = ''
  ) THEN
    v_passed := false;
    v_error := 'Quality control passed but the master artifact URL/hash is missing';
  END IF;

  IF v_passed AND jsonb_array_length(coalesce(p_qc->'failures', '[]'::jsonb)) > 0 THEN
    v_passed := false;
    v_error := 'Quality control contains failures';
  END IF;

  IF v_passed AND NOT EXISTS (
    SELECT 1
    FROM public.totp_episode_manifests m
    WHERE m.episode_id = v_candidate.episode_id
      AND m.checksum = v_candidate.manifest_checksum
      AND m.production_state IN ('production_ready', 'rendered_master')
  ) THEN
    v_passed := false;
    v_error := 'The stored running sheet no longer matches this render';
  END IF;

  IF v_passed AND NOT EXISTS (
    SELECT 1
    FROM public.totp_compliance_reports c
    WHERE c.episode_id = v_candidate.episode_id
      AND c.manifest_checksum = v_candidate.manifest_checksum
      AND c.passed = true
      AND c.blocker_count = 0
  ) THEN
    v_passed := false;
    v_error := 'Rights and safety clearance is no longer current';
  END IF;

  IF v_passed AND EXISTS (
    SELECT 1
    FROM public.totp_episode_takedowns t
    WHERE t.episode_id = v_candidate.episode_id
      AND t.active = true
  ) THEN
    v_passed := false;
    v_error := 'An open takedown blocks this master';
  END IF;

  UPDATE public.totp_render_jobs
  SET state = CASE WHEN v_passed THEN 'succeeded' ELSE 'failed' END,
      artifacts = coalesce(p_artifacts, '[]'::jsonb),
      qc = coalesce(p_qc, '{}'::jsonb),
      output_metadata = output_metadata || jsonb_build_object(
        'completed_at', now(),
        'master_sha256', v_master->>'sha256',
        'master_filename', v_master->>'filename'
      ),
      progress_percent = 100,
      progress_stage = CASE WHEN v_passed THEN 'complete' ELSE 'qc_failed' END,
      heartbeat_at = now(),
      error_message = CASE
        WHEN v_passed THEN NULL
        ELSE coalesce(v_error, 'Quality control checks failed')
      END,
      finished_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF v_passed THEN
    UPDATE public.totp_episode_manifests
    SET production_state = 'rendered_master',
        updated_at = now()
    WHERE episode_id = v_job.episode_id
      AND checksum = v_job.manifest_checksum
      AND production_state IN ('production_ready', 'rendered_master');

    INSERT INTO public.totp_production_audit (
      episode_id, event_kind, headline, detail, passed, manifest_checksum, actor_id
    )
    VALUES (
      v_job.episode_id,
      'render',
      'QC-approved master created',
      jsonb_build_object(
        'render_job_id', v_job.id,
        'master_filename', v_master->>'filename',
        'master_url', v_master->>'url',
        'master_sha256', v_master->>'sha256',
        'qc', p_qc
      ),
      true,
      v_job.manifest_checksum,
      NULL
    );
  END IF;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_claim_render_job(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_update_render_progress(uuid, integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_requeue_stale_render_jobs(interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_fail_render_job(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.totp_claim_render_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_update_render_progress(uuid, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_requeue_stale_render_jobs(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_fail_render_job(uuid, text) TO service_role;
