-- Rollback-only: use the existing active player and club as a fixture.
BEGIN;
DO $test$
DECLARE
 actor uuid; cid uuid; pid uuid; before_count integer; cap integer; current_count integer;
 rid uuid:=gen_random_uuid(); first_result jsonb; replay jsonb; fired jsonb; fid uuid; idx integer;
 bad_count integer; unchanged integer;
BEGIN
 IF has_table_privilege('authenticated','public.nightclub_staff','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_staff','UPDATE')
 OR has_table_privilege('authenticated','public.nightclub_staff','DELETE')
 OR has_function_privilege('anon','public.nightclub_staff_action_atomic(uuid,text,uuid,text,text,integer,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.nightclub_staff_action_atomic(uuid,text,uuid,text,text,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Nightclub staffing ACL bypass'; END IF;

 SELECT p.user_id,o.id,o.profile_id,
  least(20,greatest(5,ceil(o.capacity/100.0)::integer+4))
 INTO actor,cid,pid,cap
 FROM public.player_owned_nightclubs o
 JOIN public.profiles p ON p.id=o.profile_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.user_id)
 ORDER BY o.created_at DESC LIMIT 1;
 IF actor IS NULL THEN
  RAISE NOTICE 'No active owned nightclub fixture; staffing ACL contract passed';
  RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT count(*) INTO before_count FROM public.nightclub_staff WHERE owned_club_id=cid;
 first_result:=public.nightclub_staff_action_atomic(cid,'hire',rid,'promoter','Fixture Staff',2,NULL);
 IF (first_result->>'salary_weekly')::integer<>438 OR (first_result->>'replayed')::boolean THEN
   RAISE EXCEPTION 'Server failed to compute fixed level-2 promoter salary';
 END IF;
 fid:=(first_result->>'staff_id')::uuid;
 replay:=public.nightclub_staff_action_atomic(cid,'hire',rid,'promoter','Fixture Staff',2,NULL);
 IF (replay->>'staff_id')::uuid<>fid OR (replay->>'replayed')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Hire receipt retry was not idempotent';
 END IF;
 SELECT count(*) INTO unchanged FROM public.nightclub_staff
   WHERE owned_club_id=cid AND id=fid AND salary_weekly=438;
 IF unchanged<>1 THEN RAISE EXCEPTION 'Hire emitted incorrect staff count or salary'; END IF;
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'hire',rid,'dj','Fixture Staff',2,NULL);
  RAISE EXCEPTION 'Request replay with changed intent was accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'hire',gen_random_uuid(),'promoter','Bad Level',6,NULL);
  RAISE EXCEPTION 'Invalid skill was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'fire',gen_random_uuid(),NULL,NULL,NULL,gen_random_uuid());
  RAISE EXCEPTION 'Firing random staff was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO current_count FROM public.nightclub_staff WHERE owned_club_id=cid;
 FOR idx IN 1..greatest(0,cap-current_count) LOOP
  PERFORM public.nightclub_staff_action_atomic(cid,'hire',gen_random_uuid(),'bouncer','Capacity Filler '||idx,1,NULL);
 END LOOP;
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'hire',gen_random_uuid(),'dj','Overflow Staff',1,NULL);
  RAISE EXCEPTION 'Club staffing cap ignored';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 -- Existing staff and all hires only disappear inside this rolled-back transaction.
 fired:=public.nightclub_staff_action_atomic(cid,'fire',gen_random_uuid(),NULL,NULL,NULL,fid);
 IF (fired->>'staff_id')::uuid<>fid OR (fired->>'still_employed')::boolean THEN
   RAISE EXCEPTION 'Staff fire did not remove selected row'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'hire',gen_random_uuid(),'dj','Foreign Hire',1,NULL);
  RAISE EXCEPTION 'Foreign user authorized to hire staff';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.nightclub_staff_action_atomic(cid,'fire',gen_random_uuid(),NULL,NULL,NULL,fid);
  RAISE EXCEPTION 'Foreign user authorized to fire staff';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'Atomic staff hire/fire test passed; rollback will preserve all production data';
END $test$;
ROLLBACK;