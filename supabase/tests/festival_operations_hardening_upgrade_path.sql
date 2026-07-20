-- Regression harness for upgrading a database that had already applied
-- 20291217100000 before the hardening was moved into a forward migration.
-- Run after migrations are applied with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f this_file

DO $$
DECLARE
  v_internal_comment text;
  v_rpc_comment text;
  v_helper_sql text;
  v_summary_sql text;
BEGIN
  IF to_regprocedure('public.can_manage_festival_edition(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy two-argument can_manage_festival_edition helper still exists after hardening migration';
  END IF;

  IF to_regprocedure('public.can_manage_festival_edition(uuid)') IS NULL THEN
    RAISE EXCEPTION 'single-argument can_manage_festival_edition helper missing after hardening migration';
  END IF;

  IF to_regprocedure('public.can_manage_festival_edition_internal(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'explicit actor internal helper missing after hardening migration';
  END IF;

  IF has_function_privilege('authenticated','public.can_manage_festival_edition_internal(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute explicit actor internal helper';
  END IF;

  IF NOT has_function_privilege('service_role','public.can_manage_festival_edition_internal(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute explicit actor internal helper';
  END IF;

  SELECT obj_description('public.festival_edition_operations_summary(uuid)'::regprocedure, 'pg_proc') INTO v_rpc_comment;
  IF v_rpc_comment NOT LIKE '%20291217110000%' THEN
    RAISE EXCEPTION 'latest forward migration is not documented as authoritative: %', v_rpc_comment;
  END IF;

  SELECT obj_description('public.can_manage_festival_edition_internal(uuid,uuid,uuid)'::regprocedure, 'pg_proc') INTO v_internal_comment;
  IF v_internal_comment NOT LIKE '%without caller-based service-role bypass%' THEN
    RAISE EXCEPTION 'internal helper semantics are not documented accurately: %', v_internal_comment;
  END IF;

  SELECT pg_get_functiondef('public.can_manage_festival_edition_internal(uuid,uuid,uuid)'::regprocedure) INTO v_helper_sql;
  IF v_helper_sql LIKE '%is_service_role%' THEN
    RAISE EXCEPTION 'internal helper still bypasses actor evaluation for service role callers';
  END IF;

  SELECT pg_get_functiondef('public.festival_edition_operations_summary_internal(uuid)'::regprocedure) INTO v_summary_sql;
  IF v_summary_sql LIKE '%simulated_ticket%' THEN
    RAISE EXCEPTION 'unused simulated_ticket CTE remains in authoritative summary';
  END IF;
  IF v_summary_sql NOT LIKE '%ELSE ''[]''::jsonb END%' THEN
    RAISE EXCEPTION 'insurance denied branch does not return an empty policy array';
  END IF;
  IF v_summary_sql NOT LIKE '%''status'',sl.status%' OR v_summary_sql NOT LIKE '%''public_status'',sl.public_status%' OR v_summary_sql NOT LIKE '%''slot_number'',sl.slot_number%' OR v_summary_sql NOT LIKE '%''changeover_minutes'',sl.changeover_minutes%' THEN
    RAISE EXCEPTION 'slot projection is missing required operational contract fields';
  END IF;
  IF v_summary_sql NOT LIKE '%^[0-9]{1,10}$%' OR v_summary_sql NOT LIKE '%2147483647%' THEN
    RAISE EXCEPTION 'safe integer parser is not bounded against overflow';
  END IF;
END $$;
