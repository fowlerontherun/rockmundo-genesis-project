-- Club revenue logs must never be writable by unauthenticated or player clients.
BEGIN;
DO $check$
DECLARE before_rows bigint; service_writer boolean;
BEGIN
 SELECT count(*) INTO before_rows FROM public.nightclub_revenue_log;
 IF has_table_privilege('anon','public.nightclub_revenue_log','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_revenue_log','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_revenue_log','UPDATE')
 OR has_table_privilege('authenticated','public.nightclub_revenue_log','DELETE')
 OR NOT has_table_privilege('authenticated','public.nightclub_revenue_log','SELECT') THEN
  RAISE EXCEPTION 'Browser still has unsafe nightclub ledger privileges';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nightclub_revenue_log'
    AND cmd IN ('INSERT','ALL') AND policyname='Players can insert revenue for own clubs') THEN
  RAISE EXCEPTION 'Legacy player revenue INSERT policy remains';
 END IF;
 service_writer:=has_table_privilege('service_role','public.nightclub_revenue_log','INSERT');
 IF NOT service_writer THEN
  RAISE EXCEPTION 'Trusted service role lost nightclub ledger write permission';
 END IF;
 IF (SELECT count(*) FROM public.nightclub_revenue_log)<>before_rows THEN
  RAISE EXCEPTION 'Ledger rows changed during permission hardening'; END IF;
 RAISE NOTICE 'Revenue ledger client-write lock and trusted server access passed';
END $check$;
ROLLBACK;