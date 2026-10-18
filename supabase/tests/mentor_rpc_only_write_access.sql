-- Regression: clients cannot forge mentor discoveries or session history,
-- but authenticated character-owned discovery/booking still work atomically.
DO $privilege_check$
BEGIN
 IF has_table_privilege('authenticated','public.player_master_discoveries','INSERT')
 OR has_table_privilege('authenticated','public.player_mentor_sessions','INSERT')
 OR has_table_privilege('anon','public.player_master_discoveries','INSERT')
 OR has_table_privilege('anon','public.player_mentor_sessions','INSERT')
 THEN RAISE EXCEPTION 'Mentor table insert privilege bypasses secure RPC flow'; END IF;
 IF NOT has_table_privilege('authenticated','public.player_master_discoveries','SELECT')
 OR NOT has_table_privilege('authenticated','public.player_mentor_sessions','SELECT')
 THEN RAISE EXCEPTION 'Authenticated player cannot read mentor history'; END IF;
 IF NOT has_table_privilege('service_role','public.player_master_discoveries','INSERT')
 OR NOT has_table_privilege('service_role','public.player_mentor_sessions','INSERT')
 THEN RAISE EXCEPTION 'Service role lost mentor write privileges'; END IF;
 IF NOT has_function_privilege('authenticated','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.book_mentor_session_atomic(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Client mentor RPC access unavailable'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='player_master_discoveries' AND cmd='INSERT') OR
 EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='player_mentor_sessions' AND cmd='INSERT')
 THEN RAISE EXCEPTION 'Obsolete direct mentor insertion policy remains'; END IF;
END $privilege_check$;

-- On local clean-reset databases there may be no player fixtures. On an
-- active environment verify discovery+booking with real eligible fixtures
-- inside a transaction that is always rolled back.
BEGIN;
DO $booking_smoke$
DECLARE v_profile uuid; v_user uuid; v_mentor uuid; v_result jsonb;
BEGIN
 SELECT p.id,p.user_id,m.id INTO v_profile,v_user,v_mentor
 FROM public.profiles p CROSS JOIN public.education_mentors m
 WHERE p.user_id IS NOT NULL AND p.is_active IS TRUE
  AND p.deleted_at IS NULL AND p.died_at IS NULL
  AND p.cash >= m.cost AND m.is_active IS TRUE
  AND m.is_discoverable IS TRUE
  AND m.city_id IS NULL AND m.available_day IS NULL
  AND public.skill_tier_unlocked(p.id,m.focus_skill)
  AND NOT EXISTS (
   SELECT 1 FROM public.player_mentor_sessions s
   WHERE s.profile_id=p.id AND s.mentor_id=m.id
   AND s.session_date>now()-make_interval(hours=>m.cooldown_hours))
 ORDER BY m.cost ASC,p.cash DESC LIMIT 1;
 IF v_profile IS NULL THEN
   RAISE NOTICE 'No eligible live booking fixture; checked RPC and grants only';
   RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',v_user::text,'role','authenticated')::text,true);

 IF NOT public.discover_master(v_profile,v_mentor,'exploration','{}'::jsonb)
 THEN RAISE EXCEPTION 'Authorized mentor discovery failed'; END IF;
 v_result:=public.book_mentor_session_atomic(v_profile,v_mentor);
 IF COALESCE(v_result->>'sessionId','')='' OR NOT EXISTS (
  SELECT 1 FROM public.player_mentor_sessions
  WHERE id=(v_result->>'sessionId')::uuid
 ) THEN RAISE EXCEPTION 'Atomic mentor booking did not persist a session'; END IF;
END $booking_smoke$;
ROLLBACK;
