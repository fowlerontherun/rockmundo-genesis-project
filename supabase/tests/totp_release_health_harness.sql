-- Top of the Pops operational release gate.
-- Run against a migrated test database; each assertion fails loudly when the
-- broadcast lifecycle or its service permissions drift.

BEGIN;

DO $$
DECLARE
  v_definition text;
  v_health jsonb;
BEGIN
  SELECT pg_get_functiondef('public.totp_release_health()'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'totp_release_health must remain SECURITY DEFINER';
  END IF;

  IF has_function_privilege('anon', 'public.totp_release_health()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute totp_release_health';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.totp_release_health()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated admins need Data API access to totp_release_health';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.totp_release_health()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role needs access to totp_release_health';
  END IF;

  v_health := public.totp_release_health();
  IF NOT v_health ?& ARRAY['healthy', 'chart', 'next_episode', 'crons', 'invalid_totp_notifications', 'checked_at'] THEN
    RAISE EXCEPTION 'totp_release_health response contract is incomplete: %', v_health;
  END IF;

  IF NOT (v_health->'chart') ?& ARRAY['latest_date', 'fresh', 'streaming_rows', 'digital_rows'] THEN
    RAISE EXCEPTION 'TOTP chart health contract is incomplete: %', v_health->'chart';
  END IF;

  IF NOT (v_health->'crons') ?& ARRAY['prepare', 'uk_chart_refresh', 'broadcast_cycle'] THEN
    RAISE EXCEPTION 'TOTP cron health contract is incomplete: %', v_health->'crons';
  END IF;
END;
$$;

DO $$
DECLARE
  v_runner text;
BEGIN
  SELECT pg_get_functiondef('public.totp_run_broadcast_cycle(timestamp with time zone)'::regprocedure)
  INTO v_runner;

  IF v_runner NOT LIKE '%pg_advisory_xact_lock%' THEN
    RAISE EXCEPTION 'TOTP broadcast runner lost its concurrency lock';
  END IF;

  IF v_runner NOT LIKE '%totp_build_episode_broadcast_replays%' THEN
    RAISE EXCEPTION 'TOTP broadcast runner no longer creates immutable replays';
  END IF;

  IF v_runner NOT LIKE '%totp_complete_performance%' THEN
    RAISE EXCEPTION 'TOTP broadcast runner no longer settles performances';
  END IF;
END;
$$;

ROLLBACK;