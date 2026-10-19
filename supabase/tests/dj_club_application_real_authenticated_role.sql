BEGIN;
DO $setup$
DECLARE v_actor uuid;v_profile uuid;v_club uuid;v_owned uuid;v_track uuid;v_set uuid;v_app uuid;
BEGIN
 SELECT p.user_id,p.id,c.id INTO v_actor,v_profile,v_club
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>=CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_actor IS NULL THEN PERFORM set_config('app.dj_test_application','',true);RETURN;END IF;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_owned:=(public.purchase_nightclub_atomic(v_profile,v_club,gen_random_uuid())->>'owned_club_id')::uuid;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Fixture','Fixture Artist','House','catalog/'||gen_random_uuid()||'/fixture.mp3',true,'Rollback-only fixture',true,v_actor)
 RETURNING id INTO v_track;
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_actor,v_profile,'Fixture',jsonb_build_array(jsonb_build_object('source','admin','id',v_track::text)))
 RETURNING id INTO v_set;
 v_app:=public.apply_for_nightclub_dj_slot(v_profile,v_owned,v_set,clock_timestamp()+interval '2 days',gen_random_uuid());
 PERFORM set_config('app.dj_test_application',v_app::text,true);
 PERFORM set_config('app.dj_test_owner',v_owned::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE v_raw text:=current_setting('app.dj_test_application',true);
 v_id uuid;v_owner uuid;v_result uuid;
BEGIN
 IF v_raw IS NULL OR v_raw='' THEN
  RAISE NOTICE 'No eligible fixture, real-role DJ contract skipped';RETURN;END IF;
 v_id:=v_raw::uuid;
 v_owner:=current_setting('app.dj_test_owner')::uuid;
 IF (SELECT count(*) FROM public.dj_club_applications a WHERE a.id=v_id)<>1 THEN
  RAISE EXCEPTION 'Authenticated player/verified owner cannot read application';END IF;
 BEGIN
  UPDATE public.dj_club_applications SET status='shortlisted' WHERE id=v_id;
  RAISE EXCEPTION 'Authenticated browser updated application directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 v_result:=public.review_nightclub_dj_application(v_owner,v_id,'shortlist',gen_random_uuid());
 IF v_result IS DISTINCT FROM v_id THEN
  RAISE EXCEPTION 'Authenticated verified owner review RPC returned another ID';END IF;
 IF (SELECT status FROM public.dj_club_applications WHERE id=v_id)<>'shortlisted' THEN
  RAISE EXCEPTION 'Authenticated owner cannot see shortlist state';END IF;
END $verify$;
ROLLBACK;