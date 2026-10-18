-- This integration test runs against production as an owner, but ROLLBACKs
-- every change, including a temporary booking and attempted gig reschedule.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
 v_user uuid; v_profile uuid; v_song uuid; v_club uuid; v_gig uuid;
 v_start timestamptz; v_set uuid; v_booking uuid;
 v_cash numeric; v_fame numeric; v_n integer;
BEGIN
 SELECT p.user_id,p.id,s.id,club.id,g.id,p.cash,p.fame,
  ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
    + CASE WHEN club.dj_slot_config->>'schedule' LIKE '11pm%'
           THEN interval '23 hours' ELSE interval '22 hours' END)
  AT TIME ZONE city.timezone)
 INTO v_user,v_profile,v_song,v_club,v_gig,v_cash,v_fame,v_start
 FROM public.profiles p
 JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
 JOIN public.city_night_clubs club ON club.city_id=p.current_city_id
 JOIN public.cities city ON city.id=club.city_id
 JOIN public.band_members bm ON bm.profile_id=p.id AND bm.member_status='active'
 JOIN public.gigs g ON g.band_id=bm.band_id
 JOIN public.user_roles role ON role.user_id=p.user_id
  AND role.role='user'::public.app_role
 WHERE s.status='recorded' AND s.audio_url IS NOT NULL
  AND NOT COALESCE(s.archived,false)
  AND club.dj_slot_config->>'schedule' IN ('11pm-3am','10pm-2am','11pm-4am')
  AND COALESCE(p.fame,0)>=COALESCE((club.dj_slot_config->>'minimum_fame')::int,0)
  AND public.dj_external_schedule_conflict(
    p.id,
    ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
    + CASE WHEN club.dj_slot_config->>'schedule' LIKE '11pm%'
           THEN interval '23 hours' ELSE interval '22 hours' END)
     AT TIME ZONE city.timezone),
    ((date_trunc('day',now() AT TIME ZONE city.timezone)+interval '8 days'
    + CASE WHEN club.dj_slot_config->>'schedule' LIKE '11pm%'
           THEN interval '23 hours' ELSE interval '22 hours' END)
     AT TIME ZONE city.timezone) +interval '3 hours'
  ) IS NULL
 LIMIT 1;
 IF v_profile IS NULL THEN
   RAISE EXCEPTION 'No eligible DJ profile with band gig fixture';
 END IF;

 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_user,v_profile,'DJ/gig reverse fixture',
   jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
 RETURNING id INTO v_set;
 v_booking:=public.reserve_dj_booking_internal(
   v_profile,v_club,v_set,v_start,gen_random_uuid());

 BEGIN
   UPDATE public.gigs SET status='scheduled',
     scheduled_date=v_start+interval '5 minutes',
     scheduled_end=v_start+interval '45 minutes'
   WHERE id=v_gig;
   RAISE EXCEPTION 'SECURITY FAILURE: new band gig overlapped DJ booking';
 EXCEPTION WHEN exclusion_violation THEN NULL;
 END;

 -- The same protected helper must accept a non-overlapping new gig.
 PERFORM public._dj_assert_no_reserved_slot(
   v_profile,v_start+interval '2 days',v_start+interval '2 days 2 hours','Band gig');

 SELECT count(*) INTO v_n FROM public.player_scheduled_activities
 WHERE linked_dj_booking_id=v_booking AND status='scheduled';
 IF v_n<>1 THEN RAISE EXCEPTION 'DJ booking calendar mirror missing'; END IF;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile) IS DISTINCT FROM v_cash
    OR (SELECT fame FROM public.profiles WHERE id=v_profile) IS DISTINCT FROM v_fame
 THEN RAISE EXCEPTION 'SECURITY FAILURE: booking changed money or fame'; END IF;
END $test$;
ROLLBACK;
