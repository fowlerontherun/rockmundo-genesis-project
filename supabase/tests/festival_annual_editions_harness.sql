\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF to_regprocedure('public.complete_festival_setup_with_edition(uuid,integer,jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'missing atomic setup RPC'; END IF;
 IF to_regprocedure('public.plan_next_festival_edition(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'missing next-edition RPC'; END IF;
 IF to_regprocedure('public.rockmundo_game_year(timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'missing game-year authority'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='festival_editions_v2' AND indexname='festival_editions_v2_one_live_year' AND indexdef LIKE '%WHERE (status <> ''cancelled''%') THEN RAISE EXCEPTION 'missing non-cancelled year uniqueness'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='festival_editions_v2' AND grantee='authenticated' AND privilege_type IN('INSERT','UPDATE','DELETE')) THEN RAISE EXCEPTION 'browser has direct edition writes'; END IF;
 IF (SELECT count(*) FROM (VALUES('festival_site_plans'),('festival_ticket_plans'),('festival_artist_programmes'),('festival_operations_plans'),('festival_sponsorship_plans'),('festival_timetable_plans')) t(n) WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.n AND c.column_name='festival_edition_id'))>0 THEN RAISE EXCEPTION 'planning root missing edition scope'; END IF;
 IF to_regclass('public.festival_edition_migration_review') IS NULL OR to_regclass('public.festival_edition_migration_summary') IS NULL THEN RAISE EXCEPTION 'missing migration evidence'; END IF;
END $$;
ROLLBACK;
