-- Safeguard the still-unreconciled October 12 underworld transaction
-- migration from direct Data API write bypasses. No payouts, arrests, purchases,
-- token trades, boosters or historical data changes are executed.
--
-- The frontend only SELECTs these tables. It uses:
--   trade_crypto_token: postgres-owned SECURITY DEFINER RPC;
--   gift_underworld_item: postgres-owned SECURITY DEFINER RPC;
--   dedicated underworld purchase/consume RPCs, still pending safe deployment.
-- Prison management Edge Functions use service_role and do not rely on the
-- authenticated Data API table write privileges.
-- Keep RLS and SELECT grants as-is; protect mutation authority at table ACL.

DO $preflight$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'underworld_purchases','player_token_holdings',
    'player_active_boosts','player_imprisonments'
  ] LOOP
    IF to_regclass('public.'||v_table) IS NULL THEN
      RAISE EXCEPTION 'UNDERWORLD_WRITE_LOCK_DEPENDENCY_MISSING: %',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=v_table
         AND c.relkind='r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'UNDERWORLD_WRITE_LOCK_RLS_NOT_ENABLED: %',v_table;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='trade_crypto_token'
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='gift_underworld_item'
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
  ) THEN
    RAISE EXCEPTION 'UNDERWORLD_WRITE_LOCK_EXISTING_ATOMIC_RPC_MISSING';
  END IF;
END $preflight$;

REVOKE INSERT,UPDATE,DELETE
 ON TABLE public.underworld_purchases,
          public.player_token_holdings,
          public.player_active_boosts,
          public.player_imprisonments
 FROM PUBLIC,anon,authenticated;

-- Keep the previously available character-owner SELECT routes.
-- The new underworld purchase/consume RPCs must themselves authorize the
-- actor and atomically take payment before writing purchases or benefits.
-- They must not re-GRANT direct table mutations to authenticated/anon.

NOTIFY pgrst,'reload schema';
