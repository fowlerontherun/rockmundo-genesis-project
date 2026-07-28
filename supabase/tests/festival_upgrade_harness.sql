\set ON_ERROR_STOP on
BEGIN;
DO $$DECLARE n int;bad int;BEGIN
 SELECT count(*) INTO n FROM public.festival_upgrade_categories WHERE active; IF n<>11 THEN RAISE EXCEPTION 'expected 11 categories, got %',n; END IF;
 SELECT count(*) INTO bad FROM (SELECT c.key FROM public.festival_upgrade_categories c LEFT JOIN public.festival_upgrade_levels l ON l.category_key=c.key AND l.catalogue_version=1 AND l.active WHERE c.active GROUP BY c.key HAVING count(l.level)<>5 OR min(l.level)<>1 OR max(l.level)<>5) q; IF bad<>0 THEN RAISE EXCEPTION 'catalogue level coverage failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_upgrade_levels a JOIN public.festival_upgrade_levels b ON b.catalogue_version=a.catalogue_version AND b.category_key=a.category_key AND b.level=a.level+1 WHERE b.purchase_cost_minor<a.purchase_cost_minor OR b.weekly_upkeep_minor<a.weekly_upkeep_minor) THEN RAISE EXCEPTION 'non-monotonic price/upkeep'; END IF;
 IF (SELECT count(*) FROM public.festival_licence_tiers WHERE active)<>5 THEN RAISE EXCEPTION 'licence tier coverage failed';END IF;
END$$;
-- Full authenticated purchase/replay/concurrency/upkeep/snapshot fixture is intentionally run by the disposable DB gate,
-- which supplies auth users and funded company accounts. Never point it at a shared or production database.
ROLLBACK;
