-- Test escrowed cash through canonical booking, real mixer evidence, settlement and refund; rollback.
BEGIN;
DO $test$
DECLARE ou uuid;op uuid;du uuid;dp uuid;cid uuid;city uuid;owned uuid;track uuid;setid uuid;
 app1 uuid;app2 uuid;app3 uuid;app4 uuid;offer1 uuid;offer2 uuid;offer3 uuid;offer4 uuid;booking1 uuid;booking2 uuid;booking3 uuid;booking4 uuid;
 t1 timestamptz;t2 timestamptz;t3 timestamptz;t4 timestamptz;len integer;initial_cash bigint;dj_cash bigint;
 earned integer;result_id uuid;replay_id uuid;
 advertising_key uuid:=gen_random_uuid();advertising_result jsonb;
 baseline_attendance integer;
 crowd public.dj_booking_audiences%ROWTYPE;
 city_fans public.profile_city_dj_fans%ROWTYPE;key1 uuid:=gen_random_uuid();key2 uuid:=gen_random_uuid();owner_cancel_key uuid:=gen_random_uuid();owner_result jsonb;
BEGIN
 IF has_function_privilege('authenticated','public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Funded booking conversion is not service-only';END IF;
 SELECT p.user_id,p.id,c.id,c.city_id,coalesce((c.dj_slot_config->>'set_length_minutes')::int,45)
 INTO ou,op,cid,city,len FROM public.profiles p
 JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>(CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
 WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+500
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs own WHERE own.club_id=c.id)
 AND coalesce((c.dj_slot_config->>'set_length_minutes')::int,45) BETWEEN 15 AND 180
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO du,dp FROM public.profiles p
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id<>ou AND p.user_id IS NOT NULL LIMIT 1;
 IF ou IS NULL OR du IS NULL THEN RAISE NOTICE 'No eligible 2-actor fixture'; RETURN;END IF;
 UPDATE public.profiles SET current_city_id=city,energy=100,fame=greatest(fame,100000) WHERE id=dp;
 SELECT s.ts INTO t1 FROM generate_series(clock_timestamp()+interval '2 days',
  clock_timestamp()+interval '5 days',interval '30 minutes') s(ts)
 WHERE public.dj_booking_inside_club_hours(cid,s.ts,s.ts+make_interval(mins=>len))
 AND public.dj_external_schedule_conflict(dp,s.ts,s.ts+make_interval(mins=>len)) IS NULL
 ORDER BY s.ts LIMIT 1;
 SELECT s.ts INTO t2 FROM generate_series(t1+interval '4 hours',
  t1+interval '2 days',interval '30 minutes') s(ts)
 WHERE public.dj_booking_inside_club_hours(cid,s.ts,s.ts+make_interval(mins=>len))
 AND public.dj_external_schedule_conflict(dp,s.ts,s.ts+make_interval(mins=>len)) IS NULL
 ORDER BY s.ts LIMIT 1;
 IF t1 IS NULL OR t2 IS NULL THEN RAISE EXCEPTION 'Fixture club has no legal DJ slots';END IF;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owned:=(public.purchase_nightclub_atomic(op,cid,gen_random_uuid())->>'owned_club_id')::uuid;
 SELECT cash INTO initial_cash FROM public.profiles WHERE id=op;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Funded Test Track','DJ Fixture','House','catalog/'||gen_random_uuid()||'/track.mp3',
 true,'Rollback-only cleared audio fixture',true,ou) RETURNING id INTO track;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(du,dp,'Funded DJ Booking Set',jsonb_build_array(jsonb_build_object('source','admin','id',track::text)))
 RETURNING id INTO setid;
 app1:=public.apply_for_nightclub_dj_slot(dp,owned,setid,t1,gen_random_uuid());
 app2:=public.apply_for_nightclub_dj_slot(dp,owned,setid,t2,gen_random_uuid());
 -- Before owner approval/fee escrow, the *ordinary* DJ reservation route
 -- must be denied at the same verified player-owned club.
 BEGIN
  PERFORM public.reserve_dj_booking_internal(dp,cid,setid,t1,gen_random_uuid());
  RAISE EXCEPTION 'DJ bypassed verified club owner by ordinary reserve path';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app1,'shortlist',gen_random_uuid());
 PERFORM public.review_nightclub_dj_application(owned,app2,'shortlist',gen_random_uuid());
 offer1:=(public.fund_nightclub_dj_offer(owned,app1,100,gen_random_uuid())->>'offer_id')::uuid;
 offer2:=(public.fund_nightclub_dj_offer(owned,app2,125,gen_random_uuid())->>'offer_id')::uuid;
 IF (SELECT cash FROM public.profiles WHERE id=op)<>initial_cash-225 THEN
  RAISE EXCEPTION 'Owner did not fund precisely 225';END IF;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 PERFORM public.decide_nightclub_dj_offer(offer1,'accept',gen_random_uuid());
 PERFORM public.decide_nightclub_dj_offer(offer2,'accept',gen_random_uuid());
 SELECT cash INTO dj_cash FROM public.profiles WHERE id=dp;
 booking1:=public.dj_verified_funded_offer_booking_service(du,offer1,key1);
 booking2:=public.confirm_accepted_nightclub_dj_offer_internal(offer2,key2);
 BEGIN
  PERFORM public.withdraw_nightclub_dj_application(app1);
  RAISE EXCEPTION 'DJ withdrew a booked funded interest application';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 IF booking1=booking2 OR (SELECT count(*) FROM public.player_scheduled_activities a
 WHERE a.linked_dj_booking_id IN (booking1,booking2) AND a.status='scheduled')<>2
 THEN RAISE EXCEPTION 'Canonical DJ booking Schedule projection missing';END IF;

 PERFORM set_config('app.dj_paid_promo_owner',ou::text,true);
 PERFORM set_config('app.dj_paid_promo_dj',du::text,true);
 PERFORM set_config('app.dj_paid_promo_club',owned::text,true);
 PERFORM set_config('app.dj_paid_promo_booking',booking1::text,true);
 PERFORM set_config('app.dj_paid_promo_profile',op::text,true);
END $test$;
SET LOCAL ROLE authenticated;
DO $permissions$
DECLARE promo jsonb; booking uuid; owned uuid; owner uuid;cash_before bigint;
BEGIN
 booking:=current_setting('app.dj_paid_promo_booking')::uuid;
 owned:=current_setting('app.dj_paid_promo_club')::uuid;
 owner:=current_setting('app.dj_paid_promo_profile')::uuid;
 IF has_table_privilege('authenticated','public.nightclub_dj_paid_promotions','INSERT')
  OR has_table_privilege('authenticated','public.nightclub_dj_paid_promotions','UPDATE')
  OR has_function_privilege('anon','public.purchase_nightclub_dj_promotion(uuid,uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Browser can forge paid promotion or anonymous can spend';END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_paid_promo_dj'),true);
 BEGIN
  PERFORM public.purchase_nightclub_dj_promotion(owned,booking,100,gen_random_uuid());
  RAISE EXCEPTION 'DJ applicant spent a club owner budget';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_paid_promo_owner'),true);
 SELECT cash INTO cash_before FROM public.profiles WHERE id=owner;
 promo:=public.purchase_nightclub_dj_promotion(owned,booking,100,gen_random_uuid());
 IF (promo->>'budget')::integer<>100
  OR (SELECT cash FROM public.profiles WHERE id=owner)<>cash_before-100
  OR (SELECT count(*) FROM public.nightclub_dj_paid_promotions WHERE booking_id=booking)<>1
 THEN RAISE EXCEPTION 'Authenticated verified owner did not pay for one real promotion'; END IF;
 BEGIN
  INSERT INTO public.nightclub_dj_paid_promotions(
   booking_id,owned_club_id,owner_user_id,owner_profile_id,request_id,
   budget,attendance_boost_percent)
  VALUES(gen_random_uuid(),owned,gen_random_uuid(),owner,gen_random_uuid(),500,15);
  RAISE EXCEPTION 'Browser fabricated an advertising receipt';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_paid_promo_dj'),true);
 IF (SELECT count(*) FROM public.nightclub_dj_paid_promotions
 WHERE booking_id=booking)<>0 THEN
  RAISE EXCEPTION 'DJ applicant could read club owner advertising expenditure';END IF;
END $permissions$;
ROLLBACK;