\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE sample jsonb:=jsonb_build_object('schemaVersion','festival-runtime-outcome-v2','runtimeSessionId',gen_random_uuid(),'performances','[]'::jsonb); BEGIN
  PERFORM public.assert_festival_runtime_outcome_v2(sample);
  BEGIN PERFORM public.assert_festival_runtime_outcome_v2(sample||jsonb_build_object('schemaVersion','festival-runtime-outcome-v1')); RAISE EXCEPTION 'unsupported schema accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'festival_runtime_outcome_schema_unsupported' THEN RAISE; END IF; END;
  IF to_regprocedure('public.prepare_festival_settlement(uuid,integer,uuid)') IS NULL OR to_regprocedure('public.generate_festival_result(uuid)') IS NULL THEN RAISE EXCEPTION 'cross-phase consumer missing'; END IF;
END $$;
ROLLBACK;
