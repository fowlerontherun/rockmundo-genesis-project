-- Harden Top of the Pops production state transitions, render queue entry and external publishing.
-- Client/admin RPCs may prepare and sign off an episode, but only the render worker may
-- promote it to rendered_master. External publishing receives a master only through
-- the server-side release gate below.

CREATE OR REPLACE FUNCTION public.totp_admin_save_episode_manifest(
  p_episode_id uuid,
  p_manifest jsonb,
  p_issues jsonb DEFAULT '[]'::jsonb,
  p_production_state text DEFAULT 'gameplay'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.totp_episode_manifests%ROWTYPE;
  v_checksum text;
  v_runtime integer;
  v_segments integer;
  v_has_blockers boolean := false;
  v_compliance_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_episode_id IS NULL OR p_manifest IS NULL THEN
    RAISE EXCEPTION 'An episode and running sheet are required';
  END IF;

  -- rendered_master/published are server-owned states. They cannot be asserted by a browser.
  IF p_production_state NOT IN ('gameplay', 'production_ready') THEN
    RAISE EXCEPTION 'Only the render/publish pipeline may set production state %', p_production_state;
  END IF;

  v_checksum := coalesce(p_manifest->>'checksum', '');
  IF v_checksum = '' THEN
    RAISE EXCEPTION 'The running sheet has no checksum';
  END IF;

  v_runtime := coalesce((p_manifest->>'total_runtime_ms')::integer, 0);
  v_segments := coalesce(jsonb_array_length(p_manifest->'segments'), 0);

  SELECT * INTO v_existing
  FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id
  FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.production_state IN ('rendered_master', 'published') THEN
    RAISE EXCEPTION 'This episode running sheet is locked for external delivery and cannot be changed';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue
    WHERE issue->>'severity' = 'blocking'
  )
  INTO v_has_blockers;

  IF p_production_state = 'production_ready' THEN
    IF v_segments = 0 THEN
      RAISE EXCEPTION 'An empty running sheet cannot be signed off';
    END IF;
    IF v_has_blockers THEN
      RAISE EXCEPTION 'Resolve all blocking running-sheet issues before sign-off';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.totp_compliance_reports c
      WHERE c.episode_id = p_episode_id
        AND c.manifest_checksum = v_checksum
        AND c.passed = true
        AND c.blocker_count = 0
    )
    INTO v_compliance_ok;

    IF NOT v_compliance_ok THEN
      RAISE EXCEPTION 'A current passing rights and safety screening is required before sign-off';
    END IF;
  END IF;

  INSERT INTO public.totp_episode_manifests (
    episode_id, manifest_version, production_state, checksum,
    total_runtime_ms, segment_count, manifest, issues
  )
  VALUES (
    p_episode_id,
    coalesce((p_manifest->>'manifest_version')::integer, 1),
    p_production_state,
    v_checksum,
    v_runtime,
    v_segments,
    p_manifest,
    coalesce(p_issues, '[]'::jsonb)
  )
  ON CONFLICT (episode_id) DO UPDATE
  SET manifest_version = EXCLUDED.manifest_version,
      production_state = EXCLUDED.production_state,
      checksum = EXCLUDED.checksum,
      total_runtime_ms = EXCLUDED.total_runtime_ms,
      segment_count = EXCLUDED.segment_count,
      manifest = EXCLUDED.manifest,
      issues = EXCLUDED.issues,
      updated_at = now();

  RETURN public.totp_episode_manifest(p_episode_id);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_save_episode_manifest(uuid, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_episode_manifest(uuid, jsonb, jsonb, text) TO authenticated;


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
  v_manifest public.totp_episode_manifests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can queue episode renders';
  END IF;

  SELECT * INTO v_manifest
  FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id
  FOR UPDATE;

  IF v_manifest.id IS NULL THEN
    RAISE EXCEPTION 'Save the episode running sheet before queueing a render';
  END IF;

  IF v_manifest.checksum <> p_manifest_checksum THEN
    RAISE EXCEPTION 'The running sheet has changed since this render was requested';
  END IF;

  IF v_manifest.production_state NOT IN ('production_ready', 'rendered_master') THEN
    RAISE EXCEPTION 'The episode must be signed off before rendering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(v_manifest.issues, '[]'::jsonb)) issue
    WHERE issue->>'severity' = 'blocking'
  ) THEN
    RAISE EXCEPTION 'Blocking running-sheet issues must be resolved before rendering';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_compliance_reports c
    WHERE c.episode_id = p_episode_id
      AND c.manifest_checksum = p_manifest_checksum
      AND c.passed = true
      AND c.blocker_count = 0
  ) THEN
    RAISE EXCEPTION 'A current passing rights and safety screening is required before rendering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.totp_episode_takedowns t
    WHERE t.episode_id = p_episode_id
      AND t.active = true
  ) THEN
    RAISE EXCEPTION 'Resolve all open takedowns before rendering';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id
      AND a.event_kind = 'rehearsal'
      AND a.passed = true
      AND a.manifest_checksum = p_manifest_checksum
  ) THEN
    RAISE EXCEPTION 'A passing rehearsal for this running sheet is required before rendering';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id
      AND a.event_kind = 'approval'
      AND a.passed = true
      AND a.manifest_checksum = p_manifest_checksum
  ) THEN
    RAISE EXCEPTION 'Broadcast sign-off for this running sheet is required before rendering';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_render_jobs
    WHERE episode_id = p_episode_id AND state IN ('queued','rendering')
  ) THEN
    RAISE EXCEPTION 'A render is already in progress for this episode';
  END IF;

  INSERT INTO public.totp_render_jobs (episode_id, manifest_checksum, plan, requested_by)
  VALUES (p_episode_id, p_manifest_checksum, coalesce(p_plan, '{}'::jsonb), auth.uid())
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_enqueue_render(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_enqueue_render(uuid, text, jsonb) TO authenticated, service_role;


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
        'master_sha256', v_master->>'sha256'
      ),
      true,
      v_job.manifest_checksum,
      NULL
    );
  END IF;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_complete_render_job(uuid, jsonb, jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.totp_assert_publishable_episode(
  p_episode_id uuid,
  p_manifest_checksum text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manifest public.totp_episode_manifests%ROWTYPE;
  v_render public.totp_render_jobs%ROWTYPE;
  v_master jsonb;
BEGIN
  SELECT * INTO v_manifest
  FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id;

  IF v_manifest.id IS NULL THEN
    RAISE EXCEPTION 'No frozen running sheet exists for this episode';
  END IF;

  IF coalesce(p_manifest_checksum, '') = '' OR v_manifest.checksum <> p_manifest_checksum THEN
    RAISE EXCEPTION 'The planned upload does not match the current running sheet';
  END IF;

  IF v_manifest.production_state <> 'rendered_master' THEN
    RAISE EXCEPTION 'A QC-approved rendered master is required before publishing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_compliance_reports c
    WHERE c.episode_id = p_episode_id
      AND c.manifest_checksum = p_manifest_checksum
      AND c.passed = true
      AND c.blocker_count = 0
  ) THEN
    RAISE EXCEPTION 'Rights and safety clearance is missing or stale';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.totp_episode_takedowns t
    WHERE t.episode_id = p_episode_id
      AND t.active = true
  ) THEN
    RAISE EXCEPTION 'An open takedown blocks external publishing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id
      AND a.event_kind = 'rehearsal'
      AND a.passed = true
      AND a.manifest_checksum = p_manifest_checksum
  ) THEN
    RAISE EXCEPTION 'A passing rehearsal for this running sheet is required before publishing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id
      AND a.event_kind = 'approval'
      AND a.passed = true
      AND a.manifest_checksum = p_manifest_checksum
  ) THEN
    RAISE EXCEPTION 'Broadcast sign-off for this running sheet is required before publishing';
  END IF;

  SELECT * INTO v_render
  FROM public.totp_render_jobs r
  WHERE r.episode_id = p_episode_id
    AND r.manifest_checksum = p_manifest_checksum
    AND r.state = 'succeeded'
    AND coalesce((r.qc->>'passed')::boolean, false) = true
  ORDER BY r.finished_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF v_render.id IS NULL THEN
    RAISE EXCEPTION 'No successful QC-approved render exists for this running sheet';
  END IF;

  SELECT artifact INTO v_master
  FROM jsonb_array_elements(coalesce(v_render.artifacts, '[]'::jsonb)) artifact
  WHERE artifact->>'kind' = 'master'
  LIMIT 1;

  IF v_master IS NULL
     OR coalesce(v_master->>'url', '') = ''
     OR coalesce(v_master->>'sha256', '') = '' THEN
    RAISE EXCEPTION 'The approved render has no verifiable master artifact';
  END IF;

  RETURN jsonb_build_object(
    'episode_id', p_episode_id,
    'manifest_checksum', p_manifest_checksum,
    'render_job_id', v_render.id,
    'master_url', v_master->>'url',
    'master_sha256', v_master->>'sha256',
    'master_filename', v_master->>'filename'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_assert_publishable_episode(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_assert_publishable_episode(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_assert_publishable_episode(uuid, text) TO service_role;

COMMENT ON FUNCTION public.totp_assert_publishable_episode(uuid, text) IS
  'Service-role release gate. Returns the QC-approved master only when the frozen manifest, compliance, rehearsal, approval and takedown state all permit external publishing.';
