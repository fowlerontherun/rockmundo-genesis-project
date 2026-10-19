BEGIN;
DO $verify$
DECLARE
 v_actor uuid; v_profile uuid; v_club uuid; v_owner uuid; v_event uuid;
 v_key uuid:=gen_random_uuid(); v_result jsonb; v_replay jsonb; v_second jsonb;
 v_events_before integer;
BEGIN
 IF has_function_privilege('anon','public.manage_owned_nightclub_theme_night(uuid,integer,text,uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.manage_owned_nightclub_theme_night(uuid,integer,text,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Owner theme-night function has incorrect execute grants'; END IF;
 SELECT p.user_id,p.id,c.id INTO v_actor,v_profile,v_club
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM auth.users a WHERE a.id=p.user_id)
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash >= CASE c.quality_level
  WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000 WHEN 4 THEN 150000
  WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_actor IS NULL THEN
  RAISE NOTICE 'No eligible fixture; permission assertions passed';
  RETURN;
 END IF;
 SELECT count(*) INTO v_events_before FROM public.nightclub_events;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_owner:=(public.purchase_nightclub_atomic(v_profile,v_club,gen_random_uuid())->>'owned_club_id')::uuid;
 v_result:=public.manage_owned_nightclub_theme_night(v_owner,4,'set',v_key,'Synthwave Thursday','Synthwave');
 v_event:=(v_result->>'event_id')::uuid;
 IF v_event IS NULL OR (v_result->>'replayed')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Owner theme night not created exactly once'; END IF;
 v_replay:=public.manage_owned_nightclub_theme_night(v_owner,4,'set',v_key,'Synthwave Thursday','Synthwave');
 IF (v_replay->>'event_id')::uuid IS DISTINCT FROM v_event
 OR (v_replay->>'replayed')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Retry created a different event or lost replay status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nightclub_events e
  WHERE e.id=v_event AND e.club_id=v_club AND e.managed_by_owned_club_id=v_owner
   AND e.is_active AND e.is_recurring AND e.day_of_week=4
   AND e.event_name='Synthwave Thursday' AND e.genre_focus='Synthwave'
   AND e.fame_multiplier=1 AND e.xp_multiplier=1 AND e.cover_charge_override IS NULL
   AND e.special_guest_name IS NULL AND e.scheduled_date IS NULL)
 THEN RAISE EXCEPTION 'Theme night had incorrect game-day, identity or rewards'; END IF;
 BEGIN
  PERFORM public.manage_owned_nightclub_theme_night(v_owner,4,'set',v_key,'Different Theme','House');
  RAISE EXCEPTION 'Changed-intent retry was accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 v_second:=public.manage_owned_nightclub_theme_night(v_owner,4,'set',gen_random_uuid(),'House Thursday','House');
 IF (v_second->>'event_id')::uuid IS DISTINCT FROM v_event THEN
  RAISE EXCEPTION 'Edited event duplicated weekday'; END IF;
 BEGIN
  PERFORM public.manage_owned_nightclub_theme_night(v_owner,7,'set',gen_random_uuid(),'Invalid Weekday','House');
  RAISE EXCEPTION 'Invalid game weekday accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.manage_owned_nightclub_theme_night(v_owner,5,'set',gen_random_uuid(),'A','H');
  RAISE EXCEPTION 'Invalid name and genre accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.manage_owned_nightclub_theme_night(v_owner,4,'disable',gen_random_uuid(),NULL,NULL);
  RAISE EXCEPTION 'Foreign actor disabled owner event';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_second:=public.manage_owned_nightclub_theme_night(v_owner,4,'disable',gen_random_uuid(),NULL,NULL);
 IF (v_second->>'event_id')::uuid IS DISTINCT FROM v_event
 OR EXISTS(SELECT 1 FROM public.nightclub_events e WHERE e.id=v_event AND e.is_active) THEN
  RAISE EXCEPTION 'Disabling failed or altered identity'; END IF;
 IF (SELECT count(*) FROM public.nightclub_events)<>v_events_before+1 THEN
  RAISE EXCEPTION 'Unexpected new event rows'; END IF;
 RAISE NOTICE 'Owner game-weekday contract passed; all writes are about to rollback';
END $verify$;
ROLLBACK;