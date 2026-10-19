BEGIN;
DO $case$
DECLARE
 v_actor uuid; v_player uuid; v_club uuid; v_owner uuid; v_track uuid; v_set uuid;
 v_app uuid; v_replay uuid; v_review uuid; v_withdraw uuid;
 v_status text; v_req uuid:=gen_random_uuid(); v_review_req uuid:=gen_random_uuid();
 v_start timestamptz:=clock_timestamp()+interval '2 days';
BEGIN
 IF has_table_privilege('authenticated','public.dj_club_applications','INSERT')
 OR has_table_privilege('authenticated','public.dj_club_applications','UPDATE')
 OR has_function_privilege('anon','public.review_nightclub_dj_application(uuid,uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Unsafe DJ application ACL';END IF;
 SELECT p.user_id,p.id,c.id INTO v_actor,v_player,v_club
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>=CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
  WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_actor IS NULL THEN RAISE NOTICE 'No eligible fixture; ACL assertions passed';RETURN;END IF;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_owner:=(public.purchase_nightclub_atomic(v_player,v_club,gen_random_uuid())->>'owned_club_id')::uuid;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Fixture Track','Fixture DJ','House',
 'catalog/'||gen_random_uuid()||'/fixture.mp3',true,'Rollback-only fixture',true,v_actor)
 RETURNING id INTO v_track;
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(v_actor,v_player,'Fixture DJ Set',jsonb_build_array(
  jsonb_build_object('source','admin','id',v_track::text))) RETURNING id INTO v_set;
 IF public.get_verified_nightclub_application_club(v_club) IS DISTINCT FROM v_owner THEN
  RAISE EXCEPTION 'Verified club missing from discovery';END IF;
 v_app:=public.apply_for_nightclub_dj_slot(v_player,v_owner,v_set,v_start,v_req);
 v_replay:=public.apply_for_nightclub_dj_slot(v_player,v_owner,v_set,v_start,v_req);
 IF v_replay IS DISTINCT FROM v_app THEN RAISE EXCEPTION 'Application retry duplicated';END IF;
 BEGIN
  PERFORM public.apply_for_nightclub_dj_slot(v_player,v_owner,v_set,v_start+interval '60 minutes',v_req);
  RAISE EXCEPTION 'Changed request was accepted';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 BEGIN
  PERFORM public.apply_for_nightclub_dj_slot(v_player,v_owner,v_set,v_start+interval '20 minutes',gen_random_uuid());
  RAISE EXCEPTION 'Conflicting DJ application accepted';
 EXCEPTION WHEN exclusion_violation THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.review_nightclub_dj_application(v_owner,v_app,'shortlist',gen_random_uuid());
  RAISE EXCEPTION 'Foreign owner reviewed application';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_review:=public.review_nightclub_dj_application(v_owner,v_app,'shortlist',v_review_req);
 v_replay:=public.review_nightclub_dj_application(v_owner,v_app,'shortlist',v_review_req);
 SELECT a.status INTO v_status FROM public.dj_club_applications a WHERE a.id=v_app;
 IF v_review IS DISTINCT FROM v_app OR v_replay IS DISTINCT FROM v_app OR v_status<>'shortlisted'
 THEN RAISE EXCEPTION 'Review/replay failed';END IF;
 BEGIN
  PERFORM public.review_nightclub_dj_application(v_owner,v_app,'decline',gen_random_uuid());
  RAISE EXCEPTION 'Second review was accepted';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 v_withdraw:=public.withdraw_nightclub_dj_application(v_app);
 SELECT a.status INTO v_status FROM public.dj_club_applications a WHERE a.id=v_app;
 IF v_withdraw IS DISTINCT FROM v_app OR v_status<>'withdrawn'
 THEN RAISE EXCEPTION 'Withdraw after shortlist failed';END IF;
 IF EXISTS(SELECT 1 FROM public.dj_bookings b WHERE b.club_id=v_club)
 THEN RAISE EXCEPTION 'Application minted a DJ booking';END IF;
 RAISE NOTICE 'DJ application/shortlist/foreign denial/retry/withdraw tests passed';
END $case$;
ROLLBACK;