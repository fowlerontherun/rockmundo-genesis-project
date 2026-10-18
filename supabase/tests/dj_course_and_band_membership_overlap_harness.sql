-- DJ Phase 4: negative checks for course retiming and rejoining a band
-- with a scheduled rehearsal. ALL changes roll back. Requires owner connection.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
 v_actor uuid; v_profile uuid; v_song uuid; v_club uuid;
 v_zone text; v_start timestamptz; v_end timestamptz;
 v_uni uuid; v_course uuid; v_bm uuid; v_rehearsal uuid;
 v_set uuid; v_booking uuid; v_hour integer;
 v_cash numeric; v_fame numeric;
BEGIN
 SELECT p.user_id,p.id,s.id,n.id,city.timezone,p.cash,p.fame,
 ((date_trunc('day',now() AT TIME ZONE city.timezone) + interval '8 days'
   + CASE WHEN n.dj_slot_config->>'schedule' LIKE '11pm%'
        THEN interval '23 hours' ELSE interval '22 hours' END)
     AT TIME ZONE city.timezone)
 INTO v_actor,v_profile,v_song,v_club,v_zone,v_cash,v_fame,v_start
 FROM public.profiles p
 JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
 JOIN public.city_night_clubs n ON n.city_id=p.current_city_id
 JOIN public.cities city ON city.id=n.city_id
 JOIN public.user_roles ur ON ur.user_id=p.user_id AND ur.role='user'::public.app_role
 WHERE s.status='recorded' AND s.audio_url IS NOT NULL
 AND NOT COALESCE(s.archived,false)
 AND n.dj_slot_config->>'schedule' IN ('11pm-3am','10pm-2am','11pm-4am')
 AND COALESCE(p.fame,0)>=COALESCE((n.dj_slot_config->>'minimum_fame')::int,0)
 AND EXISTS(
   SELECT 1 FROM public.university_courses c
   JOIN public.universities un ON un.id=c.university_id
   JOIN public.cities campus ON campus.id=un.city_id
   WHERE campus.timezone=city.timezone AND c.class_start_hour=10
     AND c.skill_slug LIKE 'basic_%'
     AND public.skill_tier_unlocked(p.id,c.skill_slug)
 )
 AND EXISTS(
   SELECT 1 FROM public.band_rehearsals r
   JOIN public.band_members bm ON bm.band_id=r.band_id
   WHERE bm.profile_id=p.id AND bm.member_status='active'
 )
 LIMIT 1;
 IF v_profile IS NULL THEN RAISE EXCEPTION 'Missing owner/course/rehearsal fixture'; END IF;
 v_hour := extract(hour from v_start AT TIME ZONE v_zone)::int;
 v_end := v_start + interval '45 minutes';
 
 SELECT c.id,un.id INTO v_course,v_uni
 FROM public.university_courses c
 JOIN public.universities un ON un.id=c.university_id
 JOIN public.cities campus ON campus.id=un.city_id
 WHERE campus.timezone=v_zone AND c.class_start_hour=10
 AND c.skill_slug LIKE 'basic_%'
 AND public.skill_tier_unlocked(v_profile,c.skill_slug)
 LIMIT 1;
 
 SELECT bm.id,r.id INTO v_bm,v_rehearsal
 FROM public.band_members bm JOIN public.band_rehearsals r ON r.band_id=bm.band_id
 WHERE bm.profile_id=v_profile AND bm.member_status='active'
 LIMIT 1;
 IF v_course IS NULL OR v_rehearsal IS NULL THEN
   RAISE EXCEPTION 'Missing course or rehearsal fixture';
 END IF;

 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_actor,v_profile,'DJ course/band rollback test',
    jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
 RETURNING id INTO v_set;
 v_booking := public.reserve_dj_booking_internal(
    v_profile,v_club,v_set,v_start,gen_random_uuid());

 -- A morning course can be enrolled on its original safe timetable.
 INSERT INTO public.player_university_enrollments(
    user_id,profile_id,university_id,course_id,enrolled_at,
    scheduled_end_date,status,payment_amount
 ) VALUES (
    v_actor,v_profile,v_uni,v_course,now()-interval '1 day',
    now()+interval '30 days','enrolled',0
 );
 -- Changing shared class times must now be blocked, even without a class
 -- entry in player_scheduled_activities.
 BEGIN
   UPDATE public.university_courses SET
     class_start_hour=v_hour,
     class_end_hour=v_hour+1
   WHERE id=v_course;
   RAISE EXCEPTION 'SECURITY FAILURE: course retimed over DJ reservation';
 EXCEPTION WHEN exclusion_violation THEN NULL;
 END;
 -- Rejoining a band after a rehearsal has been booked must be checked too.
 UPDATE public.band_members SET member_status='inactive' WHERE id=v_bm;
 UPDATE public.band_rehearsals SET
   status='scheduled',
   scheduled_start=v_start + interval '5 minutes',
   scheduled_end=v_start + interval '40 minutes'
 WHERE id=v_rehearsal;
 BEGIN
   UPDATE public.band_members SET member_status='active' WHERE id=v_bm;
   RAISE EXCEPTION 'SECURITY FAILURE: band membership bypassed reserved DJ set';
 EXCEPTION WHEN exclusion_violation THEN NULL;
 END;

 IF (SELECT cash FROM public.profiles WHERE id=v_profile) IS DISTINCT FROM v_cash
    OR (SELECT fame FROM public.profiles WHERE id=v_profile) IS DISTINCT FROM v_fame
 THEN RAISE EXCEPTION 'SECURITY FAILURE: booking altered money or fame'; END IF;
 IF (SELECT count(*) FROM public.player_scheduled_activities
     WHERE linked_dj_booking_id=v_booking)<>1
 THEN RAISE EXCEPTION 'DJ booking lost calendar projection'; END IF;
END $test$;
ROLLBACK;
