-- Internal Phase 4 reservation checks. Run as a database owner.
-- Rehearsal reservation and schedule staging ONLY: no cash/XP/fame or gig
-- settlement. All fixtures and reservations roll back in one transaction.
\set ON_ERROR_STOP on
BEGIN;

DO $test$
DECLARE
  v_actor uuid;
  v_other uuid;
  v_profile uuid;
  v_song uuid;
  v_club uuid;
  v_set uuid;
  v_booking uuid;
  v_again uuid;
  v_request uuid := gen_random_uuid();
  v_start timestamptz := now() + interval '8 days';
  v_cash numeric;
  v_fame numeric;
  v_cash_after numeric;
  v_fame_after numeric;
  v_morning_club uuid;
  v_morning_start timestamptz;
  v_morning_set uuid;
  v_basic_course uuid;
  v_basic_uni uuid;
BEGIN
  SELECT p.user_id,p.id,s.id,c.id,p.cash,p.fame,
    ((date_trunc('day', now() AT TIME ZONE city.timezone) + interval '8 days'
      + CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%' THEN interval '23 hours' ELSE interval '22 hours' END) AT TIME ZONE city.timezone)
    INTO v_actor,v_profile,v_song,v_club,v_cash,v_fame,v_start
  FROM public.profiles p
  JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
    AND s.status='recorded' AND s.audio_url IS NOT NULL AND COALESCE(s.archived,false)=false
  JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
  JOIN public.cities city ON city.id=c.city_id
  JOIN public.user_roles ur ON ur.user_id=p.user_id AND ur.role='user'::public.app_role
  WHERE c.dj_slot_config->>'schedule' IN ('11pm-3am','10pm-2am','11pm-4am')
    AND COALESCE(p.fame,0)>=COALESCE((c.dj_slot_config->>'minimum_fame')::integer,0)
    AND COALESCE((c.dj_slot_config->>'set_length_minutes')::integer,45) BETWEEN 15 AND 180
    AND NOT EXISTS (
      SELECT 1 FROM public.player_scheduled_activities a
      WHERE a.profile_id=p.id AND a.status IN ('scheduled','in_progress')
        AND a.scheduled_start < v_start + interval '3 hours'
        AND a.scheduled_end > v_start
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id=g.band_id
      WHERE bm.profile_id=p.id AND bm.member_status='active'
        AND g.status IN ('scheduled','confirmed','in_progress')
        AND g.scheduled_date < v_start+interval '3 hours'
        AND COALESCE(g.scheduled_end,g.scheduled_date+interval '2 hours')>v_start
    )
    AND EXISTS (SELECT 1 FROM public.player_travel_history t WHERE t.profile_id=p.id)
    AND EXISTS (SELECT 1 FROM public.recording_sessions r WHERE r.profile_id=p.id)
    AND EXISTS (SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
    AND EXISTS (
      SELECT 1 FROM public.band_rehearsals r JOIN public.band_members bm ON bm.band_id=r.band_id
      WHERE bm.profile_id=p.id AND bm.member_status='active'
    )
    AND EXISTS (
      SELECT 1 FROM public.tour_travel_legs leg
      JOIN public.tours tour ON tour.id=leg.tour_id
      JOIN public.band_members bm ON bm.band_id=tour.band_id
      WHERE bm.profile_id=p.id AND bm.member_status='active' AND coalesce(bm.travels_with_band,true)
    )
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No eligible normal-player DJ reservation fixture';
  END IF;

  SELECT p.user_id INTO v_other FROM public.profiles p
    WHERE p.user_id<>v_actor LIMIT 1;
  IF v_other IS NULL THEN RAISE EXCEPTION 'Missing other-account fixture'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

  INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
  VALUES(v_actor,v_profile,'Phase 4 rollback fixture',
    jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
  RETURNING id INTO v_set;

  -- An internal owner connection can invoke the withheld function
  -- on behalf of an authenticated actor; the normal client cannot.
  v_booking := public.reserve_dj_booking_internal(
    v_profile,v_club,v_set,v_start,v_request);
  IF v_booking IS NULL THEN RAISE EXCEPTION 'No reservation returned'; END IF;

  SELECT p.cash,p.fame INTO v_cash_after,v_fame_after FROM public.profiles p
   WHERE id=v_profile;
  IF v_cash_after IS DISTINCT FROM v_cash OR v_fame_after IS DISTINCT FROM v_fame
  THEN RAISE EXCEPTION 'SECURITY FAILURE: a reservation changed cash or fame'; END IF;

  SELECT public.reserve_dj_booking_internal(
    v_profile,v_club,v_set,v_start,v_request) INTO v_again;
  IF v_booking IS DISTINCT FROM v_again
  THEN RAISE EXCEPTION 'Idempotent retry created a second reservation'; END IF;

  IF (SELECT count(*) FROM public.dj_bookings WHERE id=v_booking)<>1
  THEN RAISE EXCEPTION 'Missing unique reservation row'; END IF;


  -- Source-of-truth systems also must reject bookings created *after*
  -- a DJ reservation, even if they have no Schedule mirror.
  BEGIN
    INSERT INTO public.player_travel_history(
      user_id,profile_id,to_city_id,transport_type,cost_paid,travel_duration_hours,
      departure_time,scheduled_departure_time,arrival_time,status
    ) VALUES (
      v_actor,v_profile,(SELECT city_id FROM public.city_night_clubs WHERE id=v_club),
      'train',0,1,v_start+interval '5 minutes',v_start+interval '5 minutes',
      v_start+interval '50 minutes','scheduled'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: personal travel was booked over DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.recording_sessions SET
      status='scheduled',scheduled_start=v_start+interval '5 minutes',
      scheduled_end=v_start+interval '40 minutes'
    WHERE id=(SELECT r.id FROM public.recording_sessions r
      WHERE r.profile_id=v_profile LIMIT 1);
    RAISE EXCEPTION 'SECURITY FAILURE: recording was booked over DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.profile_activity_statuses SET
      status='active',activity_type='work_shift',
      started_at=v_start+interval '5 minutes',
      ends_at=v_start+interval '45 minutes'
    WHERE id=(SELECT a.id FROM public.profile_activity_statuses a
      WHERE a.profile_id=v_profile LIMIT 1);
    RAISE EXCEPTION 'SECURITY FAILURE: work shift was booked over DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.band_rehearsals SET status='scheduled',
      scheduled_start=v_start+interval '5 minutes',
      scheduled_end=v_start+interval '40 minutes'
    WHERE id=(SELECT r.id FROM public.band_rehearsals r
      JOIN public.band_members bm ON bm.band_id=r.band_id
      WHERE bm.profile_id=v_profile AND bm.member_status='active' LIMIT 1);
    RAISE EXCEPTION 'SECURITY FAILURE: band rehearsal was booked over DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.tour_travel_legs SET
      status='scheduled',departure_date=v_start+interval '5 minutes',
      arrival_date=v_start+interval '45 minutes'
    WHERE id=(SELECT leg.id FROM public.tour_travel_legs leg
      JOIN public.tours tour ON tour.id=leg.tour_id
      JOIN public.band_members bm ON bm.band_id=tour.band_id
      WHERE bm.profile_id=v_profile AND bm.member_status='active'
        AND coalesce(bm.travels_with_band,true)
      LIMIT 1);
    RAISE EXCEPTION 'SECURITY FAILURE: band tour leg was booked over DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;


  -- Recurring university classes must also reject new enrolments when the
  -- player's DJ slot is already reserved (classes often have no mirror row).
  SELECT club.id,
    ((date_trunc('day',now() AT TIME ZONE city.timezone)
      + interval '10 days 10 hours') AT TIME ZONE city.timezone)
  INTO v_morning_club,v_morning_start
  FROM public.city_night_clubs club JOIN public.cities city ON city.id=club.city_id
  WHERE club.dj_slot_config->>'schedule'='midnight-noon'
    AND city.timezone='Europe/Berlin'
  LIMIT 1;

  SELECT c.id,u.id INTO v_basic_course,v_basic_uni
  FROM public.university_courses c
  JOIN public.universities u ON u.id=c.university_id
  JOIN public.cities city ON city.id=u.city_id
  WHERE city.timezone='Europe/Berlin' AND c.class_start_hour=10
    AND c.class_end_hour>10 AND c.skill_slug LIKE 'basic_%'
    AND public.skill_tier_unlocked(v_profile,c.skill_slug)
  LIMIT 1;

  IF v_morning_club IS NULL OR v_basic_course IS NULL THEN
    RAISE EXCEPTION 'No morning club and eligible course fixture for university reverse gate';
  END IF;

  INSERT INTO public.dj_bookings(
    user_id,profile_id,club_id,setlist_id,setlist_version,setlist_snapshot,
    request_id,starts_at,ends_at,status
  )
  SELECT v_actor,v_profile,v_morning_club,v_set,version,items,
    gen_random_uuid(),v_morning_start,v_morning_start+interval '45 minutes','booked'
  FROM public.dj_setlists WHERE id=v_set
  RETURNING id INTO v_morning_set;

  BEGIN
    INSERT INTO public.player_university_enrollments(
      user_id,profile_id,university_id,course_id,enrolled_at,
      scheduled_end_date,status,payment_amount
    ) VALUES(
      v_actor,v_profile,v_basic_uni,v_basic_course,
      now()-interval '1 day',now()+interval '30 days',
      'enrolled',0
    );
    RAISE EXCEPTION 'SECURITY FAILURE: university enrolment overlapped reserved DJ set';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  -- Booking insert must atomically create exactly one canonical DJ calendar row.
  IF (SELECT count(*) FROM public.player_scheduled_activities
      WHERE linked_dj_booking_id=v_booking AND activity_type='dj_set'
        AND status='scheduled' AND user_id=v_actor AND profile_id=v_profile
        AND scheduled_start=v_start)<>1
  THEN RAISE EXCEPTION 'DJ booking failed to project its canonical schedule'; END IF;

  BEGIN
    INSERT INTO public.player_scheduled_activities(
      user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title)
    VALUES(v_actor,v_profile,'reading',v_start+interval '5 minutes',
      v_start+interval '35 minutes','scheduled','Test overlapping reading');
    RAISE EXCEPTION 'SECURITY FAILURE: future overlapping education event allowed';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;


  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '1 minute',gen_random_uuid());
    RAISE EXCEPTION 'SECURITY FAILURE: overlapping DJ reservation accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '1 minute',v_request);
    RAISE EXCEPTION 'SECURITY FAILURE: idempotency key accepted other booking';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Even a privileged booking writer may not insert/update outside
  -- verified club-local hours. The trigger is a second defence beyond RPC.
  IF public.dj_booking_inside_club_hours(
     v_club,v_start + interval '12 hours',v_start + interval '13 hours')
  THEN RAISE EXCEPTION 'Nightclub late-morning slot unexpectedly valid'; END IF;

  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start + interval '12 hours',gen_random_uuid());
    RAISE EXCEPTION 'SECURITY FAILURE: after-hours reservation accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    UPDATE public.dj_bookings SET
      starts_at=v_start + interval '12 hours',
      ends_at=v_start + interval '13 hours'
    WHERE id=v_booking;
    RAISE EXCEPTION 'SECURITY FAILURE: privileged after-hours update accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  PERFORM set_config('dj_test.actor',v_actor::text,true);
  PERFORM set_config('dj_test.booking_id',v_booking::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '2 days',gen_random_uuid());
    RAISE EXCEPTION 'SECURITY FAILURE: foreign account booked somebody else';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $test$;

-- The actual owner can READ the calendar but cannot forge, edit or delete
-- its system-managed booking row using their authenticated DB role.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('dj_test.actor'),true);
DO $owner_schedule$
DECLARE v_booking uuid := current_setting('dj_test.booking_id')::uuid; v_n integer;
BEGIN
 SELECT count(*) INTO v_n FROM public.player_scheduled_activities
 WHERE linked_dj_booking_id=v_booking AND status='scheduled';
 IF v_n<>1 THEN RAISE EXCEPTION 'Booking owner cannot view DJ calendar entry'; END IF;

 BEGIN
   UPDATE public.player_scheduled_activities SET status='completed'
   WHERE linked_dj_booking_id=v_booking;
   RAISE EXCEPTION 'SECURITY FAILURE: owner self-completed a DJ booking';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM public.player_scheduled_activities
   WHERE linked_dj_booking_id=v_booking;
   RAISE EXCEPTION 'SECURITY FAILURE: owner deleted protected DJ schedule';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO public.player_scheduled_activities(
     user_id,profile_id,activity_type,scheduled_start,scheduled_end,title)
   SELECT user_id,profile_id,'dj_set',scheduled_start,scheduled_end,'Forged DJ'
   FROM public.player_scheduled_activities WHERE linked_dj_booking_id=v_booking;
   RAISE EXCEPTION 'SECURITY FAILURE: owner inserted a fake DJ gig';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $owner_schedule$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('dj_test.actor'),true);
DO $cancel$
DECLARE v_booking uuid := current_setting('dj_test.booking_id')::uuid;
DECLARE v_actor uuid := auth.uid();
DECLARE v_profile uuid; v_club uuid; v_set uuid; v_start timestamptz;
DECLARE v_next uuid; v_cancelled uuid;
BEGIN
 SELECT profile_id,club_id,setlist_id,starts_at INTO v_profile,v_club,v_set,v_start
 FROM public.dj_bookings WHERE id=v_booking;
 v_cancelled:=public.cancel_dj_booking_internal(v_booking);
 IF v_cancelled<>v_booking THEN RAISE EXCEPTION 'Cancellation returned wrong booking'; END IF;
 IF (SELECT status FROM public.player_scheduled_activities WHERE linked_dj_booking_id=v_booking)<>'cancelled'
 THEN RAISE EXCEPTION 'Cancellation did not update the calendar'; END IF;
 IF public.cancel_dj_booking_internal(v_booking)<>v_booking
 THEN RAISE EXCEPTION 'Cancellation retry was not idempotent'; END IF;
 -- A cancelled slot is rebookable without collision with a cancelled calendar.
 v_next:=public.reserve_dj_booking_internal(v_profile,v_club,v_set,v_start,gen_random_uuid());
 IF v_next=v_booking THEN RAISE EXCEPTION 'Rebooking after cancellation reused an ID'; END IF;
 IF (SELECT count(*) FROM public.player_scheduled_activities
     WHERE linked_dj_booking_id IN (v_booking,v_next))<>2
 THEN RAISE EXCEPTION 'Rebook failed to preserve cancellation history'; END IF;
 PERFORM public.cancel_dj_booking_internal(v_next);
END $cancel$;

SELECT set_config('request.jwt.claim.sub', (
  SELECT p.user_id::text FROM public.profiles p
  WHERE p.user_id<>current_setting('dj_test.actor')::uuid LIMIT 1
),true);
SET LOCAL ROLE authenticated;
DO $non_admin$
BEGIN
  IF has_function_privilege(current_user,
       'public.reserve_dj_booking_internal(uuid,uuid,uuid,timestamptz,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'SECURITY FAILURE: public booking RPC activated early'; END IF;
  IF (SELECT count(*) FROM public.dj_bookings)<>0
  THEN RAISE EXCEPTION 'SECURITY FAILURE: other account saw private DJ booking'; END IF;
END $non_admin$;

ROLLBACK;
