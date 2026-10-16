-- Read-only release preflight permissions and expiry check with rollback fixtures.
-- Executed only on a disposable PostgreSQL service.
BEGIN;
INSERT INTO public.player_owned_skins(profile_id,item_id,item_type,is_equipped)
VALUES (
 '10000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000001',
 'clothing',false
);
SET LOCAL ROLE service_role;
DO $$
DECLARE
 r jsonb;
BEGIN
 SELECT public.admin_halloween_2026_launch_preflight() INTO r;
 IF coalesce((r->>'database_ready')::boolean,false) IS NOT TRUE
  OR (r->>'characters')::integer<>2
  OR (r->>'characters_gifted')::integer<>2
  OR (r->>'event_enabled')::boolean IS NOT FALSE
  OR (r->>'rewards_armed')::boolean IS NOT FALSE
 THEN RAISE EXCEPTION 'Halloween server readiness unexpectedly failed: %',r; END IF;
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
 denied boolean := false;
BEGIN
 BEGIN
   PERFORM public.admin_halloween_2026_launch_preflight();
 EXCEPTION WHEN insufficient_privilege THEN
   denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Non-admin could read private Halloween preflight'; END IF;
END;
$$;
ROLLBACK;
