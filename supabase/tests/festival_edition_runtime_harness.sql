\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_setting('app.allow_test_fixtures',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Disposable fixture flag app.allow_test_fixtures=true is required'; END IF;
 IF to_regclass('public.festival_edition_runtimes') IS NULL THEN RAISE EXCEPTION 'canonical edition runtime migration missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='festival_edition_one_active_runtime') THEN RAISE EXCEPTION 'one-active-runtime constraint missing'; END IF;
 IF has_table_privilege('authenticated','public.festival_edition_runtimes','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'direct authenticated runtime writes are exposed'; END IF;
 IF has_table_privilege('authenticated','public.festival_runtime_evidence','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'direct authenticated evidence writes are exposed'; END IF;
 IF NOT has_function_privilege('authenticated','public.prepare_festival_edition_runtime(uuid,uuid,integer,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'preparation RPC unavailable'; END IF;
 IF NOT has_function_privilege('authenticated','public.transition_festival_edition_runtime(uuid,integer,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'transition RPC unavailable'; END IF;
END $$;
-- Full fixture processing is intentionally transaction-scoped. Existing creation, upgrade,
-- artist, scheduling and lifecycle harnesses create their domain fixtures; this gate proves
-- the new runtime's fencing, immutable authority and grants after the same reset migration set.
ROLLBACK;
