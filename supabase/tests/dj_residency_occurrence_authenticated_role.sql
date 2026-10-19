-- Exercise actual authenticated PostgreSQL permissions and actor-scoped RLS with rollback fixtures.
BEGIN;
DO $setup$
DECLARE ou uuid;op uuid;du uuid;dp uuid;cid uuid;city uuid;tz text;len integer;
 owned uuid;track uuid;setid uuid;app uuid;instant timestamptz;
BEGIN
 SELECT p.user_id,p.id,c.id,c.city_id,city.timezone,
 coalesce((c.dj_slot_config->>'set_length_minutes')::integer,45)
 INTO ou,op,cid,city,tz,len
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 JOIN public.cities city ON city.id=c.city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>(CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
 WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+100
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 AND coalesce((c.dj_slot_config->>'set_length_minutes')::integer,45) BETWEEN 15 AND 180
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO du,dp FROM public.profiles p
 WHERE p.user_id<>ou AND p.user_id IS NOT NULL AND p.is_active AND p.died_at IS NULL LIMIT 1;
 IF ou IS NULL OR du IS NULL THEN PERFORM set_config('app.residency_fixture_owner','',true);RETURN;END IF;
 UPDATE public.profiles SET current_city_id=city WHERE id=dp;
 SELECT s.ts INTO instant FROM generate_series(clock_timestamp()+interval '2 days',
 clock_timestamp()+interval '6 days',interval '30 minutes') s(ts)
 WHERE public.dj_booking_inside_club_hours(cid,s.ts,s.ts+make_interval(mins=>len))
 AND public.dj_booking_inside_club_hours(cid,
  ((s.ts AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz,
  (((s.ts AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz)+make_interval(mins=>len))
 ORDER BY s.ts LIMIT 1;
 IF instant IS NULL THEN RAISE EXCEPTION 'No valid venue-local fixture dates';END IF;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owned:=(public.purchase_nightclub_atomic(op,cid,gen_random_uuid())->>'owned_club_id')::uuid;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Residency Role Fixture','Fixture DJ','House','catalog/'||gen_random_uuid()||'/fixture.mp3',
 true,'Rollback-only fixture',true,ou) RETURNING id INTO track;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(du,dp,'Role Test Mix',jsonb_build_array(jsonb_build_object('source','admin','id',track::text)))
 RETURNING id INTO setid;
 app:=public.apply_for_nightclub_dj_slot(dp,owned,setid,instant,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app,'shortlist',gen_random_uuid());
 PERFORM set_config('app.residency_fixture_owner',ou::text,true);
 PERFORM set_config('app.residency_fixture_dj',du::text,true);
 PERFORM set_config('app.residency_fixture_club',owned::text,true);
 PERFORM set_config('app.residency_fixture_application',app::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $role$
DECLARE owner_id text:=current_setting('app.residency_fixture_owner',true);
 agreement_id uuid;receipt jsonb;app1 uuid;app2 uuid;owner_profile uuid;cash_before bigint;offer_id uuid;
BEGIN
 IF owner_id IS NULL OR owner_id='' THEN
  RAISE NOTICE 'No eligible 2-player fixture, ACL-only contract follows';RETURN;END IF;
 IF has_table_privilege('authenticated','public.nightclub_dj_residencies','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_dj_residencies','UPDATE')
 OR has_table_privilege('authenticated','public.nightclub_dj_residency_actions','INSERT')
 OR has_function_privilege('anon','public.respond_nightclub_dj_residency(uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Residency authenticated role received browser write permissions';END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id,true);
 agreement_id:=public.propose_nightclub_dj_residency(
 current_setting('app.residency_fixture_club')::uuid,
 current_setting('app.residency_fixture_application')::uuid,2,100,gen_random_uuid());
 IF (SELECT count(*) FROM public.nightclub_dj_residencies WHERE id=agreement_id)<>1
 THEN RAISE EXCEPTION 'Authenticated owner cannot read own proposed residency';END IF;
 BEGIN
  UPDATE public.nightclub_dj_residencies SET proposed_fee=1000 WHERE id=agreement_id;
  RAISE EXCEPTION 'Browser was able to forge resident DJ fee';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.residency_fixture_dj'),true);
 IF (SELECT count(*) FROM public.nightclub_dj_residencies WHERE id=agreement_id)<>1
 THEN RAISE EXCEPTION 'Intended authenticated DJ cannot view own offer';END IF;
 receipt:=public.respond_nightclub_dj_residency(agreement_id,'accept',gen_random_uuid());
 IF (receipt->>'status')<>'agreed' THEN RAISE EXCEPTION 'Authenticated DJ could not accept proposed terms';END IF;
 app1:=public.prepare_nightclub_dj_residency_occurrence(agreement_id,1,gen_random_uuid());
 app2:=public.prepare_nightclub_dj_residency_occurrence(agreement_id,2,gen_random_uuid());
 IF app1=app2 OR (SELECT count(*) FROM public.nightclub_dj_residency_occurrences
 WHERE residency_id=agreement_id)<>2 THEN
  RAISE EXCEPTION 'Authenticated DJ cannot prepare multiple weekly proposals';END IF;
 BEGIN
  INSERT INTO public.nightclub_dj_residency_occurrences
   (residency_id,occurrence_number,application_id,prepared_by_user_id,request_id)
  VALUES(agreement_id,3,gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
  RAISE EXCEPTION 'Browser forged residency show';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF (SELECT count(*) FROM public.nightclub_dj_residency_occurrences
 WHERE residency_id=agreement_id)<>0 THEN
  RAISE EXCEPTION 'Foreign browser could read resident show applications';END IF;
 BEGIN
  PERFORM public.prepare_nightclub_dj_residency_occurrence(agreement_id,2,gen_random_uuid());
  RAISE EXCEPTION 'Foreign browser prepared another DJ show';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',owner_id,true);
 SELECT owner_profile_id INTO owner_profile FROM public.nightclub_dj_residencies WHERE id=agreement_id;
 SELECT cash INTO cash_before FROM public.profiles WHERE id=owner_profile;
 BEGIN
  PERFORM public.fund_nightclub_dj_offer(
   current_setting('app.residency_fixture_club')::uuid,app2,125,gen_random_uuid());
  RAISE EXCEPTION 'Authenticated owner changed signed weekly fee';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 receipt:=public.fund_nightclub_dj_offer(
 current_setting('app.residency_fixture_club')::uuid,app1,100,gen_random_uuid());
 offer_id:=(receipt->>'offer_id')::uuid;
 PERFORM public.fund_nightclub_dj_offer(
 current_setting('app.residency_fixture_club')::uuid,app2,100,gen_random_uuid());
 IF offer_id IS NULL OR (SELECT cash FROM public.profiles WHERE id=owner_profile)<>cash_before-200
 THEN RAISE EXCEPTION 'Owner under actual authenticated role did not fund two independent holds';END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.residency_fixture_dj'),true);
 IF (SELECT count(*) FROM public.nightclub_dj_funded_offers
 WHERE application_id IN(app1,app2))<>2 THEN
 RAISE EXCEPTION 'Targeted DJ cannot read own funded occurrence offers';END IF;
END $role$;
ROLLBACK;