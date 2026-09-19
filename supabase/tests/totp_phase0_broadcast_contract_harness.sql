-- Top of the Pops Phase 0 broadcast contract and lifecycle gate.
-- Runs only against a migrated local/test database.

BEGIN;

DO $$
DECLARE
  v_type text;
  v_nullable text;
  v_definition text;
BEGIN
  SELECT data_type, is_nullable
  INTO v_type, v_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'totp_episode_plans'
    AND column_name = 'broadcast_rights';

  IF v_type <> 'jsonb' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION 'totp_episode_plans.broadcast_rights must be NOT NULL jsonb';
  END IF;

  SELECT data_type, is_nullable
  INTO v_type, v_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'totp_episode_plans'
    AND column_name = 'presenter_audio';

  IF v_type <> 'jsonb' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION 'totp_episode_plans.presenter_audio must be NOT NULL jsonb';
  END IF;

  SELECT pg_get_functiondef('public.totp_admin_save_episode_plan(uuid,jsonb)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%broadcast_rights%' OR v_definition NOT LIKE '%presenter_audio%' THEN
    RAISE EXCEPTION 'episode plan save RPC no longer persists the broadcast contract';
  END IF;
END;
$$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.totp_admin_save_episode_manifest(uuid,jsonb,jsonb,text)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%render/publish pipeline%' THEN
    RAISE EXCEPTION 'browser/admin callers can again assert rendered/published production states';
  END IF;
  IF v_definition NOT LIKE '%passing rights and safety screening%' THEN
    RAISE EXCEPTION 'production-ready sign-off no longer requires current compliance';
  END IF;
END;
$$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.totp_admin_enqueue_render(uuid,text,jsonb)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%passing rights and safety screening%'
     OR v_definition NOT LIKE '%open takedowns%'
     OR v_definition NOT LIKE '%passing rehearsal%'
     OR v_definition NOT LIKE '%Broadcast sign-off%' THEN
    RAISE EXCEPTION 'render queue lost one or more Phase 0 release gates';
  END IF;
END;
$$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.totp_complete_render_job(uuid,jsonb,jsonb)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%master artifact URL/hash is missing%' THEN
    RAISE EXCEPTION 'render completion no longer requires a verifiable master';
  END IF;

  IF has_function_privilege('anon', 'public.totp_complete_render_job(uuid,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.totp_complete_render_job(uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'render completion must remain service-role only';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.totp_complete_render_job(uuid,jsonb,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'render worker service role cannot complete render jobs';
  END IF;
END;
$$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.totp_assert_publishable_episode(uuid,text)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%rendered_master%'
     OR v_definition NOT LIKE '%takedown%'
     OR v_definition NOT LIKE '%rehearsal%'
     OR v_definition NOT LIKE '%master_sha256%' THEN
    RAISE EXCEPTION 'external publish gate is incomplete';
  END IF;

  IF has_function_privilege('anon', 'public.totp_assert_publishable_episode(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.totp_assert_publishable_episode(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'external publish gate must remain service-role only';
  END IF;
END;
$$;

DO $$
DECLARE
  v_runner text;
  v_complete text;
  v_archive text;
BEGIN
  SELECT pg_get_functiondef('public.totp_run_broadcast_cycle(timestamp with time zone)'::regprocedure)
  INTO v_runner;
  SELECT pg_get_functiondef('public.totp_complete_performance(uuid,integer)'::regprocedure)
  INTO v_complete;
  SELECT pg_get_functiondef('public.totp_public_broadcast_archive(uuid)'::regprocedure)
  INTO v_archive;

  IF v_runner NOT LIKE '%pg_advisory_xact_lock%'
     OR v_runner NOT LIKE '%totp_admin_lock_running_order%'
     OR v_runner NOT LIKE '%totp_build_episode_broadcast_replays%'
     OR v_runner NOT LIKE '%totp_complete_performance%' THEN
    RAISE EXCEPTION 'broadcast lifecycle runner lost its concurrency/lifecycle contract';
  END IF;

  IF v_complete NOT LIKE '%already_completed%'
     OR v_complete NOT LIKE '%totp_appearance_history%' THEN
    RAISE EXCEPTION 'performance settlement lost its idempotency guard';
  END IF;

  IF v_archive NOT LIKE '%status = ''broadcast''%'
     OR v_archive NOT LIKE '%make_interval%' THEN
    RAISE EXCEPTION 'live replay visibility/spoiler gate is missing';
  END IF;
END;
$$;

ROLLBACK;
