-- Transactional live-schema fixture; never run without BEGIN/ROLLBACK.
-- All provisional rows and the simulated cash/fame update are rolled back.
BEGIN;
DO $setup$
DECLARE
  v_profile public.profiles%rowtype;
  v_gig public.modeling_gigs%rowtype;
  v_offer uuid;
  v_second_offer uuid;
  v_start timestamptz := now()+interval '30 days';
BEGIN
  SELECT * INTO v_gig FROM public.modeling_gigs
  WHERE is_available AND COALESCE(duration_hours,2) BETWEEN 1 AND 12
  ORDER BY id LIMIT 1;
  SELECT * INTO v_profile FROM public.profiles p
  WHERE p.is_active=true AND p.deleted_at IS NULL AND p.died_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.player_scheduled_activities a
      WHERE a.user_id=p.user_id AND a.status IN ('scheduled','in_progress')
        AND a.scheduled_start<v_start+make_interval(hours=>COALESCE(v_gig.duration_hours,2))
        AND a.scheduled_end>v_start)
  ORDER BY p.id LIMIT 1;
  IF v_profile.id IS NULL OR v_gig.id IS NULL THEN
    RAISE EXCEPTION 'modeling_atomic_fixture_unavailable'; END IF;
  INSERT INTO public.player_modeling_contracts
    (user_id,profile_id,gig_id,status,compensation,fame_boost,expires_at)
  VALUES(v_profile.user_id,v_profile.id,v_gig.id,'pending',100,10,
    now()+interval '1 day') RETURNING id INTO v_offer;
  INSERT INTO public.modeling_offer_terms
    (contract_id,profile_id,compensation_amount,fame_amount)
  VALUES(v_offer,v_profile.id,100,10);
  INSERT INTO public.player_modeling_contracts
    (user_id,profile_id,gig_id,status,compensation,fame_boost,expires_at)
  VALUES(v_profile.user_id,v_profile.id,v_gig.id,'pending',100,10,
    now()+interval '1 day') RETURNING id INTO v_second_offer;
  INSERT INTO public.modeling_offer_terms
    (contract_id,profile_id,compensation_amount,fame_amount)
  VALUES(v_second_offer,v_profile.id,100,10);
  PERFORM set_config('test.modeling_user',v_profile.user_id::text,true);
  PERFORM set_config('test.modeling_profile',v_profile.id::text,true);
  PERFORM set_config('test.modeling_offer',v_offer::text,true);
  PERFORM set_config('test.modeling_second_offer',v_second_offer::text,true);
  PERFORM set_config('test.modeling_start',v_start::text,true);
  PERFORM set_config('test.modeling_end',
    (v_start+make_interval(hours=>COALESCE(v_gig.duration_hours,2)))::text,true);
  PERFORM set_config('test.modeling_cash',v_profile.cash::text,true);
  PERFORM set_config('test.modeling_fame',v_profile.fame::text,true);
END $setup$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.modeling_user'),true);
DO $book$
DECLARE v_booking jsonb;
BEGIN
  v_booking:=public.book_modeling_offer_atomic(
    current_setting('test.modeling_offer')::uuid,
    current_setting('test.modeling_profile')::uuid,
    current_setting('test.modeling_start')::timestamptz,
    current_setting('test.modeling_end')::timestamptz,
    (current_setting('test.modeling_start')::timestamptz AT TIME ZONE 'UTC')::date);
  IF v_booking->>'booked'<>'true' OR v_booking->>'activity_id' IS NULL
  THEN RAISE EXCEPTION 'modeling_atomic_booking_unconfirmed'; END IF;
  -- A second request cannot create another activity or accept twice.
  BEGIN
    PERFORM public.book_modeling_offer_atomic(
      current_setting('test.modeling_offer')::uuid,
      current_setting('test.modeling_profile')::uuid,
      current_setting('test.modeling_start')::timestamptz,
      current_setting('test.modeling_end')::timestamptz,
      (current_setting('test.modeling_start')::timestamptz AT TIME ZONE 'UTC')::date);
    RAISE EXCEPTION 'modeling_atomic_duplicate_booking_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'modeling_offer_unavailable' THEN RAISE; END IF;
  END;
  -- A conflicting second offer stays pending without a stranded accepted
  -- contract or a second calendar entry.
  BEGIN
    PERFORM public.book_modeling_offer_atomic(
      current_setting('test.modeling_second_offer')::uuid,
      current_setting('test.modeling_profile')::uuid,
      current_setting('test.modeling_start')::timestamptz,
      current_setting('test.modeling_end')::timestamptz,
      (current_setting('test.modeling_start')::timestamptz AT TIME ZONE 'UTC')::date);
    RAISE EXCEPTION 'modeling_atomic_overlap_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'modeling_schedule_conflict' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.player_modeling_contracts
    WHERE id=current_setting('test.modeling_second_offer')::uuid
      AND status='pending' AND booking_activity_id IS NULL)
  THEN RAISE EXCEPTION 'modeling_atomic_partial_booking_created'; END IF;
END $book$;

-- Simulate the trusted scheduler advancing the test booking to completion;
-- do not run this workflow on any real player booking.
SET LOCAL ROLE service_role;
DO $settle$
DECLARE
  v_activity uuid;
  v_result jsonb;
  v_cash bigint;
  v_fame integer;
BEGIN
  SELECT booking_activity_id INTO v_activity
  FROM public.player_modeling_contracts
  WHERE id=current_setting('test.modeling_offer')::uuid;
  IF v_activity IS NULL THEN RAISE EXCEPTION 'modeling_atomic_diary_missing'; END IF;
  UPDATE public.player_scheduled_activities
  SET status='in_progress',scheduled_start=now()-interval '3 hours',
    scheduled_end=now()-interval '1 hour'
  WHERE id=v_activity;
  UPDATE public.player_modeling_contracts
  SET scheduled_start=now()-interval '3 hours',
    scheduled_end=now()-interval '1 hour'
  WHERE id=current_setting('test.modeling_offer')::uuid;
  v_result:=public.settle_modeling_contract_atomic(
    v_activity,current_setting('test.modeling_offer')::uuid);
  IF v_result->>'settled'<>'true' THEN
    RAISE EXCEPTION 'modeling_atomic_first_settlement_failed'; END IF;
  v_result:=public.settle_modeling_contract_atomic(
    v_activity,current_setting('test.modeling_offer')::uuid);
  IF v_result->>'reason'<>'already_settled' THEN
    RAISE EXCEPTION 'modeling_atomic_duplicate_settlement_allowed'; END IF;
  SELECT cash,fame INTO v_cash,v_fame FROM public.profiles
    WHERE id=current_setting('test.modeling_profile')::uuid;
  IF v_cash<>current_setting('test.modeling_cash')::bigint+100
    OR v_fame<>current_setting('test.modeling_fame')::integer+10
  THEN RAISE EXCEPTION 'modeling_atomic_reward_mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_scheduled_activities
    WHERE id=v_activity AND status='completed')
    OR NOT EXISTS (SELECT 1 FROM public.player_modeling_contracts
    WHERE id=current_setting('test.modeling_offer')::uuid AND status='completed')
  THEN RAISE EXCEPTION 'modeling_atomic_completion_missing'; END IF;
END $settle$;
ROLLBACK;
SELECT 'modeling_atomic_booking_settlement_passed' result;
