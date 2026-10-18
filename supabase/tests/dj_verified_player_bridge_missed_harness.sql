-- Test production service bridge and missed states; entire transaction rolls back.
\set ON_ERROR_STOP on
BEGIN;

DO $fixture$
DECLARE v_actor uuid;v_other uuid;v_profile uuid;v_song uuid;v_club uuid;
 v_start timestamptz;v_set uuid;
BEGIN
 SELECT p.user_id,p.id,s.id,c.id,
  ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
  +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%'
    THEN interval '23 hours' ELSE interval '22 hours' END) AT TIME ZONE city.timezone)
 INTO v_actor,v_profile,v_song,v_club,v_start
 FROM public.profiles p
 JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
 JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 JOIN public.cities city ON city.id=c.city_id
 JOIN public.user_roles role ON role.user_id=p.user_id AND role.role='user'::public.app_role
 WHERE s.status='recorded' AND s.audio_url IS NOT NULL AND NOT coalesce(s.archived,false)
 AND c.dj_slot_config->>'schedule' IN ('11pm-3am','10pm-2am','11pm-4am')
 AND COALESCE(p.fame,0)>=COALESCE((c.dj_slot_config->>'minimum_fame')::integer,0)
 AND public.dj_external_schedule_conflict(p.id,
  ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
  +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%' THEN interval '23 hours'
   ELSE interval '22 hours' END) AT TIME ZONE city.timezone),
  ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
  +CASE WHEN c.dj_slot_config->>'schedule' LIKE '11pm%' THEN interval '23 hours'
   ELSE interval '22 hours' END) AT TIME ZONE city.timezone)+interval '3 hours')
 IS NULL
 LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'No normal player, music and club fixture'; END IF;
 SELECT user_id INTO v_other FROM public.profiles WHERE user_id<>v_actor LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_actor,v_profile,'Bridge rollback fixture',
   jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
 RETURNING id INTO v_set;
 PERFORM set_config('dj_fixture.actor',v_actor::text,true);
 PERFORM set_config('dj_fixture.other',v_other::text,true);
 PERFORM set_config('dj_fixture.profile',v_profile::text,true);
 PERFORM set_config('dj_fixture.club',v_club::text,true);
 PERFORM set_config('dj_fixture.set',v_set::text,true);
 PERFORM set_config('dj_fixture.time',v_start::text,true);
 PERFORM set_config('request.jwt.claim.sub','',true);
END $fixture$;

SET LOCAL ROLE authenticated;
DO $negative$
BEGIN
 IF has_function_privilege(current_user,
  'public.dj_verified_player_action_service(uuid,text,uuid,uuid,uuid,timestamptz,uuid,uuid)','EXECUTE')
 OR has_function_privilege(current_user,
  'public.mark_dj_booking_missed_internal(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'SECURITY FAILURE: normal user can invoke service-only DJ actions'; END IF;
END $negative$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $service$
DECLARE
 v_id uuid;v_actor uuid:=current_setting('dj_fixture.actor')::uuid;
 v_other uuid:=current_setting('dj_fixture.other')::uuid;
 v_profile uuid:=current_setting('dj_fixture.profile')::uuid;
 v_club uuid:=current_setting('dj_fixture.club')::uuid;
 v_set uuid:=current_setting('dj_fixture.set')::uuid;
 v_time timestamptz:=current_setting('dj_fixture.time')::timestamptz;
 v_request uuid:=gen_random_uuid();
BEGIN
 BEGIN
   PERFORM public.dj_verified_player_action_service(
     v_other,'reserve',v_profile,v_club,v_set,v_time,v_request,NULL);
   RAISE EXCEPTION 'SECURITY FAILURE: foreign actor reserved other profile';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 v_id:=public.dj_verified_player_action_service(
   v_actor,'reserve',v_profile,v_club,v_set,v_time,v_request,NULL);
 IF v_id IS NULL THEN RAISE EXCEPTION 'Bridge returned no booking ID'; END IF;
 IF public.dj_verified_player_action_service(
   v_actor,'reserve',v_profile,v_club,v_set,v_time,v_request,NULL)<>v_id
 THEN RAISE EXCEPTION 'Bridge repeat created a duplicate booking'; END IF;

 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Bridge leaked actor JWT claim'; END IF;
 PERFORM set_config('dj_fixture.booking',v_id::text,true);
END $service$;
RESET ROLE;

DO $missed$
DECLARE
 v_id uuid:=current_setting('dj_fixture.booking')::uuid;
 v_owner uuid:=current_setting('dj_fixture.actor')::uuid;
 v_other uuid:=current_setting('dj_fixture.other')::uuid;
 v_end timestamptz;
 v_energy_before int;v_cash_before bigint;v_fame_before int;
 v_profile uuid:=current_setting('dj_fixture.profile')::uuid;
BEGIN
 SELECT ends_at INTO v_end FROM public.dj_bookings WHERE id=v_id;
 SELECT energy,cash,fame INTO v_energy_before,v_cash_before,v_fame_before
 FROM public.profiles WHERE id=v_profile;

 PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
 BEGIN
   PERFORM private.dj_mark_missed_at(v_id,v_end+interval '12 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: wrong actor marked DJ missed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 BEGIN
   PERFORM private.dj_mark_missed_at(v_id,v_end+interval '3 minutes');
   RAISE EXCEPTION 'SECURITY FAILURE: DJ marked missed before grace elapsed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;

 IF private.dj_mark_missed_at(v_id,v_end+interval '11 minutes')<>v_id
 OR private.dj_mark_missed_at(v_id,v_end+interval '15 minutes')<>v_id
 THEN RAISE EXCEPTION 'Missed status not idempotent'; END IF;

 IF (SELECT status FROM public.dj_bookings WHERE id=v_id)<>'missed'
 OR (SELECT status FROM public.player_scheduled_activities
     WHERE linked_dj_booking_id=v_id)<>'missed'
 THEN RAISE EXCEPTION 'Missed state not mirrored on Schedule'; END IF;
 IF (SELECT energy FROM public.profiles WHERE id=v_profile)<>v_energy_before
 OR (SELECT cash FROM public.profiles WHERE id=v_profile)<>v_cash_before
 OR (SELECT fame FROM public.profiles WHERE id=v_profile)<>v_fame_before
 THEN RAISE EXCEPTION 'Unstarted DJ miss charged or rewarded player'; END IF;
 IF EXISTS(SELECT 1 FROM public.dj_settlement_ledger WHERE booking_id=v_id)
 THEN RAISE EXCEPTION 'Unstarted DJ set settled despite missing performance'; END IF;
END $missed$;

ROLLBACK;
