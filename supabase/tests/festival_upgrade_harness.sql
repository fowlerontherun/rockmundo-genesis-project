\set ON_ERROR_STOP on
BEGIN;
DO $$DECLARE n int;bad int;v1_hash text;BEGIN
 SELECT count(*) INTO n FROM public.festival_upgrade_categories WHERE active; IF n<>11 THEN RAISE EXCEPTION 'expected 11 categories, got %',n; END IF;
 IF (SELECT count(*) FROM public.festival_upgrade_levels WHERE catalogue_version=1)<>55 THEN RAISE EXCEPTION 'historical v1 changed'; END IF;
 IF (SELECT count(*) FROM public.festival_upgrade_levels WHERE catalogue_version=2 AND active)<>550 THEN RAISE EXCEPTION 'expected 550 active v2 rows'; END IF;
 SELECT count(*) INTO bad FROM (SELECT c.key FROM public.festival_upgrade_categories c LEFT JOIN public.festival_upgrade_levels l ON l.category_key=c.key AND l.catalogue_version=2 AND l.active WHERE c.active GROUP BY c.key HAVING count(l.level)<>50 OR min(l.level)<>1 OR max(l.level)<>50 OR count(distinct l.level)<>50) q; IF bad<>0 THEN RAISE EXCEPTION 'catalogue level coverage failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_upgrade_levels a JOIN public.festival_upgrade_levels b ON b.catalogue_version=a.catalogue_version AND b.category_key=a.category_key AND b.level=a.level+1 WHERE b.purchase_cost_minor<a.purchase_cost_minor OR b.weekly_upkeep_minor<a.weekly_upkeep_minor) THEN RAISE EXCEPTION 'non-monotonic price/upkeep'; END IF;
 IF (SELECT count(*) FROM public.festival_licence_tiers WHERE active)<>5 THEN RAISE EXCEPTION 'licence tier coverage failed';END IF;
 IF public._festival_effective_level(50,50,4)<>40 OR public._festival_effective_level(9,9,4)<>0 OR public._festival_effective_level(37,37,4)<>27 OR public._festival_effective_level(40,30,4)<>30 THEN RAISE EXCEPTION 'delinquency compatibility failed'; END IF;
 IF (public._festival_upgrade_purchase_window(gen_random_uuid(),now())->>'remaining')::int<>2 THEN RAISE EXCEPTION 'empty rolling window failed'; END IF;
END$$;
-- The disposable gate is the only supported execution target. Transactional purchase,
-- replay, finance, exact-boundary, concurrent-session and locked-edition fixtures are
-- seeded by CI before this harness; this file never manufactures production identities.
ROLLBACK;
