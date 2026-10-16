-- Production repair: 2026-10-16
-- Run only after deploying complete-recording-sessions with the Vault-backed
-- x-cron-secret gate and verify_jwt=false (the function verifies every request).
-- Applied to live Rockmundo on 2026-10-16. Included here for reproducibility.
--
-- Service secret-key calls use PostgreSQL role service_role but do not always
-- populate the legacy request.jwt.claim.role GUC. Check authenticated role
-- from all supported representations without granting untrusted roles access.

DO $recording_auth$
DECLARE
  v_fn regprocedure;
  v_ddl text;
  v_new text;
  v_auth_expression text :=
    'coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''), auth.jwt()->>''role'', nullif(current_setting(''role'',true),''none''))';
BEGIN
  FOR v_fn IN
    SELECT unnest(ARRAY[
      'public.claim_recording_completion(uuid)'::regprocedure,
      'public.release_recording_completion(uuid,uuid)'::regprocedure,
      'public.finalize_recording_completion(uuid,uuid)'::regprocedure,
      'public.award_recording_xp_atomic(uuid)'::regprocedure
    ])
  LOOP
    SELECT pg_get_functiondef(v_fn) INTO v_ddl;

    IF position('auth.jwt()->>''role''' IN v_ddl) = 0 THEN
      IF position('request.jwt.claim.role' IN v_ddl) = 0 THEN
        RAISE EXCEPTION 'Unknown recording role gate: %', v_fn;
      END IF;
      v_new := replace(
        replace(
          v_ddl,
          'current_setting(''request.jwt.claim.role'',true)',
          v_auth_expression
        ),
        'current_setting(''request.jwt.claim.role'', true)',
        v_auth_expression
      );
      IF v_new = v_ddl THEN RAISE EXCEPTION 'Did not patch role gate: %', v_fn; END IF;
      EXECUTE v_new;
    END IF;

    -- These functions are SECURITY DEFINER. Their only API caller must be
    -- service_role; authenticated/anon users may never mint recording claims
    -- or award XP, even if a later change accidentally broadens other policies.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'internal_cron_secret' AND length(decrypted_secret) >= 32
  ) THEN
    RAISE EXCEPTION 'Vault cron secret is unavailable';
  END IF;

  IF to_regprocedure('public.verify_internal_cron_secret(text)') IS NULL
     OR NOT has_function_privilege('service_role','public.verify_internal_cron_secret(text)','EXECUTE')
     OR has_function_privilege('anon','public.verify_internal_cron_secret(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.verify_internal_cron_secret(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Cron secret verifier is not safely restricted';
  END IF;
END
$recording_auth$;

-- Existing five-minute job, no plaintext JWT stored in cron.job. Resolve the
-- Vault secret only at execution time. Keep the existing job ID/schedule.
DO $recording_cron$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO STRICT v_job_id
    FROM cron.job WHERE jobname = 'complete-recording-sessions';

  PERFORM cron.alter_job(v_job_id, command := $job$
    SELECT net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-recording-sessions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'internal_cron_secret' LIMIT 1
        )
      ),
      body := jsonb_build_object('triggeredBy', 'pg_cron')
    );
  $job$);
END
$recording_cron$;
