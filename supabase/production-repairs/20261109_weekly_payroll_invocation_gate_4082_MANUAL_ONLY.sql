-- #4082: manually approved, zero-payout hardening of the deployed weekly payroll RPC.
-- This is NOT a normal Supabase migration. Review a fresh backup/PITR restore
-- and run on staging before executing against production. It does not pay wages,
-- change balances, replay history, activate jobs, or read any Vault credentials.
-- Execution MUST be outside Saturday 10:00 UTC payroll and by the database owner.
--
-- The 17 October 2026 gameplay-treasury implementation superseded the earlier
-- unused financial_accounts-based payroll migration. Preserve its money logic:
-- this script wraps the existing function rather than substituting a new payer.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  v_core text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Only the postgres database owner can install the payroll gate'
      USING ERRCODE = '42501';
  END IF;

  IF to_regprocedure('public.process_weekly_band_payroll_core_4082()') IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll gate core already exists; manual review required'
      USING ERRCODE = '55000';
  END IF;

  IF to_regprocedure('public.process_weekly_band_payroll()') IS NULL
     OR to_regclass('public.band_weekly_payroll_settlements') IS NULL THEN
    RAISE EXCEPTION 'Expected deployed gameplay payroll and settlement table missing'
      USING ERRCODE = '55000';
  END IF;

  SELECT pg_get_functiondef('public.process_weekly_band_payroll()'::regprocedure)
    INTO v_core;
  IF position('FROM public.band_treasuries' IN v_core) = 0
     OR position('INSERT INTO public.band_weekly_payroll_settlements' IN v_core) = 0
     OR position('INSERT INTO public.band_earnings' IN v_core) = 0
     OR position('UPDATE public.profiles SET cash' IN v_core) = 0 THEN
    RAISE EXCEPTION 'Payroll implementation differs from reviewed gameplay version'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT count(*) FROM cron.job WHERE jobname = 'process-weekly-band-pay') <> 1
     OR NOT EXISTS (
       SELECT 1 FROM cron.job
       WHERE jobname = 'process-weekly-band-pay'
         AND username = 'postgres'
         AND active IS TRUE
         AND schedule = '0 10 * * 6'
         AND btrim(command) ~* '^SELECT[[:space:]]+public[.]process_weekly_band_payroll[(][)][[:space:]]*;?[[:space:]]*$'
         AND command NOT ILIKE '%http%'
         AND command !~* 'bearer[[:space:]]+|eyJ[A-Za-z0-9_-]{20,}'
     ) THEN
    RAISE EXCEPTION 'Payroll scheduler identity or routing differs from reviewed baseline'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT count(*) FROM cron.job
      WHERE command ILIKE '%process_weekly_band_payroll%') <> 1 THEN
    RAISE EXCEPTION 'Multiple payroll schedule references found; aborting'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

-- No data writes; the existing function keeps its atomic per-band settlements.
ALTER FUNCTION public.process_weekly_band_payroll()
  RENAME TO process_weekly_band_payroll_core_4082;

-- Deny API callers direct access to either the core implementation or wrapper.
REVOKE ALL ON FUNCTION public.process_weekly_band_payroll_core_4082()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.process_weekly_band_payroll()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $payroll_gate$
BEGIN
  -- pg_cron job #76 is owned and executed by postgres. Never grant this
  -- privileged payout entry point to the REST service role or any player.
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only the database-owned payroll scheduler may invoke payroll'
      USING ERRCODE = '42501';
  END IF;
  -- Saturday is UTC regardless of the DB session timezone. Manual weekday
  -- calls cannot issue an early payout even with a trusted DB connection.
  IF EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC')) <> 6 THEN
    RETURN jsonb_build_object('status', 'outside_schedule', 'paid_bands', 0);
  END IF;
  RETURN public.process_weekly_band_payroll_core_4082();
END;
$payroll_gate$;

REVOKE ALL ON FUNCTION public.process_weekly_band_payroll()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.process_weekly_band_payroll() IS
  '#4082 guarded Saturday-only entry point; cron postgres ownership required; no API execute grants';

DO $postflight$
BEGIN
  IF has_function_privilege('anon', 'public.process_weekly_band_payroll()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_weekly_band_payroll()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.process_weekly_band_payroll()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.process_weekly_band_payroll_core_4082()', 'EXECUTE')
     OR NOT has_function_privilege('postgres', 'public.process_weekly_band_payroll()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Payroll postflight EXECUTE ACL check failed'
      USING ERRCODE = '55000';
  END IF;
END;
$postflight$;
COMMIT;

-- Do not invoke either payroll function as an installation check.
-- Verify read-only ACLs and wait for the next natural Saturday window.
