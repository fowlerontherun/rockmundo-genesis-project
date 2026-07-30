\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE tables_missing integer; mutation text; helper text;
BEGIN
 SELECT count(*) INTO tables_missing FROM (VALUES
 ('festival_edition_settlements'),('festival_edition_settlement_lines'),('festival_edition_posting_batches'),('festival_edition_posting_items'),('festival_edition_settlement_outcomes'),('festival_edition_history_snapshots')) x(name)
 WHERE to_regclass('public.'||name) IS NULL;
 IF tables_missing<>0 THEN RAISE EXCEPTION 'settlement harness: schema objects missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='festival_edition_one_active_settlement') THEN RAISE EXCEPTION 'settlement harness: one-active-edition constraint missing'; END IF;
 IF to_regprocedure('public.post_festival_edition_settlement(uuid,integer,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'settlement harness: retired bulk posting RPC exists'; END IF;
 FOREACH mutation IN ARRAY ARRAY['prepare_festival_edition_settlement(uuid,text,uuid)','approve_festival_edition_settlement(uuid,integer,uuid)','start_festival_edition_settlement_posting(uuid,integer,uuid)','post_next_festival_edition_settlement_item(uuid,uuid)','finalise_festival_edition_settlement_posting(uuid,uuid)','receive_festival_settlement_receivable(uuid,uuid)','pay_festival_settlement_payable(uuid,uuid)','write_off_festival_settlement_receivable(uuid,uuid)','cancel_festival_settlement_payable(uuid,uuid)','apply_festival_edition_outcomes(uuid,integer,uuid)','finalise_festival_edition_settlement(uuid,integer,uuid)'] LOOP
  IF has_function_privilege('anon','public.'||mutation,'EXECUTE') THEN RAISE EXCEPTION 'settlement harness: anon can execute %',mutation; END IF;
  IF NOT has_function_privilege('authenticated','public.'||mutation,'EXECUTE') THEN RAISE EXCEPTION 'settlement harness: authenticated missing %',mutation; END IF;
 END LOOP;
 FOREACH helper IN ARRAY ARRAY['_festival_edition_settlement_error(text,jsonb)','_festival_edition_settlement_authorised(uuid)','_festival_settlement_request(uuid,uuid,text,uuid,jsonb,uuid)','_refresh_festival_edition_posting_totals(uuid)','_festival_settlement_obligation(uuid,uuid,text)','_festival_apply_outcomes(uuid)','_festival_history_immutable()'] LOOP
  IF has_function_privilege('authenticated','public.'||helper,'EXECUTE') OR has_function_privilege('anon','public.'||helper,'EXECUTE') THEN RAISE EXCEPTION 'settlement harness: helper exposed %',helper; END IF;
 END LOOP;
 IF NOT has_function_privilege('anon','public.get_public_festival_edition_history(uuid)','EXECUTE') THEN RAISE EXCEPTION 'settlement harness: public immutable history unavailable'; END IF;
 IF has_table_privilege('authenticated','public.festival_edition_settlement_lines','INSERT') THEN RAISE EXCEPTION 'settlement harness: browser can write lines'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_history_immutable' AND tgenabled<>'D') THEN RAISE EXCEPTION 'settlement harness: history immutability trigger missing'; END IF;
END $$;
-- Scenario-level preparation/post/recovery is exercised by the full disposable
-- lifecycle fixture; this gate independently prevents accidental privilege,
-- uniqueness and immutability regressions.
ROLLBACK;
