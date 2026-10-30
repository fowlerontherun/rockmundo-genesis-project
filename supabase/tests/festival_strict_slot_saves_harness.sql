\set ON_ERROR_STOP on
-- Run after applying the reviewed schedule guard, no writes to existing slots.
BEGIN;
DO $check$
BEGIN
 IF to_regclass('private.festival_schedule_slot_upsert_receipts') IS NULL
 THEN RAISE EXCEPTION 'festival_schedule_receipt_table_missing'; END IF;
 IF to_regprocedure('public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)') IS NULL
 THEN RAISE EXCEPTION 'festival_schedule_upsert_rpc_missing'; END IF;
 IF has_table_privilege('anon','private.festival_schedule_slot_upsert_receipts','SELECT')
    OR has_table_privilege('authenticated','private.festival_schedule_slot_upsert_receipts','INSERT')
 THEN RAISE EXCEPTION 'festival_schedule_receipt_exposure'; END IF;
 IF has_function_privilege('anon','public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'festival_schedule_rpc_permissions_invalid'; END IF;
 IF pg_get_functiondef('public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)'::regprocedure)
    NOT ILIKE '%FESTIVAL_SCHEDULE_EXPLICIT_TIMEZONE_REQUIRED%'
 THEN RAISE EXCEPTION 'festival_schedule_timezone_guard_missing'; END IF;
END;
$check$;
ROLLBACK;
