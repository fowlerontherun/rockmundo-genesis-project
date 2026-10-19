-- Synthetic two-player residency lifecycle, rolled back without booking or spending money.
BEGIN;
DO $case$
DECLARE
 owner_user uuid;owner_player uuid;dj_user uuid;dj_player uuid;
 venue uuid;venue_city uuid;tz text;len int;
 owned uuid;track uuid;set_id uuid;application uuid;residency uuid;
 request_key uuid:=gen_random_uuid();agreement_key uuid:=gen_random_uuid();
 first_slot timestamptz;second_slot timestamptz;first_local timestamp;
 proposed public.nightclub_dj_residencies%ROWTYPE;
 before_cash bigint;v_result jsonb;
 sweep_first integer;sweep_second integer;sweep_status text;
BEGIN
 IF has_table_privilege('authenticated','public.nightclub_dj_residencies','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_dj_residencies','UPDATE')
 OR has_table_privilege('authenticated','public.nightclub_dj_residency_actions','INSERT')
 OR has_function_privilege('anon','public.propose_nightclub_dj_residency(uuid,uuid,integer,integer,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.respond_nightclub_dj_residency(uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Residency browser privilege is insecure';END IF;
 SELECT p.user_id,p.id,c.id,c.city_id,city.timezone,
 coalesce((c.dj_slot_config->>'set_length_minutes')::int,45)
 INTO owner_user,owner_player,venue,venue_city,tz,len
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 JOIN public.cities city ON city.id=c.city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash>(CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
  WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+100
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 AND coalesce((c.dj_slot_config->>'set_length_minutes')::int,45) BETWEEN 15 AND 180
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO dj_user,dj_player FROM public.profiles p
 WHERE p.user_id<>owner_user AND p.user_id IS NOT NULL AND p.is_active AND p.died_at IS NULL
 LIMIT 1;
 IF owner_user IS NULL OR dj_user IS NULL THEN
  RAISE NOTICE 'No 2-actor residency fixture; ACL tests passed';RETURN;END IF;
 UPDATE public.profiles SET current_city_id=venue_city WHERE id=dj_player;
 SELECT x.st INTO first_slot FROM generate_series(
 clock_timestamp()+interval '2 days',clock_timestamp()+interval '6 days',
 interval '30 minutes') x(st)
 WHERE public.dj_booking_inside_club_hours(venue,x.st,x.st+make_interval(mins=>len))
 AND public.dj_booking_inside_club_hours(venue,
  ((x.st AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz,
  (((x.st AT TIME ZONE tz)+interval '7 days') AT TIME ZONE tz)+make_interval(mins=>len))
 ORDER BY x.st LIMIT 1;
 IF first_slot IS NULL THEN RAISE EXCEPTION 'No legal weekly fixture club slot';END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
 owned:=(public.purchase_nightclub_atomic(owner_player,venue,gen_random_uuid())->>'owned_club_id')::uuid;
 SELECT cash INTO before_cash FROM public.profiles WHERE id=owner_player;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Resident Fixture','Fixture DJ','House','catalog/'||gen_random_uuid()||'/residency.mp3',
 true,'Rollback only',true,owner_user) RETURNING id INTO track;
 PERFORM set_config('request.jwt.claim.sub',dj_user::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(dj_user,dj_player,'Resident DJ Mix',
 jsonb_build_array(jsonb_build_object('source','admin','id',track::text))) RETURNING id INTO set_id;
 application:=public.apply_for_nightclub_dj_slot(dj_player,owned,set_id,first_slot,gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
 PERFORM public.review_nightclub_dj_application(owned,application,'shortlist',gen_random_uuid());
 residency:=public.propose_nightclub_dj_residency(owned,application,2,100,request_key);
 IF public.propose_nightclub_dj_residency(owned,application,2,100,request_key) IS DISTINCT FROM residency
 THEN RAISE EXCEPTION 'Owner lost response generated duplicate agreement';END IF;
 BEGIN
  PERFORM public.propose_nightclub_dj_residency(owned,application,3,100,request_key);
  RAISE EXCEPTION 'Changed residency request key accepted';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 SELECT * INTO proposed FROM public.nightclub_dj_residencies a WHERE a.id=residency;
 second_slot:=proposed.planned_starts_at[2];
 first_local:=proposed.planned_starts_at[1] AT TIME ZONE tz;
 IF proposed.status<>'proposed' OR proposed.occurrence_count<>2
 OR second_slot AT TIME ZONE tz IS DISTINCT FROM first_local+interval '7 days'
 OR (SELECT cash FROM public.profiles WHERE id=owner_player)<>before_cash
 THEN RAISE EXCEPTION 'Residency plan created wrong local slots or owner debit';END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.respond_nightclub_dj_residency(residency,'accept',gen_random_uuid());
  RAISE EXCEPTION 'Unrelated account signed DJ residency';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',dj_user::text,true);
 v_result:=public.respond_nightclub_dj_residency(residency,'accept',agreement_key);
 IF (v_result->>'status')<>'agreed' THEN RAISE EXCEPTION 'Target DJ could not agree';END IF;
 v_result:=public.respond_nightclub_dj_residency(residency,'accept',agreement_key);
 IF (v_result->>'replayed')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'DJ agreement retry not idempotent';END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
 v_result:=public.respond_nightclub_dj_residency(residency,'end',gen_random_uuid());
 IF (v_result->>'status')<>'ended' THEN RAISE EXCEPTION 'Owner cannot end unbooked residency';END IF;
 PERFORM set_config('request.jwt.claim.sub',dj_user::text,true);
 v_result:=public.respond_nightclub_dj_residency(residency,'accept',agreement_key);
 IF (v_result->>'replayed')::boolean IS DISTINCT FROM true OR
  (v_result->>'status')<>'ended' THEN RAISE EXCEPTION 'Agreement retry lost original result';END IF;
 UPDATE public.nightclub_dj_residencies SET status='proposed',
  agreed_at=NULL,ended_at=NULL,created_at=clock_timestamp()-interval '72 hours',
  expires_at=clock_timestamp()-interval '1 minute' WHERE id=residency;
 sweep_first:=private.close_stale_nightclub_dj_residencies_internal(100);
 SELECT status INTO sweep_status FROM public.nightclub_dj_residencies WHERE id=residency;
 sweep_second:=private.close_stale_nightclub_dj_residencies_internal(100);
 IF sweep_first<>1 OR sweep_second<>0 OR sweep_status<>'expired' THEN
  RAISE EXCEPTION 'Residency expiry sweep first %, second %, status %',sweep_first,sweep_second,sweep_status;
 END IF;
 IF (SELECT count(*) FROM public.dj_bookings)>0
 OR (SELECT count(*) FROM public.nightclub_dj_funded_offers)>0
 OR (SELECT cash FROM public.profiles WHERE id=owner_player)<>before_cash THEN
 RAISE EXCEPTION 'Resident planning wrongly created paid, reserved or scheduled gigs';END IF;
 RAISE NOTICE 'Mutual DJ residency local weekly slots, exact replay, foreign denial and no money passed';
END $case$;
ROLLBACK;