-- Test escrowed cash through canonical booking, real mixer evidence, settlement and refund; rollback.
BEGIN;
DO $test$
DECLARE ou uuid;op uuid;du uuid;dp uuid;cid uuid;city uuid;owned uuid;track uuid;setid uuid;
 app1 uuid;app2 uuid;app3 uuid;app4 uuid;offer1 uuid;offer2 uuid;offer3 uuid;offer4 uuid;booking1 uuid;booking2 uuid;booking3 uuid;booking4 uuid;
 t1 timestamptz;t2 timestamptz;t3 timestamptz;t4 timestamptz;len integer;initial_cash bigint;dj_cash bigint;
 earned integer;result_id uuid;replay_id uuid;
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
 PERFORM private.dj_start_booking_at(booking1,t1+interval '1 minute');
 IF (SELECT promised_payout FROM public.dj_performance_sessions WHERE booking_id=booking1)<>100
 THEN RAISE EXCEPTION 'Promise not matched to owner escrow';END IF;
 PERFORM private.dj_record_mix_event_once_at(booking1,'deck_play','A','admin',track,NULL,gen_random_uuid(),t1+interval '1 minute');
 PERFORM private.dj_record_mix_event_once_at(booking1,'tempo','A',NULL,NULL,100,gen_random_uuid(),t1+interval '2 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'crossfade',NULL,NULL,NULL,50,gen_random_uuid(),t1+interval '3 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'deck_play','B','admin',track,NULL,gen_random_uuid(),t1+interval '4 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'tempo','B',NULL,NULL,110,gen_random_uuid(),t1+interval '5 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'crossfade',NULL,NULL,NULL,75,
  gen_random_uuid(),t1+make_interval(mins=>len/2+3));
 result_id:=private.dj_settle_booking_at(booking1,t1+make_interval(mins=>len)+interval '1 minute');
 replay_id:=private.dj_settle_booking_at(booking1,t1+make_interval(mins=>len)+interval '1 minute');
 SELECT cash_amount INTO earned FROM public.dj_settlement_ledger WHERE booking_id=booking1;
 IF public.confirm_accepted_nightclub_dj_offer_internal(offer1,key1) IS DISTINCT FROM booking1
 THEN RAISE EXCEPTION 'Settled booking idempotency key no longer replays';END IF;
 IF result_id IS DISTINCT FROM replay_id OR earned NOT BETWEEN 1 AND 100
 OR (SELECT cash FROM public.profiles WHERE id=dp)<>dj_cash+earned
 OR (SELECT status FROM public.nightclub_dj_funded_offers WHERE id=offer1)<>'settled'
 THEN RAISE EXCEPTION 'Funded DJ payout or replay invalid';END IF;
 SELECT * INTO crowd FROM public.dj_booking_audiences a WHERE a.booking_id=booking1;
 SELECT * INTO city_fans FROM public.profile_city_dj_fans f
  WHERE f.profile_id=dp AND f.city_id=city;
 IF crowd.booking_id IS NULL
 OR crowd.venue_capacity<=0
 OR crowd.attendance NOT BETWEEN 0 AND crowd.venue_capacity
 OR crowd.returning_fans+crowd.new_local_fans>crowd.attendance
 OR crowd.city_id IS DISTINCT FROM city
 OR city_fans.total_fans IS DISTINCT FROM crowd.new_local_fans
 OR city_fans.total_attendance IS DISTINCT FROM crowd.attendance
 OR city_fans.sets_played<>1
 OR (SELECT fans_gained FROM public.player_dj_performances
     WHERE booking_id=booking1) IS DISTINCT FROM crowd.new_local_fans
 OR (SELECT metadata->>'fan_conversion_applied' FROM public.dj_settlement_ledger
     WHERE booking_id=booking1)<>'true'
 THEN RAISE EXCEPTION 'DJ attendance or canonical city fan settlement mismatch';END IF;
 IF (SELECT count(*) FROM public.dj_booking_audiences WHERE booking_id=booking1)<>1
 THEN RAISE EXCEPTION 'DJ settlement replay duplicated audience record';END IF;
 IF (SELECT coalesce(sum(amount),0) FROM public.nightclub_dj_escrow_movements
 WHERE offer_id=offer1 AND kind IN ('refund','payout'))<>100
 THEN RAISE EXCEPTION 'Payout and surplus do not conserve held fee';END IF;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owner_result:=public.cancel_owned_funded_dj_booking(offer2,owner_cancel_key);
 IF (owner_result->>'status')<>'cancelled' THEN
  RAISE EXCEPTION 'Verified club owner could not cancel future booked set';END IF;
 owner_result:=public.cancel_owned_funded_dj_booking(offer2,owner_cancel_key);
 IF (owner_result->>'replayed')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Owner cancellation request replay was not idempotent';END IF;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 IF public.confirm_accepted_nightclub_dj_offer_internal(offer2,key2) IS DISTINCT FROM booking2
 THEN RAISE EXCEPTION 'Cancelled booking idempotency key no longer replays';END IF;
 IF (SELECT status FROM public.nightclub_dj_funded_offers WHERE id=offer2)<>'cancelled'
 OR (SELECT cash FROM public.profiles WHERE id=op)<>initial_cash-earned
 OR (SELECT count(*) FROM public.nightclub_dj_escrow_movements
 WHERE offer_id=offer2 AND kind='refund' AND amount=125)<>1 THEN
  RAISE EXCEPTION 'Cancel did not conserve all owner/DJ cash';END IF;
 -- The missed-set worker must return the ENTIRE fee, with no payout or reward.
 SELECT times.ts INTO t3 FROM generate_series(t2+interval '4 hours',t2+interval '2 days',
  interval '30 minutes') times(ts)
 WHERE public.dj_booking_inside_club_hours(cid,times.ts,times.ts+make_interval(mins=>len))
 AND public.dj_external_schedule_conflict(dp,times.ts,times.ts+make_interval(mins=>len)) IS NULL
 ORDER BY times.ts LIMIT 1;
 IF t3 IS NULL THEN RAISE EXCEPTION 'No third fixture set for missed show';END IF;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 app3:=public.apply_for_nightclub_dj_slot(dp,owned,setid,t3,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app3,'shortlist',gen_random_uuid());
 offer3:=(public.fund_nightclub_dj_offer(owned,app3,90,gen_random_uuid())->>'offer_id')::uuid;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 PERFORM public.decide_nightclub_dj_offer(offer3,'accept',gen_random_uuid());
 booking3:=public.confirm_accepted_nightclub_dj_offer_internal(offer3,gen_random_uuid());
 PERFORM private.dj_mark_missed_at(booking3,t3+make_interval(mins=>len)+interval '11 minutes');
 IF (SELECT status FROM public.nightclub_dj_funded_offers WHERE id=offer3)<>'missed'
 OR (SELECT cash FROM public.profiles WHERE id=op)<>initial_cash-earned
 OR (SELECT count(*) FROM public.nightclub_dj_escrow_movements m
  WHERE m.offer_id=offer3 AND m.kind='refund' AND m.amount=90)<>1
 OR (SELECT status FROM public.player_scheduled_activities
  WHERE linked_dj_booking_id=booking3)<>'missed' THEN
  RAISE EXCEPTION 'Missed funded booking did not refund once and update Schedule';END IF;
 -- The DJ still has their own normal cancellation path for a funded booking.
 SELECT times.ts INTO t4 FROM generate_series(t3+interval '4 hours',t3+interval '2 days',
  interval '30 minutes') times(ts)
 WHERE public.dj_booking_inside_club_hours(cid,times.ts,times.ts+make_interval(mins=>len))
 AND public.dj_external_schedule_conflict(dp,times.ts,times.ts+make_interval(mins=>len)) IS NULL
 ORDER BY times.ts LIMIT 1;
 IF t4 IS NULL THEN RAISE EXCEPTION 'No fourth valid booked fixture slot';END IF;
 app4:=public.apply_for_nightclub_dj_slot(dp,owned,setid,t4,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app4,'shortlist',gen_random_uuid());
 offer4:=(public.fund_nightclub_dj_offer(owned,app4,75,gen_random_uuid())->>'offer_id')::uuid;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 PERFORM public.decide_nightclub_dj_offer(offer4,'accept',gen_random_uuid());
 booking4:=public.confirm_accepted_nightclub_dj_offer_internal(offer4,gen_random_uuid());
 PERFORM public.cancel_dj_booking_internal(booking4);
 IF (SELECT status FROM public.nightclub_dj_funded_offers WHERE id=offer4)<>'cancelled'
 OR (SELECT cash FROM public.profiles WHERE id=op)<>initial_cash-earned
 OR (SELECT count(*) FROM public.nightclub_dj_escrow_movements
   WHERE offer_id=offer4 AND kind='refund' AND amount=75)<>1
 THEN RAISE EXCEPTION 'DJ cancellation did not refund the owner';END IF;
 IF EXISTS (SELECT 1 FROM public.dj_booking_audiences WHERE booking_id IN(booking2,booking3,booking4))
 THEN RAISE EXCEPTION 'Missed or cancelled DJ gigs received a phantom crowd';END IF;
 RAISE NOTICE 'Funded DJ crowd, local fans, verified mixer and payout conservation passed';

END $test$;
ROLLBACK;