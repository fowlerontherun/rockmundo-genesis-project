\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE tables_missing integer; execute_public boolean;
BEGIN
 SELECT count(*) INTO tables_missing FROM (VALUES
 ('festival_edition_settlements'),('festival_edition_settlement_lines'),('festival_edition_posting_batches'),('festival_edition_posting_items'),('festival_edition_settlement_outcomes'),('festival_edition_history_snapshots')) x(name)
 WHERE to_regclass('public.'||name) IS NULL;
 IF tables_missing<>0 THEN RAISE EXCEPTION 'settlement harness: schema objects missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='festival_edition_one_active_settlement') THEN RAISE EXCEPTION 'settlement harness: one-active-edition constraint missing'; END IF;
 SELECT has_function_privilege('public','public.post_festival_edition_settlement(uuid,integer,uuid)','EXECUTE') INTO execute_public;
 IF execute_public THEN RAISE EXCEPTION 'settlement harness: PUBLIC can post'; END IF;
 IF has_table_privilege('authenticated','public.festival_edition_settlement_lines','INSERT') THEN RAISE EXCEPTION 'settlement harness: browser can write lines'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_history_immutable' AND tgenabled<>'D') THEN RAISE EXCEPTION 'settlement harness: history immutability trigger missing'; END IF;
END $$;
-- Scenario-level preparation/post/recovery is exercised by the full disposable
-- lifecycle fixture; this gate independently prevents accidental privilege,
-- uniqueness and immutability regressions.
ROLLBACK;
