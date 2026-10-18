-- DJ history and nightclub VIP authority: read-only, rollback-only.
-- Runs against a local/test Supabase database with pgcrypto/auth schemas.
BEGIN;
DO $$
BEGIN
 IF has_table_privilege('anon','public.player_dj_performances','INSERT')
   OR has_table_privilege('authenticated','public.player_dj_performances','INSERT')
   OR has_table_privilege('authenticated','public.player_dj_performances','UPDATE')
   OR has_table_privilege('authenticated','public.player_dj_performances','DELETE')
 THEN RAISE EXCEPTION 'Unauthorised DJ performance history writes'; END IF;

 IF has_table_privilege('authenticated','public.player_club_reputation','INSERT')
   OR has_table_privilege('authenticated','public.player_club_reputation','UPDATE')
   OR has_table_privilege('authenticated','public.player_club_reputation','DELETE')
 THEN RAISE EXCEPTION 'Client can forge club VIP or DJ count'; END IF;

 IF NOT has_table_privilege('authenticated','public.player_dj_performances','SELECT')
   OR NOT has_table_privilege('authenticated','public.player_club_reputation','SELECT')
   OR NOT has_table_privilege('service_role','public.player_dj_performances','INSERT')
 THEN RAISE EXCEPTION 'Read access or trusted settlement insert is missing'; END IF;

 IF NOT has_function_privilege('authenticated',
      'public.record_verified_club_visit(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon',
      'public.record_verified_club_visit(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Club visit RPC has unsafe execution grants'; END IF;

 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('player_dj_performances','player_club_reputation')
   AND cmd IN ('INSERT','UPDATE','DELETE'))
 THEN RAISE EXCEPTION 'Legacy DJ or club reputation writer RLS policy exists'; END IF;
END; $$;

-- A forged auth identity and a character not belonging to it must fail,
-- before any row can be created or reputation counters incremented.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000000', true);
DO $$
BEGIN
 BEGIN
   PERFORM public.record_verified_club_visit(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
   );
   RAISE EXCEPTION 'Unauthorized club visit unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END; $$;
ROLLBACK;
