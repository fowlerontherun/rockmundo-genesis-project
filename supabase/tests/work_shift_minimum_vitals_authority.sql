-- Regression run against production 2026-10-18; transaction rolls back all
-- temporary health/energy values, JWT claims and attempted work starts.
BEGIN;
DO $test$
DECLARE v_uid uuid; v_profile uuid; v_cash numeric; v_shifts bigint; v_activities bigint;
BEGIN
 SELECT user_id,id,cash INTO v_uid,v_profile,v_cash
 FROM public.profiles WHERE user_id IS NOT NULL AND is_active IS TRUE
 ORDER BY id LIMIT 1;
 IF v_uid IS NULL THEN RAISE EXCEPTION 'No character fixture'; END IF;
 SELECT count(*) INTO v_shifts FROM public.shift_history WHERE profile_id=v_profile;
 SELECT count(*) INTO v_activities FROM public.profile_activity_statuses WHERE profile_id=v_profile;
 PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF has_function_privilege('anon','public.clock_in_work_shift_atomic(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.clock_in_work_shift_atomic(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Clock-in RPC grant drift'; END IF;

 UPDATE public.profiles SET health=0,energy=100 WHERE id=v_profile;
 BEGIN
  PERFORM public.clock_in_work_shift_atomic(v_profile,gen_random_uuid());
  RAISE EXCEPTION 'Server accepted zero health';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'work_character_not_fit' THEN RAISE; END IF;
 END;
 UPDATE public.profiles SET health=19,energy=100 WHERE id=v_profile;
 BEGIN
  PERFORM public.clock_in_work_shift_atomic(v_profile,gen_random_uuid());
  RAISE EXCEPTION 'Server accepted 19 health';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'work_character_not_fit' THEN RAISE; END IF;
 END;
 UPDATE public.profiles SET health=20,energy=9 WHERE id=v_profile;
 BEGIN
  PERFORM public.clock_in_work_shift_atomic(v_profile,gen_random_uuid());
  RAISE EXCEPTION 'Server accepted 9 energy';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'work_character_not_fit' THEN RAISE; END IF;
 END;
 UPDATE public.profiles SET health=20,energy=10 WHERE id=v_profile;
 BEGIN
  PERFORM public.clock_in_work_shift_atomic(v_profile,gen_random_uuid());
  RAISE EXCEPTION 'Unexpected success with nonexistent employment';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'employment_not_active' THEN RAISE; END IF;
 END;

 IF (SELECT count(*) FROM public.shift_history WHERE profile_id=v_profile)<>v_shifts
 OR (SELECT count(*) FROM public.profile_activity_statuses WHERE profile_id=v_profile)<>v_activities
 OR (SELECT cash FROM public.profiles WHERE id=v_profile) IS DISTINCT FROM v_cash
 THEN RAISE EXCEPTION 'Denied shift mutated payout or activities'; END IF;
END;
$test$;
ROLLBACK;
