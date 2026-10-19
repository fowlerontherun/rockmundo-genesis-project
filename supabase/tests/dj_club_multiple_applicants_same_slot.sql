BEGIN;
DO $test$
DECLARE v_owner_user uuid;v_owner_profile uuid;v_club uuid;v_owned uuid;
 v_second_user uuid;v_second_profile uuid;v_track uuid;v_owner_set uuid;v_second_set uuid;
 v_a uuid;v_b uuid;v_start timestamptz:=clock_timestamp()+interval '2 days';
BEGIN
 SELECT p.user_id,p.id,c.id INTO v_owner_user,v_owner_profile,v_club
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>=CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000
 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 AND EXISTS(SELECT 1 FROM public.profiles q WHERE q.current_city_id=p.current_city_id
 AND q.id<>p.id AND q.is_active AND q.died_at IS NULL AND q.user_id<>p.user_id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_owner_user IS NULL THEN
  RAISE NOTICE 'No two-actor eligible fixture; overlap logic asserted by migration';
  RETURN;
 END IF;
 SELECT p.user_id,p.id INTO v_second_user,v_second_profile FROM public.profiles p
 WHERE p.current_city_id=(SELECT c.city_id FROM public.city_night_clubs c WHERE c.id=v_club)
 AND p.id<>v_owner_profile AND p.user_id<>v_owner_user AND p.is_active AND p.died_at IS NULL
 AND p.user_id IS NOT NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_owner_user::text,true);
 v_owned:=(public.purchase_nightclub_atomic(v_owner_profile,v_club,gen_random_uuid())->>'owned_club_id')::uuid;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Two DJ Fixture','Club DJ','House','catalog/'||gen_random_uuid()||'/fixture.mp3',
 true,'Rollback-only fixture',true,v_owner_user) RETURNING id INTO v_track;
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_owner_user,v_owner_profile,'Owner DJ',jsonb_build_array(jsonb_build_object('source','admin','id',v_track::text)))
 RETURNING id INTO v_owner_set;
 v_a:=public.apply_for_nightclub_dj_slot(v_owner_profile,v_owned,v_owner_set,v_start,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',v_second_user::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_second_user,v_second_profile,'Guest DJ',jsonb_build_array(jsonb_build_object('source','admin','id',v_track::text)))
 RETURNING id INTO v_second_set;
 v_b:=public.apply_for_nightclub_dj_slot(v_second_profile,v_owned,v_second_set,v_start,gen_random_uuid());
 IF v_a IS DISTINCT FROM v_b
  AND (SELECT count(*) FROM public.dj_club_applications a
       WHERE a.owned_club_id=v_owned AND a.starts_at=v_start AND a.status='pending')=2
 THEN RAISE NOTICE 'Two distinct DJs can apply to the same club slot without stage reservation';
 ELSE RAISE EXCEPTION 'Multiple applicants per proposed club slot not supported'; END IF;
END $test$;
ROLLBACK;