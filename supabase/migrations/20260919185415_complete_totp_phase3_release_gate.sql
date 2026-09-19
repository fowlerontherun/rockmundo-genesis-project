-- Complete Top of the Pops Phase 3 production control-room gate.
-- Applied to production as Supabase migration 20260919185415.

ALTER TABLE public.totp_production_audit
  DROP CONSTRAINT IF EXISTS totp_production_audit_event_kind_check;
ALTER TABLE public.totp_production_audit
  ADD CONSTRAINT totp_production_audit_event_kind_check
  CHECK (event_kind IN ('rehearsal','preflight','approval','note','render','publish','override','rerender','replacement'));

CREATE OR REPLACE FUNCTION public.totp_admin_log_production_event(p_episode_id uuid, p_event_kind text, p_headline text, p_detail jsonb DEFAULT '{}'::jsonb, p_passed boolean DEFAULT NULL::boolean, p_manifest_checksum text DEFAULT NULL::text)
 RETURNS totp_production_audit
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.totp_production_audit;
  v_manifest public.totp_episode_manifests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can log production events.';
  END IF;
  IF p_event_kind NOT IN ('preflight','approval','note','replacement') THEN
    RAISE EXCEPTION 'Event kind % is owned by the production pipeline', p_event_kind;
  END IF;
  IF p_event_kind = 'approval' THEN
    SELECT * INTO v_manifest FROM public.totp_episode_manifests WHERE episode_id = p_episode_id;
    IF v_manifest.id IS NULL OR v_manifest.production_state <> 'production_ready'
       OR v_manifest.checksum <> coalesce(p_manifest_checksum, '') THEN
      RAISE EXCEPTION 'Approval must match the current production-ready running sheet';
    END IF;
    IF p_passed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Broadcast approval must be explicitly passing'; END IF;
  END IF;
  INSERT INTO public.totp_production_audit (
    episode_id, event_kind, headline, detail, passed, manifest_checksum, actor_id
  ) VALUES (
    p_episode_id, p_event_kind, left(btrim(p_headline), 240),
    coalesce(p_detail, '{}'::jsonb), p_passed, p_manifest_checksum, auth.uid()
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_admin_record_preflight_override(p_episode_id uuid, p_manifest_checksum text, p_check_code text, p_severity text, p_reason text)
 RETURNS totp_production_audit
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manifest public.totp_episode_manifests%ROWTYPE;
  v_row public.totp_production_audit;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can record preflight overrides';
  END IF;
  IF p_severity NOT IN ('warning','info') THEN
    RAISE EXCEPTION 'Blocking preflight failures cannot be overridden';
  END IF;
  IF length(v_reason) < 8 THEN RAISE EXCEPTION 'An override reason of at least 8 characters is required'; END IF;
  SELECT * INTO v_manifest FROM public.totp_episode_manifests WHERE episode_id = p_episode_id;
  IF v_manifest.id IS NULL OR v_manifest.checksum <> coalesce(p_manifest_checksum, '') THEN
    RAISE EXCEPTION 'Override must match the current frozen running sheet';
  END IF;
  INSERT INTO public.totp_production_audit (
    episode_id, event_kind, headline, detail, passed, manifest_checksum, actor_id
  ) VALUES (
    p_episode_id, 'override', 'Preflight warning acknowledged',
    jsonb_build_object('check_code', left(coalesce(p_check_code, ''), 120), 'severity', p_severity, 'reason', v_reason),
    NULL, p_manifest_checksum, auth.uid()
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_admin_enqueue_rehearsal_render(p_episode_id uuid, p_manifest_checksum text, p_plan jsonb)
 RETURNS totp_render_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manifest public.totp_episode_manifests%ROWTYPE;
  v_job public.totp_render_jobs;
  v_active public.totp_render_jobs;
  v_purpose text := coalesce(p_plan->>'purpose', '');
  v_source text := nullif(p_plan->>'source_performance_id', '');
  v_segment_count integer;
  v_performance_items integer;
  v_total integer;
  v_item_total bigint;
  v_prior boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can queue rehearsal renders';
  END IF;
  IF v_purpose NOT IN ('rehearsal','segment_preview') THEN
    RAISE EXCEPTION 'Rehearsal queue only accepts rehearsal or segment_preview plans';
  END IF;
  IF coalesce(p_plan->>'episode_id', '') <> p_episode_id::text
     OR coalesce(p_plan->>'manifest_checksum', '') <> coalesce(p_manifest_checksum, '') THEN
    RAISE EXCEPTION 'Render plan does not match the requested episode running sheet';
  END IF;

  SELECT * INTO v_manifest FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id FOR UPDATE;
  IF v_manifest.id IS NULL THEN RAISE EXCEPTION 'Save the running sheet before rehearsal'; END IF;
  IF v_manifest.checksum <> p_manifest_checksum THEN RAISE EXCEPTION 'The running sheet changed before rehearsal was queued'; END IF;

  v_segment_count := coalesce(jsonb_array_length(v_manifest.manifest->'segments'), 0);
  IF v_segment_count = 0 THEN RAISE EXCEPTION 'An empty running sheet cannot be rehearsed'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(v_manifest.manifest->'segments', '[]'::jsonb)) segment
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(segment->'assets', '[]'::jsonb)) asset
      WHERE asset->>'kind' = 'song_audio'
        AND coalesce(asset->>'url', '') <> ''
        AND coalesce((asset->>'duration_ms')::integer, 0) > 0
    )
  ) THEN
    RAISE EXCEPTION 'Every rehearsed act needs playable song audio with a known duration';
  END IF;

  v_total := coalesce((p_plan->>'total_duration_ms')::integer, 0);
  SELECT coalesce(sum((item->>'duration_ms')::bigint), 0)
  INTO v_item_total
  FROM jsonb_array_elements(coalesce(p_plan->'items', '[]'::jsonb)) item;
  IF v_total <= 0 OR v_item_total <> v_total THEN RAISE EXCEPTION 'Render plan timeline is incomplete'; END IF;

  SELECT count(*) INTO v_performance_items
  FROM jsonb_array_elements(coalesce(p_plan->'items', '[]'::jsonb)) item
  WHERE item->>'kind' = 'performance';

  IF v_purpose = 'rehearsal' THEN
    IF v_source IS NOT NULL OR v_performance_items <> v_segment_count THEN
      RAISE EXCEPTION 'A full rehearsal must contain every act exactly once';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_manifest.manifest->'segments') segment
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_plan->'items') item
        WHERE item->>'kind' = 'performance' AND item->>'performance_id' = segment->>'performance_id'
      )
    ) THEN RAISE EXCEPTION 'The rehearsal plan does not match the frozen running order'; END IF;
  ELSE
    IF v_source IS NULL OR v_performance_items <> 1 THEN
      RAISE EXCEPTION 'A segment preview must identify exactly one performance';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_manifest.manifest->'segments') segment
      WHERE segment->>'performance_id' = v_source
    ) THEN RAISE EXCEPTION 'The requested segment is not in the frozen running sheet'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_plan->'items') item
      WHERE item->>'performance_id' IS NOT NULL AND item->>'performance_id' <> v_source
    ) THEN RAISE EXCEPTION 'Segment preview contains programme material from another act'; END IF;
  END IF;

  SELECT * INTO v_active
  FROM public.totp_render_jobs
  WHERE episode_id = p_episode_id AND state IN ('queued','rendering')
  ORDER BY created_at DESC LIMIT 1;

  IF v_active.id IS NOT NULL THEN
    IF v_active.manifest_checksum = p_manifest_checksum
       AND coalesce(v_active.plan->>'purpose', 'master') = v_purpose
       AND coalesce(v_active.plan->>'source_performance_id', '') = coalesce(v_source, '') THEN
      RETURN v_active;
    END IF;
    RAISE EXCEPTION 'Another render is already in progress for this episode';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.totp_render_jobs r
    WHERE r.episode_id = p_episode_id
      AND r.manifest_checksum = p_manifest_checksum
      AND r.state = 'succeeded'
      AND coalesce((r.qc->>'passed')::boolean, false) = true
      AND coalesce(r.plan->>'purpose', 'master') = v_purpose
      AND coalesce(r.plan->>'source_performance_id', '') = coalesce(v_source, '')
  ) INTO v_prior;

  INSERT INTO public.totp_render_jobs (episode_id, manifest_checksum, plan, requested_by)
  VALUES (p_episode_id, p_manifest_checksum, p_plan, auth.uid())
  RETURNING * INTO v_job;

  IF v_prior THEN
    INSERT INTO public.totp_production_audit (
      episode_id, event_kind, headline, detail, passed, manifest_checksum, actor_id
    ) VALUES (
      p_episode_id, 'rerender',
      CASE WHEN v_purpose = 'rehearsal' THEN 'Full rehearsal re-render requested' ELSE 'Segment preview re-render requested' END,
      jsonb_build_object('render_job_id', v_job.id, 'purpose', v_purpose, 'source_performance_id', v_source),
      NULL, p_manifest_checksum, auth.uid()
    );
  END IF;
  RETURN v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_admin_save_episode_manifest(p_episode_id uuid, p_manifest jsonb, p_issues jsonb DEFAULT '[]'::jsonb, p_production_state text DEFAULT 'gameplay'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.totp_episode_manifests%ROWTYPE;
  v_checksum text;
  v_runtime integer;
  v_segments integer;
  v_has_blockers boolean := false;
  v_compliance_ok boolean := false;
  v_rehearsal_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_episode_id IS NULL OR p_manifest IS NULL THEN RAISE EXCEPTION 'An episode and running sheet are required'; END IF;
  IF p_production_state NOT IN ('gameplay', 'production_ready') THEN
    RAISE EXCEPTION 'Only the render/publish pipeline may set production state %', p_production_state;
  END IF;
  v_checksum := coalesce(p_manifest->>'checksum', '');
  IF v_checksum = '' THEN RAISE EXCEPTION 'The running sheet has no checksum'; END IF;
  v_runtime := coalesce((p_manifest->>'total_runtime_ms')::integer, 0);
  v_segments := coalesce(jsonb_array_length(p_manifest->'segments'), 0);

  SELECT * INTO v_existing FROM public.totp_episode_manifests WHERE episode_id = p_episode_id FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.production_state IN ('rendered_master', 'published') THEN
    RAISE EXCEPTION 'This episode running sheet is locked for external delivery and cannot be changed';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_issues, '[]'::jsonb)) issue
    WHERE issue->>'severity' = 'blocking'
  ) INTO v_has_blockers;

  IF p_production_state = 'production_ready' THEN
    IF v_segments = 0 THEN RAISE EXCEPTION 'An empty running sheet cannot be signed off'; END IF;
    IF v_has_blockers THEN RAISE EXCEPTION 'Resolve all blocking running-sheet issues before sign-off'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.totp_compliance_reports c
      WHERE c.episode_id = p_episode_id AND c.manifest_checksum = v_checksum
        AND c.passed = true AND c.blocker_count = 0
    ) INTO v_compliance_ok;
    IF NOT v_compliance_ok THEN RAISE EXCEPTION 'A current passing rights and safety screening is required before sign-off'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.totp_render_jobs r
      WHERE r.episode_id = p_episode_id AND r.manifest_checksum = v_checksum
        AND r.state = 'succeeded' AND coalesce((r.qc->>'passed')::boolean, false) = true
        AND r.plan->>'purpose' = 'rehearsal'
    ) INTO v_rehearsal_ok;
    IF NOT v_rehearsal_ok THEN RAISE EXCEPTION 'A QC-approved full rehearsal render is required before sign-off'; END IF;
  END IF;

  INSERT INTO public.totp_episode_manifests (
    episode_id, manifest_version, production_state, checksum, total_runtime_ms, segment_count, manifest, issues
  ) VALUES (
    p_episode_id, coalesce((p_manifest->>'manifest_version')::integer, 1),
    p_production_state, v_checksum, v_runtime, v_segments, p_manifest, coalesce(p_issues, '[]'::jsonb)
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
$function$;

CREATE OR REPLACE FUNCTION public.totp_admin_enqueue_render(p_episode_id uuid, p_manifest_checksum text, p_plan jsonb DEFAULT '{}'::jsonb)
 RETURNS totp_render_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.totp_render_jobs;
  v_active public.totp_render_jobs;
  v_manifest public.totp_episode_manifests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only administrators can queue episode renders'; END IF;
  SELECT * INTO v_manifest FROM public.totp_episode_manifests WHERE episode_id = p_episode_id FOR UPDATE;
  IF v_manifest.id IS NULL THEN RAISE EXCEPTION 'Save the episode running sheet before queueing a render'; END IF;
  IF v_manifest.checksum <> p_manifest_checksum THEN RAISE EXCEPTION 'The running sheet has changed since this render was requested'; END IF;
  IF v_manifest.production_state NOT IN ('production_ready','rendered_master') THEN RAISE EXCEPTION 'The episode must be signed off before rendering'; END IF;
  IF coalesce(p_plan->>'purpose', 'master') <> 'master' THEN RAISE EXCEPTION 'The master render queue only accepts master plans'; END IF;
  IF coalesce(p_plan->>'manifest_checksum', '') <> p_manifest_checksum
     OR coalesce(p_plan->>'episode_id', '') <> p_episode_id::text THEN
    RAISE EXCEPTION 'The master render plan does not match the frozen running sheet';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(v_manifest.issues, '[]'::jsonb)) issue
    WHERE issue->>'severity' = 'blocking'
  ) THEN RAISE EXCEPTION 'Blocking running-sheet issues must be resolved before rendering'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_compliance_reports c
    WHERE c.episode_id = p_episode_id AND c.manifest_checksum = p_manifest_checksum
      AND c.passed = true AND c.blocker_count = 0
  ) THEN RAISE EXCEPTION 'A current passing rights and safety screening is required before rendering'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.totp_episode_takedowns t
    WHERE t.episode_id = p_episode_id AND t.active = true
  ) THEN RAISE EXCEPTION 'Resolve all open takedowns before rendering'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_render_jobs r
    WHERE r.episode_id = p_episode_id AND r.manifest_checksum = p_manifest_checksum
      AND r.state = 'succeeded' AND coalesce((r.qc->>'passed')::boolean, false) = true
      AND r.plan->>'purpose' = 'rehearsal'
  ) THEN RAISE EXCEPTION 'A QC-approved full rehearsal render is required before rendering'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id AND a.event_kind = 'approval'
      AND a.passed = true AND a.manifest_checksum = p_manifest_checksum
  ) THEN RAISE EXCEPTION 'Broadcast sign-off for this running sheet is required before rendering'; END IF;

  SELECT * INTO v_active FROM public.totp_render_jobs
  WHERE episode_id = p_episode_id AND state IN ('queued','rendering')
  ORDER BY created_at DESC LIMIT 1;
  IF v_active.id IS NOT NULL THEN
    IF v_active.manifest_checksum = p_manifest_checksum
       AND coalesce(v_active.plan->>'purpose', 'master') = 'master' THEN RETURN v_active; END IF;
    RAISE EXCEPTION 'Another render is already in progress for this episode';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_render_jobs r
    WHERE r.episode_id = p_episode_id AND r.manifest_checksum = p_manifest_checksum
      AND r.state = 'succeeded' AND coalesce((r.qc->>'passed')::boolean, false) = true
      AND coalesce(r.plan->>'purpose', 'master') = 'master'
  ) THEN
    INSERT INTO public.totp_production_audit (
      episode_id,event_kind,headline,detail,passed,manifest_checksum,actor_id
    ) VALUES (
      p_episode_id,'rerender','Master re-render requested',jsonb_build_object('purpose','master'),
      NULL,p_manifest_checksum,auth.uid()
    );
  END IF;

  INSERT INTO public.totp_render_jobs (episode_id, manifest_checksum, plan, requested_by)
  VALUES (p_episode_id, p_manifest_checksum, p_plan, auth.uid())
  RETURNING * INTO v_job;
  RETURN v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_complete_render_job_v2(p_job_id uuid, p_worker_id text, p_artifacts jsonb, p_qc jsonb, p_probe jsonb, p_timeline_sha256 text, p_master_sha256 text, p_input_sha256 text)
 RETURNS totp_render_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.totp_render_jobs;
  v_candidate public.totp_render_jobs%ROWTYPE;
  v_passed boolean := coalesce((p_qc->>'passed')::boolean, false);
  v_purpose text;
  v_source text;
  v_error text := NULL;
BEGIN
  SELECT * INTO v_candidate FROM public.totp_render_jobs
  WHERE id = p_job_id AND state = 'rendering' AND worker_id = p_worker_id FOR UPDATE;
  IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'Render job lease is no longer owned by this worker'; END IF;
  v_purpose := coalesce(v_candidate.plan->>'purpose', 'master');
  v_source := nullif(v_candidate.plan->>'source_performance_id', '');

  IF v_passed AND (
    p_master_sha256 IS NULL OR p_master_sha256 !~ '^[0-9a-f]{64}$'
    OR p_timeline_sha256 IS NULL OR p_timeline_sha256 !~ '^[0-9a-f]{64}$'
    OR p_input_sha256 IS NULL OR p_input_sha256 !~ '^[0-9a-f]{64}$'
  ) THEN v_passed := false; v_error := 'Successful render jobs require SHA-256 master, timeline and input fingerprints'; END IF;

  IF v_passed AND NOT EXISTS (
    SELECT 1 FROM public.totp_episode_manifests m
    WHERE m.episode_id = v_candidate.episode_id AND m.checksum = v_candidate.manifest_checksum
  ) THEN v_passed := false; v_error := 'The frozen running sheet changed while this render was running'; END IF;

  IF v_passed AND v_purpose = 'master' AND NOT EXISTS (
    SELECT 1 FROM public.totp_episode_manifests m
    WHERE m.episode_id = v_candidate.episode_id AND m.checksum = v_candidate.manifest_checksum
      AND m.production_state IN ('production_ready','rendered_master')
  ) THEN v_passed := false; v_error := 'The episode is no longer signed off for a master render'; END IF;

  IF v_passed AND v_purpose = 'master' AND NOT EXISTS (
    SELECT 1 FROM public.totp_compliance_reports c
    WHERE c.episode_id = v_candidate.episode_id AND c.manifest_checksum = v_candidate.manifest_checksum
      AND c.passed = true AND c.blocker_count = 0
  ) THEN v_passed := false; v_error := 'Rights and safety clearance is no longer current'; END IF;

  IF v_passed AND v_purpose = 'master' AND EXISTS (
    SELECT 1 FROM public.totp_episode_takedowns t
    WHERE t.episode_id = v_candidate.episode_id AND t.active = true
  ) THEN v_passed := false; v_error := 'An open takedown blocks this master'; END IF;

  UPDATE public.totp_render_jobs
  SET state = CASE WHEN v_passed THEN 'succeeded' ELSE 'failed' END,
      artifacts = coalesce(p_artifacts, '[]'::jsonb),
      qc = coalesce(p_qc, '{}'::jsonb),
      probe = coalesce(p_probe, '{}'::jsonb),
      timeline_sha256 = p_timeline_sha256,
      master_sha256 = p_master_sha256,
      input_sha256 = p_input_sha256,
      progress_percent = CASE WHEN v_passed THEN 100 ELSE progress_percent END,
      error_message = CASE WHEN v_passed THEN NULL ELSE coalesce(v_error, 'Quality control checks failed') END,
      heartbeat_at = now(), finished_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  IF v_passed AND v_purpose = 'master' THEN
    UPDATE public.totp_episode_manifests
    SET production_state = 'rendered_master', updated_at = now()
    WHERE episode_id = v_job.episode_id AND checksum = v_job.manifest_checksum
      AND production_state IN ('production_ready','rendered_master');
  END IF;

  INSERT INTO public.totp_production_audit (
    episode_id,event_kind,headline,detail,passed,manifest_checksum,actor_id
  ) VALUES (
    v_job.episode_id,
    CASE WHEN v_purpose = 'rehearsal' THEN 'rehearsal' ELSE 'render' END,
    CASE
      WHEN v_purpose = 'rehearsal' AND v_passed THEN 'QC rehearsal render passed'
      WHEN v_purpose = 'rehearsal' THEN 'Rehearsal render failed release checks'
      WHEN v_purpose = 'segment_preview' AND v_passed THEN 'Segment preview rendered'
      WHEN v_purpose = 'segment_preview' THEN 'Segment preview failed'
      WHEN v_passed THEN 'QC-approved master created'
      ELSE 'Master render failed release checks'
    END,
    jsonb_build_object(
      'render_job_id', v_job.id, 'purpose', v_purpose, 'source_performance_id', v_source,
      'timeline_sha256', p_timeline_sha256, 'master_sha256', p_master_sha256, 'error', v_job.error_message
    ),
    v_passed, v_job.manifest_checksum, NULL
  );
  RETURN v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_fail_render_job_v2(p_job_id uuid, p_worker_id text, p_error text)
 RETURNS totp_render_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.totp_render_jobs;
  v_purpose text;
  v_source text;
BEGIN
  UPDATE public.totp_render_jobs
  SET state = 'failed',
      error_message = left(coalesce(nullif(btrim(p_error), ''), 'Render failed'), 1200),
      heartbeat_at = now(), finished_at = now()
  WHERE id = p_job_id AND state = 'rendering' AND worker_id = p_worker_id
  RETURNING * INTO v_job;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Render job lease is no longer owned by this worker'; END IF;
  v_purpose := coalesce(v_job.plan->>'purpose', 'master');
  v_source := nullif(v_job.plan->>'source_performance_id', '');
  INSERT INTO public.totp_production_audit (
    episode_id,event_kind,headline,detail,passed,manifest_checksum,actor_id
  ) VALUES (
    v_job.episode_id,
    CASE WHEN v_purpose = 'rehearsal' THEN 'rehearsal' ELSE 'render' END,
    CASE
      WHEN v_purpose = 'rehearsal' THEN 'Rehearsal render failed'
      WHEN v_purpose = 'segment_preview' THEN 'Segment preview failed'
      ELSE 'Master render failed'
    END,
    jsonb_build_object('render_job_id',v_job.id,'purpose',v_purpose,'source_performance_id',v_source,'error',v_job.error_message),
    false,v_job.manifest_checksum,NULL
  );
  RETURN v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.totp_assert_publishable_episode(p_episode_id uuid, p_manifest_checksum text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manifest public.totp_episode_manifests%ROWTYPE;
  v_render public.totp_render_jobs%ROWTYPE;
  v_master jsonb;
BEGIN
  SELECT * INTO v_manifest FROM public.totp_episode_manifests WHERE episode_id = p_episode_id;
  IF v_manifest.id IS NULL THEN RAISE EXCEPTION 'No frozen running sheet exists for this episode'; END IF;
  IF coalesce(p_manifest_checksum, '') = '' OR v_manifest.checksum <> p_manifest_checksum THEN
    RAISE EXCEPTION 'The planned upload does not match the current running sheet';
  END IF;
  IF v_manifest.production_state <> 'rendered_master' THEN RAISE EXCEPTION 'A QC-approved rendered master is required before publishing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_compliance_reports c
    WHERE c.episode_id = p_episode_id AND c.manifest_checksum = p_manifest_checksum
      AND c.passed = true AND c.blocker_count = 0
  ) THEN RAISE EXCEPTION 'Rights and safety clearance is missing or stale'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.totp_episode_takedowns t WHERE t.episode_id = p_episode_id AND t.active = true
  ) THEN RAISE EXCEPTION 'An open takedown blocks external publishing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_render_jobs r
    WHERE r.episode_id = p_episode_id AND r.manifest_checksum = p_manifest_checksum
      AND r.state = 'succeeded' AND coalesce((r.qc->>'passed')::boolean, false) = true
      AND r.plan->>'purpose' = 'rehearsal'
  ) THEN RAISE EXCEPTION 'A QC-approved full rehearsal render is required before publishing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.totp_production_audit a
    WHERE a.episode_id = p_episode_id AND a.event_kind = 'approval'
      AND a.passed = true AND a.manifest_checksum = p_manifest_checksum
  ) THEN RAISE EXCEPTION 'Broadcast sign-off for this running sheet is required before publishing'; END IF;

  SELECT * INTO v_render
  FROM public.totp_render_jobs r
  WHERE r.episode_id = p_episode_id AND r.manifest_checksum = p_manifest_checksum
    AND r.state = 'succeeded' AND coalesce((r.qc->>'passed')::boolean, false) = true
    AND coalesce(r.plan->>'purpose', 'master') = 'master'
  ORDER BY r.finished_at DESC NULLS LAST, r.created_at DESC LIMIT 1;
  IF v_render.id IS NULL THEN RAISE EXCEPTION 'No successful QC-approved master exists for this running sheet'; END IF;

  SELECT artifact INTO v_master
  FROM jsonb_array_elements(coalesce(v_render.artifacts, '[]'::jsonb)) artifact
  WHERE artifact->>'kind' = 'master' LIMIT 1;
  IF v_master IS NULL OR coalesce(v_master->>'url', '') = '' OR coalesce(v_master->>'sha256', '') = '' THEN
    RAISE EXCEPTION 'The approved render has no verifiable master artifact';
  END IF;

  RETURN jsonb_build_object(
    'episode_id', p_episode_id, 'manifest_checksum', p_manifest_checksum,
    'render_job_id', v_render.id, 'master_url', v_master->>'url',
    'master_sha256', v_master->>'sha256', 'master_filename', v_master->>'filename'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.totp_admin_log_production_event(uuid,text,text,jsonb,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.totp_admin_record_preflight_override(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.totp_admin_enqueue_rehearsal_render(uuid,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.totp_admin_save_episode_manifest(uuid,jsonb,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_admin_enqueue_render(uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.totp_complete_render_job_v2(uuid,text,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_fail_render_job_v2(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_assert_publishable_episode(uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.totp_admin_log_production_event(uuid,text,text,jsonb,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_record_preflight_override(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_enqueue_rehearsal_render(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_episode_manifest(uuid,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_enqueue_render(uuid,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.totp_complete_render_job_v2(uuid,text,jsonb,jsonb,jsonb,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_fail_render_job_v2(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.totp_assert_publishable_episode(uuid,text) TO service_role;
