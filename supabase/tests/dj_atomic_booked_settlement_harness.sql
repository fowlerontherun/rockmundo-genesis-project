-- Production regression: all fixtures, wallet/XP changes, history and
-- settlement entries are rolled back. Private _at helpers are owner-only and
-- never executable by authenticated clients or service_role.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
 v_actor uuid; v_other uuid; v_profile uuid; v_song uuid; v_club uuid;
 v_start timestamptz; v_set uuid; v_book uuid; v_session uuid;
 v_finish timestamptz; v_result uuid; v_result_again uuid;
 v_cash bigint; v_fame int; v_energy int; v_cash_after bigint;
 v_fame_after int; v_energy_after int;
 v_fake_history uuid;
 v_wallet_cash_before bigint; v_wallet_cash_after bigint;
 v_skill_before int; v_skill_after int;
 v_once_key uuid:=gen_random_uuid();
 v_once_result uuid;
BEGIN
 SELECT p.user_id,p.id,s.id,c.id,p.cash,p.fame,p.energy,
  ((date_trunc('day', now() AT TIME ZONE city.timezone) + interval '8 days'
    +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%'
      THEN interval '23 hours' ELSE interval '22 hours' END)
    AT TIME ZONE city.timezone)
 INTO v_actor,v_profile,v_song,v_club,v_cash,v_fame,v_energy,v_start
 FROM public.profiles p
 JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
 JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 JOIN public.cities city ON city.id=c.city_id
 JOIN public.user_roles role ON role.user_id=p.user_id
   AND role.role='user'::public.app_role
 WHERE s.status='recorded' AND s.audio_url IS NOT NULL
   AND NOT COALESCE(s.archived,false)
   AND coalesce(p.energy,0)>=25
   AND COALESCE(p.fame,0)>=COALESCE((c.dj_slot_config->>'minimum_fame')::integer,0)
   AND c.dj_slot_config->>'schedule' IN ('11pm-3am','10pm-2am','11pm-4am')
   AND public.dj_external_schedule_conflict(
     p.id,
     ((date_trunc('day', now() AT TIME ZONE city.timezone)+interval '8 days'
       +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%'
           THEN interval '23 hours' ELSE interval '22 hours' END)
       AT TIME ZONE city.timezone),
     ((date_trunc('day', now() AT TIME ZONE city.timezone)+interval '8 days'
       +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%'
           THEN interval '23 hours' ELSE interval '22 hours' END)
       AT TIME ZONE city.timezone)+interval '3 hours'
   ) IS NULL
 LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'No eligible valid-time DJ start fixture'; END IF;
 SELECT user_id INTO v_other FROM public.profiles WHERE user_id<>v_actor LIMIT 1;
 IF v_other IS NULL THEN RAISE EXCEPTION 'No secondary actor'; END IF;

 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_actor,v_profile,'Settlement rollback fixture',
   jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
 RETURNING id INTO v_set;

 v_book:=public.reserve_dj_booking_internal(
   v_profile,v_club,v_set,v_start,gen_random_uuid());
 SELECT ends_at INTO v_finish FROM public.dj_bookings WHERE id=v_book;

 BEGIN
   PERFORM private.dj_start_booking_at(v_book,v_start-interval '20 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: premature start allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;

 PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
 BEGIN
   PERFORM private.dj_start_booking_at(v_book,v_start);
   RAISE EXCEPTION 'SECURITY FAILURE: foreign actor started DJ booking';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

 -- Source rights must be rechecked at start, not trusted from a
 -- booking snapshot. Simulate a song no longer playable, then restore.
 UPDATE public.songs SET archived=true WHERE id=v_song;
 BEGIN
   PERFORM private.dj_start_booking_at(v_book,v_start+interval '1 minute');
   RAISE EXCEPTION 'SECURITY FAILURE: unavailable song played from stale set';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT energy FROM public.profiles WHERE id=v_profile)<>v_energy THEN
    RAISE EXCEPTION 'Rejected start consumed energy'; END IF;
 UPDATE public.songs SET archived=false WHERE id=v_song;

 v_session:=private.dj_start_booking_at(v_book,v_start+interval '1 minute');
 IF v_session IS NULL THEN RAISE EXCEPTION 'Start produced no session'; END IF;
 IF private.dj_start_booking_at(v_book,v_start+interval '2 minutes')<>v_session
 THEN RAISE EXCEPTION 'Duplicate start charged energy again'; END IF;
 IF (SELECT energy FROM public.profiles WHERE id=v_profile)<>v_energy-25
 THEN RAISE EXCEPTION 'Energy not deducted exactly once'; END IF;
 IF (SELECT count(*) FROM public.player_scheduled_activities
   WHERE linked_dj_booking_id=v_book AND status='in_progress')<>1
 THEN RAISE EXCEPTION 'Booked DJ set did not transition to in-progress'; END IF;

 BEGIN
   PERFORM private.dj_settle_booking_at(v_book,v_start+interval '3 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: paid before slot end';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
 BEGIN
   PERFORM private.dj_settle_booking_at(v_book,v_finish+interval '1 minute');
   RAISE EXCEPTION 'SECURITY FAILURE: foreign account settled booked DJ set';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

 -- No browser / practice-only mixer actions may settle a paid session.
 -- The new settlement ledger trigger must undo all attempted credit/XP.
 BEGIN
   PERFORM private.dj_settle_booking_at(v_book,v_finish+interval '1 minute');
   RAISE EXCEPTION 'SECURITY FAILURE: DJ session paid without mixing evidence';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile)<>v_cash
 OR (SELECT fame FROM public.profiles WHERE id=v_profile)<>v_fame
 THEN RAISE EXCEPTION 'No-evidence denial failed to roll back rewards'; END IF;

 -- Real-time server event proofs: both decks + tempo + crossfade and
 -- time-separated interaction into the second half of the booked set.
 -- The server rejects out-of-setlist songs, client-forged event times,
 -- cross-account performers, and impossible controls before appending.
 PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
 BEGIN
   PERFORM private.dj_record_mix_event_at(v_book,'deck_play','A','game',v_song,NULL,v_start+interval '2 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: foreign player logged mixer activity';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 BEGIN
   PERFORM private.dj_record_mix_event_at(v_book,'deck_play','A','game',gen_random_uuid(),NULL,v_start+interval '2 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: unbooked track credited';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM private.dj_record_mix_event_at(v_book,'crossfade',NULL,NULL,NULL,400,v_start+interval '2 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: invalid crossfader accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
   PERFORM private.dj_record_mix_event_at(v_book,'tempo','A',NULL,NULL,102,v_finish+interval '10 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: post-performance event accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

 v_once_result:=private.dj_record_mix_event_once_at(
   v_book,'deck_play','A','game',v_song,NULL,v_once_key,v_start+interval '2 minutes');
 IF private.dj_record_mix_event_once_at(
   v_book,'deck_play','A','game',v_song,NULL,v_once_key,v_start+interval '2 minutes 1 second')
   <>v_once_result THEN RAISE EXCEPTION 'Mixer retry did not return original event'; END IF;
 IF (SELECT count(*) FROM public.dj_live_mix_events WHERE booking_id=v_book)<>1
 THEN RAISE EXCEPTION 'Mixer retry added duplicate event'; END IF;
 BEGIN
   PERFORM private.dj_record_mix_event_once_at(
     v_book,'tempo','A',NULL,NULL,105,v_once_key,v_start+interval '3 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: event key reused with altered payload';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
 BEGIN
   PERFORM private.dj_record_mix_event_once_at(
     v_book,'deck_play','A','game',v_song,NULL,v_once_key,v_start+interval '2 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: foreign player replayed mixer event';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 BEGIN
   PERFORM private.dj_record_mix_event_at(v_book,'tempo','A',NULL,NULL,101,v_start+interval '2 minutes 1 second');
   RAISE EXCEPTION 'SECURITY FAILURE: events counted without elapsed time';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM private.dj_record_mix_event_at(v_book,'tempo','A',NULL,NULL,101,v_start+interval '3 minutes');
 PERFORM private.dj_record_mix_event_at(v_book,'crossfade',NULL,NULL,NULL,35,v_start+interval '4 minutes');
 PERFORM private.dj_record_mix_event_at(v_book,'deck_play','B','game',v_song,NULL,v_start+interval '5 minutes');
 PERFORM private.dj_record_mix_event_at(v_book,'tempo','B',NULL,NULL,99,v_start+interval '25 minutes');
 PERFORM private.dj_record_mix_event_at(v_book,'crossfade',NULL,NULL,NULL,78,v_start+interval '30 minutes');

 IF (SELECT count(*) FROM public.dj_live_mix_events WHERE booking_id=v_book)<>6
 THEN RAISE EXCEPTION 'Missing server-recorded mixer interactions'; END IF;
 
 -- Force a history uniqueness failure *after* the calculation and profile/XP
 -- writes. The settlement subtransaction MUST roll everything back.
 INSERT INTO public.player_dj_performances(
   user_id,profile_id,club_id,booking_id,
   performance_score,cash_earned,fame_gained,fans_gained,xp_gained,set_length_minutes
 ) VALUES(v_actor,v_profile,v_club,v_book,50,0,0,0,0,45)
 RETURNING id INTO v_fake_history;
 SELECT COALESCE(sum(sp.current_xp),0) INTO v_skill_before
 FROM public.skill_progress sp WHERE sp.profile_id=v_profile AND
    sp.skill_slug IN ('basic_dj_controller','professional_djing','dj_mastery');

 BEGIN
   PERFORM private.dj_settle_booking_at(v_book,v_finish+interval '1 minute');
   RAISE EXCEPTION 'SECURITY FAILURE: duplicated booked performance was rewarded';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile)<>v_cash
   OR (SELECT fame FROM public.profiles WHERE id=v_profile)<>v_fame
 THEN RAISE EXCEPTION 'Atomic rollback failed to undo cash/fame'; END IF;
 IF (SELECT COALESCE(sum(sp.current_xp),0) FROM public.skill_progress sp
   WHERE sp.profile_id=v_profile AND sp.skill_slug IN
   ('basic_dj_controller','professional_djing','dj_mastery'))<>v_skill_before
 THEN RAISE EXCEPTION 'Atomic rollback failed to undo skill XP'; END IF;
 IF EXISTS(SELECT 1 FROM public.dj_settlement_ledger WHERE booking_id=v_book)
 THEN RAISE EXCEPTION 'Failed settlement wrote a durable ledger'; END IF;
 IF (SELECT status FROM public.dj_bookings WHERE id=v_book)<>'live'
 THEN RAISE EXCEPTION 'Failed settlement closed an unpaid booking'; END IF;
 DELETE FROM public.player_dj_performances WHERE id=v_fake_history;

 v_result:=private.dj_settle_booking_at(v_book,v_finish+interval '1 minute');
 IF v_result IS NULL THEN RAISE EXCEPTION 'Settlement produced no history'; END IF;
 SELECT cash,fame,energy INTO v_cash_after,v_fame_after,v_energy_after
  FROM public.profiles WHERE id=v_profile;
 IF v_cash_after<=v_cash OR v_fame_after<=v_fame OR v_energy_after<>v_energy-25
 THEN RAISE EXCEPTION 'Settlement changed unexpected balances'; END IF;
 IF (SELECT count(*) FROM public.dj_settlement_ledger WHERE booking_id=v_book)<>1
 OR (SELECT count(*) FROM public.player_dj_performances WHERE booking_id=v_book)<>1
 OR (SELECT count(*) FROM public.experience_ledger
       WHERE metadata->>'dj_booking_id'=v_book::text)<>1
 THEN RAISE EXCEPTION 'Settlement lacks exactly-once evidence'; END IF;
 IF (SELECT fans_gained FROM public.player_dj_performances WHERE id=v_result)<>0
 THEN RAISE EXCEPTION 'Phantom fans were awarded'; END IF;
 IF (SELECT status FROM public.player_scheduled_activities
       WHERE linked_dj_booking_id=v_book)<>'completed'
 THEN RAISE EXCEPTION 'Completed DJ set not shown as completed on Schedule'; END IF;
 -- Delayed mobile retry after completion must return the same accepted
 -- event ID, but a genuinely new event can no longer be submitted.
 IF private.dj_record_mix_event_once_at(
   v_book,'deck_play','A','game',v_song,NULL,v_once_key,v_finish+interval '5 minutes')
  <>v_once_result THEN RAISE EXCEPTION 'Post-settlement event replay failed'; END IF;
 BEGIN
   PERFORM private.dj_record_mix_event_once_at(
     v_book,'tempo','A',NULL,NULL,104,gen_random_uuid(),v_finish+interval '6 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: new events after completion accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 v_result_again:=private.dj_settle_booking_at(v_book,v_finish+interval '10 minutes');
 IF v_result_again<>v_result
 OR (SELECT cash FROM public.profiles WHERE id=v_profile)<>v_cash_after
 OR (SELECT fame FROM public.profiles WHERE id=v_profile)<>v_fame_after
 OR (SELECT energy FROM public.profiles WHERE id=v_profile)<>v_energy_after
 THEN RAISE EXCEPTION 'Replay awarded a second payout'; END IF;
 PERFORM set_config('dj_test.owner',v_actor::text,true);
 PERFORM set_config('dj_test.booking',v_book::text,true);
 PERFORM set_config('dj_test.profile',v_profile::text,true);
 PERFORM set_config('dj_test.club',v_club::text,true);
END $test$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('dj_test.owner'),true);
DO $owner_rls$
DECLARE
 v_book uuid:=current_setting('dj_test.booking')::uuid;
 v_actor uuid:=current_setting('dj_test.owner')::uuid;
 v_profile uuid:=current_setting('dj_test.profile')::uuid;
 v_club uuid:=current_setting('dj_test.club')::uuid;
BEGIN
 IF has_function_privilege(current_user,
   'public.start_dj_booking_internal(uuid)','EXECUTE')
 OR has_function_privilege(current_user,
   'public.settle_dj_booking_internal(uuid)','EXECUTE')
 OR has_schema_privilege(current_user,'private','USAGE')
 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can call server-only DJ lifecycle';
 END IF;
 IF (SELECT count(*) FROM public.dj_settlement_ledger
   WHERE booking_id=v_book)<>1
 THEN RAISE EXCEPTION 'Booked owner cannot read their settlement'; END IF;
 IF (SELECT count(*) FROM public.dj_performance_sessions
   WHERE booking_id=v_book)<>1
 THEN RAISE EXCEPTION 'Booked owner cannot read their DJ session'; END IF;
 IF (SELECT count(*) FROM public.dj_live_mix_events
   WHERE booking_id=v_book)<>6
 THEN RAISE EXCEPTION 'Owner cannot read six accepted live events'; END IF;
 IF has_table_privilege(current_user,'public.dj_live_mix_events','INSERT')
 OR has_function_privilege(current_user,
  'public.record_dj_mix_event_internal(uuid,text,text,text,uuid,numeric)','EXECUTE')
 OR has_function_privilege(current_user,
  'public.dj_verified_mix_event_service(uuid,uuid,text,text,text,uuid,numeric)','EXECUTE')
 OR has_function_privilege(current_user,
  'public.dj_verified_mix_event_once_service(uuid,uuid,text,text,text,uuid,numeric,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'SECURITY FAILURE: client can forge server mixer evidence'; END IF;
 BEGIN
   INSERT INTO public.player_dj_performances(
     user_id,profile_id,club_id,booking_id,
     performance_score,set_length_minutes,cash_earned,fame_gained,
     fans_gained,xp_gained
   ) VALUES(v_actor,v_profile,v_club,v_book,40,45,100,0,0,0);
   RAISE EXCEPTION 'SECURITY FAILURE: client impersonated settled booking';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $owner_rls$;
SELECT set_config('request.jwt.claim.sub',
 (SELECT p.user_id::text FROM public.profiles p
  WHERE p.user_id<>current_setting('dj_test.owner')::uuid LIMIT 1),true);
DO $foreign_event_rls$
BEGIN
 IF (SELECT count(*) FROM public.dj_live_mix_events
   WHERE booking_id=current_setting('dj_test.booking')::uuid)<>0
 THEN RAISE EXCEPTION 'SECURITY FAILURE: another player can read DJ mixer events'; END IF;
END $foreign_event_rls$;
RESET ROLE;

ROLLBACK;
