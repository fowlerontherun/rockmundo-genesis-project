-- Every test mutation rolls back: a signed residency funds two *distinct* canonical bookings.
BEGIN;
DO $case$
DECLARE
 ou uuid;op uuid;du uuid;dp uuid;venue uuid;venue_city uuid;tz text;duration_minutes int;
 owned uuid;track uuid;setlist uuid;source_app uuid;residency uuid;
 app1 uuid;app2 uuid;offer1 uuid;offer2 uuid;booking1 uuid;booking2 uuid;
 first_at timestamptz;second_at timestamptz;before_owner bigint;before_dj bigint;
 earned integer;perf uuid;retry_perf uuid;fund1 jsonb;fund2 jsonb;
 prepare_key uuid:=gen_random_uuid();prepare2_key uuid:=gen_random_uuid();
BEGIN
 IF has_table_privilege('authenticated','public.nightclub_dj_residency_occurrences','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_dj_residency_occurrences','UPDATE')
 OR has_function_privilege('anon',
  'public.prepare_nightclub_dj_residency_occurrence(uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Residency per-show browser write/anonymous privilege leaked';END IF;
 SELECT p.user_id,p.id,c.id,c.city_id,city.timezone,
 coalesce((c.dj_slot_config->>'set_length_minutes')::int,45)
 INTO ou,op,venue,venue_city,tz,duration_minutes
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 JOIN public.cities city ON city.id=c.city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>(CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
  WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+300
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs owned WHERE owned.club_id=c.id)
 AND coalesce((c.dj_slot_config->>'set_length_minutes')::int,45) BETWEEN 15 AND 180
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO du,dp FROM public.profiles p
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL AND p.user_id<>ou LIMIT 1;
 IF ou IS NULL OR du IS NULL THEN RAISE NOTICE 'No eligible independent owner/DJ fixture; ACL passed';RETURN;END IF;
 UPDATE public.profiles SET current_city_id=venue_city,energy=100,
 fame=greatest(fame,100000) WHERE id=dp;
 SELECT candidate.t INTO first_at FROM generate_series(
   clock_timestamp()+interval '2 days',clock_timestamp()+interval '5 days',interval '30 minutes') candidate(t)
 WHERE public.dj_booking_inside_club_hours(venue,candidate.t,
      candidate.t+make_interval(mins=>duration_minutes))
 AND public.dj_booking_inside_club_hours(venue,
      ((candidate.t AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz,
      (((candidate.t AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz)+make_interval(mins=>duration_minutes))
 AND public.dj_external_schedule_conflict(dp,candidate.t,
      candidate.t+make_interval(mins=>duration_minutes)) IS NULL
 ORDER BY candidate.t LIMIT 1;
 IF first_at IS NULL THEN RAISE EXCEPTION 'No two legal venue-local residency slots';END IF;
 second_at:=((first_at AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owned:=(public.purchase_nightclub_atomic(op,venue,gen_random_uuid())->>'owned_club_id')::uuid;
 SELECT cash INTO before_owner FROM public.profiles WHERE id=op;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Residency Recording Fixture','Resident DJ','House','catalog/'||gen_random_uuid()||'/mix.mp3',
 true,'Rollback-only consent fixture',true,ou) RETURNING id INTO track;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(du,dp,'Resident Decks',jsonb_build_array(jsonb_build_object('source','admin','id',track::text)))
 RETURNING id INTO setlist;
 source_app:=public.apply_for_nightclub_dj_slot(dp,owned,setlist,first_at,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,source_app,'shortlist',gen_random_uuid());
 residency:=public.propose_nightclub_dj_residency(owned,source_app,2,100,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 PERFORM public.respond_nightclub_dj_residency(residency,'accept',gen_random_uuid());
 app1:=public.prepare_nightclub_dj_residency_occurrence(residency,1,prepare_key);
 IF app1 IS DISTINCT FROM source_app OR
  public.prepare_nightclub_dj_residency_occurrence(residency,1,prepare_key) IS DISTINCT FROM app1
 THEN RAISE EXCEPTION 'First occurrence must reuse original shortlisted application';END IF;
 app2:=public.prepare_nightclub_dj_residency_occurrence(residency,2,prepare2_key);
 IF app2=app1 OR
 public.prepare_nightclub_dj_residency_occurrence(residency,2,prepare2_key) IS DISTINCT FROM app2
 OR (SELECT status FROM public.dj_club_applications WHERE id=app2)<>'shortlisted'
 OR (SELECT starts_at FROM public.dj_club_applications WHERE id=app2) IS DISTINCT FROM second_at
 THEN RAISE EXCEPTION 'Second occurrence was not separately prepared/shortlisted';END IF;
 BEGIN
  PERFORM public.prepare_nightclub_dj_residency_occurrence(residency,1,prepare2_key);
  RAISE EXCEPTION 'Changed residency occurrence intent reused original key';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.prepare_nightclub_dj_residency_occurrence(residency,2,gen_random_uuid());
  RAISE EXCEPTION 'Foreign actor prepared DJ residency';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 BEGIN
  PERFORM public.fund_nightclub_dj_offer(owned,app2,125,gen_random_uuid());
  RAISE EXCEPTION 'Club owner changed agreed residency fee';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 fund1:=public.fund_nightclub_dj_offer(owned,app1,100,gen_random_uuid());
 fund2:=public.fund_nightclub_dj_offer(owned,app2,100,gen_random_uuid());
 offer1:=(fund1->>'offer_id')::uuid;offer2:=(fund2->>'offer_id')::uuid;
 IF (SELECT cash FROM public.profiles WHERE id=op)<>before_owner-200 THEN
  RAISE EXCEPTION 'Each resident set must debit exactly 100';END IF;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 PERFORM public.decide_nightclub_dj_offer(offer1,'accept',gen_random_uuid());
 PERFORM public.decide_nightclub_dj_offer(offer2,'accept',gen_random_uuid());
 SELECT cash INTO before_dj FROM public.profiles WHERE id=dp;
 booking1:=public.confirm_accepted_nightclub_dj_offer_internal(offer1,gen_random_uuid());
 booking2:=public.confirm_accepted_nightclub_dj_offer_internal(offer2,gen_random_uuid());
 IF booking1=booking2 OR (SELECT count(*) FROM public.player_scheduled_activities
 WHERE linked_dj_booking_id IN(booking1,booking2) AND status='scheduled')<>2
 THEN RAISE EXCEPTION 'Separate escrow holds did not create separate Schedule DJ gigs';END IF;
 PERFORM private.dj_start_booking_at(booking1,first_at+interval '1 minute');
 PERFORM private.dj_record_mix_event_once_at(booking1,'deck_play','A','admin',track,NULL,gen_random_uuid(),first_at+interval '1 minute');
 PERFORM private.dj_record_mix_event_once_at(booking1,'tempo','A',NULL,NULL,100,gen_random_uuid(),first_at+interval '2 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'crossfade',NULL,NULL,NULL,50,gen_random_uuid(),first_at+interval '3 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'deck_play','B','admin',track,NULL,gen_random_uuid(),first_at+interval '4 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'tempo','B',NULL,NULL,110,gen_random_uuid(),first_at+interval '5 minutes');
 PERFORM private.dj_record_mix_event_once_at(booking1,'crossfade',NULL,NULL,NULL,75,gen_random_uuid(),
  first_at+make_interval(mins=>duration_minutes/2+3));
 perf:=private.dj_settle_booking_at(booking1,first_at+make_interval(mins=>duration_minutes)+interval '1 minute');
 retry_perf:=private.dj_settle_booking_at(booking1,first_at+make_interval(mins=>duration_minutes)+interval '1 minute');
 SELECT cash_amount INTO earned FROM public.dj_settlement_ledger WHERE booking_id=booking1;
 IF perf IS DISTINCT FROM retry_perf OR earned NOT BETWEEN 1 AND 100
 OR (SELECT cash FROM public.profiles WHERE id=dp)<>before_dj+earned THEN
  RAISE EXCEPTION 'Resident DJ received invalid or duplicate fee';END IF;
 PERFORM public.cancel_dj_booking_internal(booking2);
 IF (SELECT cash FROM public.profiles WHERE id=op)<>before_owner-earned
 OR (SELECT coalesce(sum(m.amount),0) FROM public.nightclub_dj_escrow_movements m
 WHERE m.offer_id=offer1 AND m.kind IN('payout','refund'))<>100
 OR (SELECT coalesce(sum(m.amount),0) FROM public.nightclub_dj_escrow_movements m
 WHERE m.offer_id=offer2 AND m.kind='refund')<>100
 THEN RAISE EXCEPTION 'Per-occurrence cash debit did not conserve payout plus refunds';END IF;
 PERFORM public.respond_nightclub_dj_residency(residency,'end',gen_random_uuid());
 IF (SELECT status FROM public.nightclub_dj_residencies WHERE id=residency)<>'ended'
 OR (SELECT status FROM public.dj_bookings WHERE id=booking1)<>'completed'
 OR (SELECT status FROM public.dj_bookings WHERE id=booking2)<>'cancelled'
 THEN RAISE EXCEPTION 'Ending residency changed already-settled/cancelled booked shows';END IF;
 RAISE NOTICE 'Resident occurrences separately funded, booked, settled, cancelled and cash conserved; rollback';
END $case$;
ROLLBACK;