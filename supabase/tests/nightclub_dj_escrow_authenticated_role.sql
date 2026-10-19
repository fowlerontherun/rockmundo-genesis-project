-- True Postgres authenticated-role test of escrow DML access and owner/DJ RPCs.
BEGIN;
DO $setup$
DECLARE ou uuid;op uuid;cid uuid;city uuid;du uuid;dp uuid;owned uuid;tr uuid;st uuid;app uuid;offer uuid;
BEGIN
 SELECT p.user_id,p.id,c.id,c.city_id INTO ou,op,cid,city
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash >= (CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
  WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+200
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO du,dp FROM public.profiles p
 WHERE p.user_id<>ou AND p.is_active AND p.died_at IS NULL LIMIT 1;
 IF ou IS NULL OR du IS NULL THEN PERFORM set_config('app.dj_escrow_role_offer','',true); RETURN;END IF;
 UPDATE public.profiles SET current_city_id=city WHERE id=dp;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owned:=(public.purchase_nightclub_atomic(op,cid,gen_random_uuid())->>'owned_club_id')::uuid;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Escrow Role Test','Test DJ','House','catalog/'||gen_random_uuid()||'/role.mp3',
 true,'Rollback-only fixture',true,ou) RETURNING id INTO tr;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(du,dp,'Escrow Set',jsonb_build_array(jsonb_build_object('source','admin','id',tr::text)))
 RETURNING id INTO st;
 app:=public.apply_for_nightclub_dj_slot(dp,owned,st,clock_timestamp()+interval '2 days',gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app,'shortlist',gen_random_uuid());
 -- Authenticated role will fund; do NOT pre-fund privileged.
 PERFORM set_config('app.dj_escrow_role_owner',ou::text,true);
 PERFORM set_config('app.dj_escrow_role_dj',du::text,true);
 PERFORM set_config('app.dj_escrow_role_club',owned::text,true);
 PERFORM set_config('app.dj_escrow_role_app',app::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $role$
DECLARE oid text:=current_setting('app.dj_escrow_role_club',true);
 v_app uuid;v_owner uuid;v_offer uuid;v_state jsonb;
BEGIN
 IF oid IS NULL OR oid='' THEN RAISE NOTICE 'No active 2-actor role fixture available';RETURN;END IF;
 v_owner:=oid::uuid;v_app:=current_setting('app.dj_escrow_role_app')::uuid;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_escrow_role_owner'),true);
 BEGIN
  INSERT INTO public.nightclub_dj_funded_offers(owned_club_id,application_id,
   owner_user_id,owner_profile_id,dj_user_id,dj_profile_id,fee,funding_request_id,expires_at)
  VALUES(v_owner,v_app,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
   gen_random_uuid(),50,gen_random_uuid(),clock_timestamp()+interval '1 day');
  RAISE EXCEPTION 'Authenticated browser forged escrow row';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 v_state:=public.fund_nightclub_dj_offer(v_owner,v_app,100,gen_random_uuid());
 v_offer:=(v_state->>'offer_id')::uuid;
 IF v_offer IS NULL OR (SELECT count(*) FROM public.nightclub_dj_funded_offers WHERE id=v_offer)<>1
 THEN RAISE EXCEPTION 'Verified owner funded RPC unavailable to authenticated role';END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('app.dj_escrow_role_dj'),true);
 IF (SELECT count(*) FROM public.nightclub_dj_funded_offers WHERE id=v_offer)<>1 THEN
  RAISE EXCEPTION 'Targeted authenticated DJ cannot view offer';END IF;
 v_state:=public.decide_nightclub_dj_offer(v_offer,'decline',gen_random_uuid());
 IF (v_state->>'status')<>'declined' THEN RAISE EXCEPTION 'DJ decline RPC did not refund';END IF;
END $role$;
ROLLBACK;