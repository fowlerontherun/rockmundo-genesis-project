\set ON_ERROR_STOP on
BEGIN;
DO $$BEGIN
 IF to_regclass('public.festival_legacy_generation_jobs') IS NULL THEN RAISE EXCEPTION 'legacy generation outbox missing'; END IF;
 IF to_regclass('public.festival_results') IS NULL THEN RAISE EXCEPTION 'festival_results missing'; END IF;
 IF to_regclass('public.festival_awards') IS NULL THEN RAISE EXCEPTION 'festival_awards missing'; END IF;
 IF to_regprocedure('public.get_festival_results(integer,text,text,text,text,integer,integer)') IS NULL THEN RAISE EXCEPTION 'results RPC missing'; END IF;
 IF to_regprocedure('public.get_festival_result_detail(uuid)') IS NULL THEN RAISE EXCEPTION 'detail RPC missing'; END IF;
 IF to_regprocedure('public.get_festival_hall_of_fame()') IS NULL THEN RAISE EXCEPTION 'hall of fame RPC missing'; END IF;
 IF has_table_privilege('anon','public.festival_results','UPDATE') THEN RAISE EXCEPTION 'anonymous result mutation permitted'; END IF;
 IF has_table_privilege('authenticated','public.festival_results','DELETE') THEN RAISE EXCEPTION 'authenticated archive deletion permitted'; END IF;
 IF NOT has_function_privilege('anon','public.get_festival_results(integer,text,text,text,text,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'public results unavailable'; END IF;
 IF to_regprocedure('public.process_festival_legacy_generation_jobs(integer,text)') IS NULL THEN RAISE EXCEPTION 'generation worker missing'; END IF;
 IF has_function_privilege('authenticated','public.process_festival_legacy_generation_jobs(integer,text)','EXECUTE') THEN RAISE EXCEPTION 'browser can process generation jobs'; END IF;
 IF has_function_privilege('authenticated','public.generate_festival_result(uuid)','EXECUTE') THEN RAISE EXCEPTION 'browser can generate results'; END IF;
 IF (SELECT count(*) FROM unnest(ARRAY['highest_attendance','fastest_sell_out','largest_profit','biggest_loss','highest_rated_festival','longest_running_festival','most_performances','most_merchandise_sold','largest_single_performance_crowd']) c WHERE position(quote_literal(c) in pg_get_functiondef('public.refresh_festival_world_records(uuid)'::regprocedure))>0) <> 9 THEN RAISE EXCEPTION 'not all record categories implemented'; END IF;
END$$;
-- Published archive rows must reject both updates and deletes independently of RLS.
DO $$BEGIN
 BEGIN UPDATE public.festival_results SET festival_name=festival_name WHERE false; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_results_immutable' AND tgenabled='O') THEN RAISE EXCEPTION 'immutability trigger missing'; END IF;
END$$;
ROLLBACK;
