-- Execute in a fresh transaction ONLY. Fixture updates are rolled back.
-- Verifies release of ONE of two characters, idempotent replay, active
-- second sentence, unrelated profile safety, and fail-closed legacy rows.
BEGIN;

DO $test$
DECLARE
  v_user_id uuid;
  v_profile_one uuid;
  v_profile_two uuid;
  v_prison_id uuid;
  v_first uuid;
  v_second uuid;
  v_overlap uuid;
  v_orphan uuid;
  v_result jsonb;
  v_count integer;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles
  GROUP BY user_id HAVING count(*) >= 2 ORDER BY user_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Requires a test account with two characters';
  END IF;
  SELECT id INTO v_profile_one FROM public.profiles
    WHERE user_id = v_user_id ORDER BY id LIMIT 1;
  SELECT id INTO v_profile_two FROM public.profiles
    WHERE user_id = v_user_id AND id <> v_profile_one ORDER BY id LIMIT 1;
  SELECT id INTO v_prison_id FROM public.prisons ORDER BY id LIMIT 1;
  IF v_prison_id IS NULL THEN RAISE EXCEPTION 'No prisons in fixture environment'; END IF;

  -- Within this ROLLBACK transaction, mark two characters imprisoned.
  UPDATE public.profiles SET is_imprisoned = true
    WHERE id IN (v_profile_one, v_profile_two);
  INSERT INTO public.player_imprisonments(
    user_id, profile_id, prison_id, original_sentence_days,
    remaining_sentence_days, release_date, reason, behavior_score,
    good_behavior_days_earned, status
  ) VALUES (
    v_user_id,v_profile_one,v_prison_id,8,0,now()-interval '1 hour',
    'test_prison_release',90,2,'imprisoned'
  ) RETURNING id INTO v_first;
  INSERT INTO public.player_imprisonments(
    user_id, profile_id, prison_id, original_sentence_days,
    remaining_sentence_days, release_date, reason, behavior_score,status
  ) VALUES (
    v_user_id,v_profile_two,v_prison_id,9,9,now()+interval '2 days',
    'test_prison_release',60,'imprisoned'
  ) RETURNING id INTO v_second;

  v_result := public.release_due_prisoner_atomic(v_second);
  IF v_result->>'reason' <> 'not_due' THEN
    RAISE EXCEPTION 'Not-due sentence was eligible: %',v_result;
  END IF;

  v_result := public.release_due_prisoner_atomic(v_first);
  IF coalesce((v_result->>'released')::boolean,false) <> true
     OR v_result->>'profile_id' <> v_profile_one::text THEN
    RAISE EXCEPTION 'First release incorrect: %',v_result;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_profile_one AND NOT is_imprisoned)
  OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_profile_two AND is_imprisoned)
  OR NOT EXISTS (SELECT 1 FROM public.player_imprisonments WHERE id=v_second AND status='imprisoned') THEN
    RAISE EXCEPTION 'Cross-character imprisonment state corruption';
  END IF;

  SELECT count(*) INTO v_count FROM public.player_criminal_record
  WHERE imprisonment_id=v_first AND profile_id=v_profile_one;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one scoped criminal record'; END IF;
  SELECT count(*) INTO v_count FROM public.activity_feed
  WHERE activity_type='released' AND profile_id=v_profile_one
    AND metadata->>'imprisonment_id'=v_first::text;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one scoped notification'; END IF;
  v_result := public.release_due_prisoner_atomic(v_first);
  IF v_result->>'reason' <> 'already_finalized' THEN
    RAISE EXCEPTION 'Replay must not settle: %',v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.player_criminal_record
  WHERE imprisonment_id=v_first;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Duplicate criminal record on replay'; END IF;

  -- Two concurrent sentences belonging to the same character: releasing
  -- one must not unblock the character while the other is still active.
  INSERT INTO public.player_imprisonments(
    user_id, profile_id, prison_id, original_sentence_days,
    remaining_sentence_days, release_date, reason, status
  ) VALUES (
    v_user_id,v_profile_two,v_prison_id,2,0,now()-interval '1 hour',
    'test_prison_release','imprisoned'
  ) RETURNING id INTO v_overlap;
  v_result := public.release_due_prisoner_atomic(v_overlap);
  IF coalesce((v_result->>'still_imprisoned')::boolean,false) <> true
  OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_profile_two AND is_imprisoned) THEN
    RAISE EXCEPTION 'Overlapping sentence unblocked early: %',v_result;
  END IF;

  -- Account-only historical rows must fail closed; never guess a profile.
  INSERT INTO public.player_imprisonments(
    user_id, profile_id, prison_id, original_sentence_days,
    remaining_sentence_days, release_date, reason, status
  ) VALUES (
    v_user_id,NULL,v_prison_id,2,0,now()-interval '1 hour',
    'test_prison_release','imprisoned'
  ) RETURNING id INTO v_orphan;
  BEGIN
    PERFORM public.release_due_prisoner_atomic(v_orphan);
    RAISE EXCEPTION 'Unattributed sentence unexpectedly settled';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'PRISON_RELEASE_UNATTRIBUTED_CHARACTER:%' THEN
      RAISE;
    END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.player_imprisonments
    WHERE id=v_orphan AND status='imprisoned') THEN
    RAISE EXCEPTION 'Legacy account-only sentence was modified';
  END IF;

  IF has_function_privilege('authenticated',
       'public.release_due_prisoner_atomic(uuid,timestamptz)','EXECUTE')
    OR has_function_privilege('anon',
       'public.release_due_prisoner_atomic(uuid,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'Browser role can execute privileged release';
  END IF;

  RAISE NOTICE 'prison_release_character_harness: PASSED; rollback to follow';
END
$test$;

SELECT 'prison_release_character_harness: PASSED (fixtures rolled back)' AS result;
ROLLBACK;
