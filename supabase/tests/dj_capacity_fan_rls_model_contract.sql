-- Attendance cannot exceed real capacity, and solo fan ledgers are never browser-writeable.
BEGIN;
DO $unit$
DECLARE low_fame integer;high_fame integer; low_cover integer;high_cover integer;
BEGIN
 IF private.dj_estimate_club_attendance(0,1000000,100000,5,100,0)<>0
  OR private.dj_estimate_club_attendance(150,2147483647,2147483647,5,100,0)>150
  OR private.dj_estimate_club_attendance(150,-100,-200,-5,-10,-10)<0
 THEN RAISE EXCEPTION 'DJ model exceeded zero/maximum venue limits';END IF;
 low_fame:=private.dj_estimate_club_attendance(150,20,0,2,0,10);
 high_fame:=private.dj_estimate_club_attendance(150,50000,0,2,0,10);
 low_cover:=private.dj_estimate_club_attendance(150,5000,0,2,0,0);
 high_cover:=private.dj_estimate_club_attendance(150,5000,0,2,0,500);
 IF high_fame<low_fame OR high_cover>low_cover
  OR private.dj_estimate_club_attendance(150,2000,10000,2,0,20)<
     private.dj_estimate_club_attendance(150,2000,0,2,0,20)
 THEN RAISE EXCEPTION 'DJ crowd demand monotonicity violated';END IF;
 IF has_table_privilege('authenticated','public.profile_city_dj_fans','INSERT')
  OR has_table_privilege('authenticated','public.profile_city_dj_fans','UPDATE')
  OR has_table_privilege('authenticated','public.dj_booking_audiences','INSERT')
  OR has_table_privilege('authenticated','public.dj_booking_audiences','UPDATE')
  OR has_table_privilege('anon','public.dj_booking_audiences','SELECT')
  OR has_function_privilege('anon',
   'private.dj_estimate_club_attendance(integer,integer,integer,integer,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'DJ city fan ledger browser privileges insecure';END IF;
END $unit$;
DO $fixture$
DECLARE id uuid;actor uuid;city uuid;
BEGIN
 SELECT p.id,p.user_id,p.current_city_id INTO id,actor,city FROM public.profiles p
 WHERE p.user_id IS NOT NULL AND p.current_city_id IS NOT NULL AND p.is_active
 ORDER BY p.id LIMIT 1;
 IF id IS NULL THEN
  PERFORM set_config('app.dj_fans_test_profile','',true);RETURN;END IF;
 INSERT INTO public.profile_city_dj_fans(profile_id,user_id,city_id,total_fans)
 VALUES(id,actor,city,12)
 ON CONFLICT (profile_id,city_id) DO NOTHING;
 PERFORM set_config('app.dj_fans_test_profile',id::text,true);
 PERFORM set_config('app.dj_fans_test_actor',actor::text,true);
 PERFORM set_config('app.dj_fans_test_city',city::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $permission$
DECLARE p text:=current_setting('app.dj_fans_test_profile',true); n integer;
BEGIN
 IF p IS NULL OR p='' THEN
  RAISE NOTICE 'No active profile for real-role RLS check';RETURN;END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 SELECT count(*) INTO n FROM public.profile_city_dj_fans
 WHERE profile_id=p::uuid AND city_id=current_setting('app.dj_fans_test_city')::uuid;
 IF n<>0 THEN RAISE EXCEPTION 'Other account can read private city DJ fans';END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_fans_test_actor'),true);
 SELECT count(*) INTO n FROM public.profile_city_dj_fans
 WHERE profile_id=p::uuid AND city_id=current_setting('app.dj_fans_test_city')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'DJ cannot see own city fan record';END IF;
 BEGIN
  UPDATE public.profile_city_dj_fans SET total_fans=12345 WHERE profile_id=p::uuid;
  RAISE EXCEPTION 'Browser forged canonical DJ followers';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  INSERT INTO public.dj_booking_audiences(booking_id,profile_id,user_id,club_id,city_id,
   venue_capacity,attendance,returning_fans,new_local_fans,satisfaction)
  VALUES(gen_random_uuid(),p::uuid,current_setting('app.dj_fans_test_actor')::uuid,
   gen_random_uuid(),current_setting('app.dj_fans_test_city')::uuid,150,150,0,150,100);
  RAISE EXCEPTION 'Browser forged settled DJ audience';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'Actual authenticated-role scoped solo DJ followers, no browser writes';
END $permission$;
ROLLBACK;