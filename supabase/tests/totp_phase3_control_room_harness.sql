-- Top of the Pops Phase 3 production/rehearsal release gate.
-- Intentionally introspective: this runs after a clean local db reset and fails
-- if a later migration weakens the release contract.

BEGIN;

DO $$
DECLARE
  v_def text;
  v_constraint text;
BEGIN
  IF to_regprocedure('public.totp_admin_enqueue_rehearsal_render(uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Phase 3 rehearsal enqueue RPC is missing';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.totp_production_audit'::regclass
    AND conname = 'totp_production_audit_event_kind_check';

  IF v_constraint NOT LIKE '%override%'
     OR v_constraint NOT LIKE '%rerender%'
     OR v_constraint NOT LIKE '%replacement%' THEN
    RAISE EXCEPTION 'Production audit event kinds do not cover Phase 3 editorial actions: %', v_constraint;
  END IF;

  SELECT pg_get_functiondef('public.totp_admin_log_production_event(uuid,text,text,jsonb,boolean,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%owned by the production pipeline%' THEN
    RAISE EXCEPTION 'Browser audit RPC can forge pipeline-owned rehearsal/render events';
  END IF;

  SELECT pg_get_functiondef('public.totp_admin_record_preflight_override(uuid,text,text,text,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%Blocking preflight failures cannot be overridden%' THEN
    RAISE EXCEPTION 'Blocking preflight failures can be silently overridden';
  END IF;

  SELECT pg_get_functiondef('public.totp_admin_save_episode_manifest(uuid,jsonb,jsonb,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%QC-approved full rehearsal render is required before sign-off%'
     OR v_def NOT LIKE '%plan->>''purpose'' = ''rehearsal''%' THEN
    RAISE EXCEPTION 'Production sign-off is not gated on a QC rehearsal render';
  END IF;

  SELECT pg_get_functiondef('public.totp_admin_enqueue_render(uuid,text,jsonb)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%QC-approved full rehearsal render is required before rendering%'
     OR v_def NOT LIKE '%Broadcast sign-off for this running sheet is required before rendering%' THEN
    RAISE EXCEPTION 'Master render can bypass rehearsal or sign-off';
  END IF;

  SELECT pg_get_functiondef('public.totp_complete_render_job_v2(uuid,text,jsonb,jsonb,jsonb,text,text,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%v_purpose = ''master''%'
     OR v_def NOT LIKE '%QC rehearsal render passed%'
     OR v_def NOT LIKE '%frozen running sheet changed%' THEN
    RAISE EXCEPTION 'Render completion lost purpose-aware/frozen-manifest release protection';
  END IF;

  SELECT pg_get_functiondef('public.totp_assert_publishable_episode(uuid,text)'::regprocedure)
  INTO v_def;
  IF v_def NOT LIKE '%QC-approved full rehearsal render is required before publishing%'
     OR v_def NOT LIKE '%coalesce(r.plan->>''purpose'', ''master'') = ''master''%' THEN
    RAISE EXCEPTION 'External publishing is not restricted to a QC master after rehearsal';
  END IF;

  IF has_function_privilege('anon', 'public.totp_admin_enqueue_rehearsal_render(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.totp_admin_record_preflight_override(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users must not execute Phase 3 production RPCs';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.totp_admin_enqueue_rehearsal_render(uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.totp_admin_record_preflight_override(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated admins need Data API access to Phase 3 production RPCs';
  END IF;

  IF has_function_privilege('authenticated', 'public.totp_complete_render_job_v2(uuid,text,jsonb,jsonb,jsonb,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.totp_fail_render_job_v2(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Browser clients must not complete or fail render-worker jobs';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'totp_render_jobs'
      AND indexname = 'totp_render_jobs_active_idx'
      AND indexdef LIKE '%UNIQUE INDEX%'
  ) THEN
    RAISE EXCEPTION 'One-active-render-per-episode uniqueness gate is missing';
  END IF;
END;
$$;

ROLLBACK;
