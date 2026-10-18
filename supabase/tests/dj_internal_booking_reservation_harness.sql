-- Internal Phase 4 reservation checks. Run as a database owner.
-- Rehearsal reservation and schedule staging ONLY: no cash/XP/fame or gig
-- settlement. All fixtures and reservations roll back in one transaction.
\set ON_ERROR_STOP on
BEGIN;

DO $test$
DECLARE
  v_actor uuid;
  v_other uuid;
  v_profile uuid;
  v_song uuid;
  v_club uuid;
  v_set uuid;
  v_booking uuid;
  v_again uuid;
  v_request uuid := gen_random_uuid();
  v_start timestamptz := now() + interval '8 days';
  v_cash numeric;
  v_fame numeric;
  v_cash_after numeric;
  v_fame_after numeric;
BEGIN
  SELECT p.user_id,p.id,s.id,c.id,p.cash,p.fame,
    ((date_trunc('day', now() AT TIME ZONE city.timezone) + interval '8 days 22 hours') AT TIME ZONE city.timezone)
    INTO v_actor,v_profile,v_song,v_club,v_cash,v_fame,v_start
  FROM public.profiles p
  JOIN public.songs s ON s.profile_id=p.id AND s.user_id=p.user_id
    AND s.status='recorded' AND s.audio_url IS NOT NULL AND COALESCE(s.archived,false)=false
  JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
  JOIN public.cities city ON city.id=c.city_id
  JOIN public.user_roles ur ON ur.user_id=p.user_id AND ur.role='user'::public.app_role
  WHERE c.dj_slot_config->>'schedule'='10pm-4am'
    AND COALESCE(p.fame,0)>=COALESCE((c.dj_slot_config->>'minimum_fame')::integer,0)
    AND COALESCE((c.dj_slot_config->>'set_length_minutes')::integer,45) BETWEEN 15 AND 180
    AND NOT EXISTS (
      SELECT 1 FROM public.player_scheduled_activities a
      WHERE a.profile_id=p.id AND a.status IN ('scheduled','in_progress')
        AND a.scheduled_start < v_start + interval '3 hours'
        AND a.scheduled_end > v_start
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id=g.band_id
      WHERE bm.profile_id=p.id AND bm.member_status='active'
        AND g.status IN ('scheduled','confirmed','in_progress')
        AND g.scheduled_date < v_start+interval '3 hours'
        AND COALESCE(g.scheduled_end,g.scheduled_date+interval '2 hours')>v_start
    )
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No eligible normal-player DJ reservation fixture';
  END IF;

  SELECT p.user_id INTO v_other FROM public.profiles p
    WHERE p.user_id<>v_actor LIMIT 1;
  IF v_other IS NULL THEN RAISE EXCEPTION 'Missing other-account fixture'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);

  INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
  VALUES(v_actor,v_profile,'Phase 4 rollback fixture',
    jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
  RETURNING id INTO v_set;

  -- An internal owner connection can invoke the withheld function
  -- on behalf of an authenticated actor; the normal client cannot.
  v_booking := public.reserve_dj_booking_internal(
    v_profile,v_club,v_set,v_start,v_request);
  IF v_booking IS NULL THEN RAISE EXCEPTION 'No reservation returned'; END IF;

  SELECT p.cash,p.fame INTO v_cash_after,v_fame_after FROM public.profiles p
   WHERE id=v_profile;
  IF v_cash_after IS DISTINCT FROM v_cash OR v_fame_after IS DISTINCT FROM v_fame
  THEN RAISE EXCEPTION 'SECURITY FAILURE: a reservation changed cash or fame'; END IF;

  SELECT public.reserve_dj_booking_internal(
    v_profile,v_club,v_set,v_start,v_request) INTO v_again;
  IF v_booking IS DISTINCT FROM v_again
  THEN RAISE EXCEPTION 'Idempotent retry created a second reservation'; END IF;

  IF (SELECT count(*) FROM public.dj_bookings WHERE id=v_booking)<>1
  THEN RAISE EXCEPTION 'Missing unique reservation row'; END IF;

  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '1 minute',gen_random_uuid());
    RAISE EXCEPTION 'SECURITY FAILURE: overlapping DJ reservation accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '1 minute',v_request);
    RAISE EXCEPTION 'SECURITY FAILURE: idempotency key accepted other booking';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  BEGIN
    PERFORM public.reserve_dj_booking_internal(
      v_profile,v_club,v_set,v_start+interval '2 days',gen_random_uuid());
    RAISE EXCEPTION 'SECURITY FAILURE: foreign account booked somebody else';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $test$;

SET LOCAL ROLE authenticated;
DO $non_admin$
BEGIN
  IF has_function_privilege(current_user,
       'public.reserve_dj_booking_internal(uuid,uuid,uuid,timestamptz,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'SECURITY FAILURE: public booking RPC activated early'; END IF;
  IF (SELECT count(*) FROM public.dj_bookings WHERE status='booked')<>0
  THEN RAISE EXCEPTION 'SECURITY FAILURE: other account saw private DJ booking'; END IF;
END $non_admin$;

ROLLBACK;
