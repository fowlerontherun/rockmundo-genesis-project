-- #4072 finance authority protection: prevent API clients from invoking prize settlement.
-- Does not execute Battle of the Bands, change balances, or alter the cron schedule.
DO $gate$
DECLARE
  v_name text;
  v_oid oid;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['public.generate_botb_events(integer)',
                                 'public.resolve_botb_event(uuid)',
                                 'public.run_botb_cycle()']
  LOOP
    v_oid:=to_regprocedure(v_name)::oid;
    IF v_oid IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid=v_oid AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
      ) THEN
      RAISE EXCEPTION 'BOTB_PRIVILEGED_FUNCTION_DRIFT: %', v_name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM cron.job
      WHERE jobname='run-battle-of-the-bands'
        AND username='postgres'
        AND active AND command ILIKE '%public.run_botb_cycle()%')<>1
  THEN RAISE EXCEPTION 'BOTB_SCHEDULER_DEPENDENCY_CHANGED'; END IF;
END;
$gate$;

REVOKE ALL ON FUNCTION public.generate_botb_events(integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolve_botb_event(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_botb_cycle()
  FROM PUBLIC,anon,authenticated;

-- Preserve legitimate server-side/cron ownership and service-worker access.
GRANT EXECUTE ON FUNCTION public.generate_botb_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_botb_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role;