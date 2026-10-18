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
 IF EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
   AND p.proname IN (
     '_dj_guard_band_join_conflicts',
     '_dj_guard_city_timezone_update',
     '_dj_guard_course_timetable_update',
     '_dj_guard_university_city_update',
     'guard_dj_reverse_activity_source',
     'guard_dj_reverse_band_gig_write',
     'guard_dj_reverse_university_enrolment',
     'project_dj_booking_into_calendar'
   )
   AND (p.prorettype <> 'pg_catalog.trigger'::regtype
     OR has_function_privilege('anon',p.oid,'EXECUTE')
     OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
 ) THEN RAISE EXCEPTION 'A DJ SECURITY DEFINER trigger is exposed to clients'; END IF;

 IF has_function_privilege('authenticated',
      'public.credit_verified_dj_set_club_reputation()','EXECUTE')
 THEN RAISE EXCEPTION 'DJ credit trigger is directly callable by a player'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.dj_settlement_ledger'::regclass
     AND tgname='credit_verified_dj_club_reputation'
     AND NOT tgisinternal AND tgenabled='O'
 ) THEN RAISE EXCEPTION 'DJ settlement does not credit authoritative club reputation'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.dj_settlement_ledger'::regclass
     AND tgname='require_dj_live_mix_before_settlement'
     AND NOT tgisinternal AND tgenabled='O'
 ) THEN RAISE EXCEPTION 'Mixer evidence guard was disabled'; END IF;
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
