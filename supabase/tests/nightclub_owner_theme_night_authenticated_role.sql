-- Actual authenticated Postgres-role RPC and read-policy contract; rollback only.
BEGIN;
DO $fixture$
DECLARE v_actor uuid; v_profile uuid; v_club uuid; v_purchase jsonb;
BEGIN
 SELECT p.user_id,p.id,c.id INTO v_actor,v_profile,v_club
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active=true AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash >= CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000
   WHEN 4 THEN 150000 WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_actor IS NULL THEN
  PERFORM set_config('app.test_owner_theme_night','',true);
  RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_purchase:=public.purchase_nightclub_atomic(v_profile,v_club,gen_random_uuid());
 PERFORM set_config('app.test_owner_theme_night',v_purchase->>'owned_club_id',true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $real_role$
DECLARE v_owner_text text:=current_setting('app.test_owner_theme_night',true);
 v_owner_id uuid; v_event_id uuid; v_result jsonb;
BEGIN
 IF v_owner_text IS NULL OR v_owner_text='' THEN
  RAISE NOTICE 'No eligible fixture; authenticated role execution assertions skipped';
  RETURN;
 END IF;
 v_owner_id:=v_owner_text::uuid;
 v_result:=public.manage_owned_nightclub_theme_night(
  v_owner_id,0,'set',gen_random_uuid(),'Sunday Guitar Sessions','Rock');
 v_event_id:=(v_result->>'event_id')::uuid;
 IF v_event_id IS NULL THEN
  RAISE EXCEPTION 'Authenticated owner RPC failed to return event';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nightclub_events e
   WHERE e.id=v_event_id AND e.is_active AND e.genre_focus='Rock'
   AND e.day_of_week=0 AND e.fame_multiplier=1 AND e.xp_multiplier=1) THEN
  RAISE EXCEPTION 'Authenticated role cannot see valid event or rewards changed';
 END IF;
 v_result:=public.manage_owned_nightclub_theme_night(v_owner_id,0,'disable',
    gen_random_uuid(),NULL,NULL);
 IF (v_result->>'event_id')::uuid IS DISTINCT FROM v_event_id THEN
  RAISE EXCEPTION 'Authenticated owner failed to disable its own event';
 END IF;
END $real_role$;
ROLLBACK;