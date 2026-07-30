\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_setting('app.is_disposable_test_database',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Refusing non-disposable database'; END IF;
  IF to_regclass('public.festival_stages') IS NULL OR to_regclass('public.festival_stage_slots') IS NULL THEN RAISE EXCEPTION 'canonical scheduling tables missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='festival_stage_slots_occupancy_no_overlap') THEN RAISE EXCEPTION 'concurrent overlap protection missing'; END IF;
  IF has_table_privilege('authenticated','public.festival_stages','INSERT') OR has_table_privilege('authenticated','public.festival_stage_slots','UPDATE') THEN RAISE EXCEPTION 'authenticated direct scheduling writes remain'; END IF;
  IF to_regprocedure('public.legacy_festival_generate_edition_slots(uuid,text)') IS NULL THEN RAISE EXCEPTION 'server slot generation RPC missing'; END IF;
  IF to_regprocedure('public.festival_schedule_publish(uuid,uuid,boolean,text)') IS NULL THEN RAISE EXCEPTION 'publication RPC missing'; END IF;
END $$;
ROLLBACK;
