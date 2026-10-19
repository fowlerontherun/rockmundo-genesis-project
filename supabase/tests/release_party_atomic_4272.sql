-- Run against a migrated DB. This is a rollback-only verification fixture.
BEGIN;
DO $test$
DECLARE
  v_release_id uuid;
  v_account uuid;
  v_other_account uuid;
  v_answers jsonb;
  v_hype_before integer;
  v_first jsonb;
  v_replay jsonb;
  v_count integer;
BEGIN
  SELECT r.id, bm.user_id, coalesce(r.hype_score,0)
  INTO v_release_id, v_account, v_hype_before
  FROM public.releases r
  JOIN public.band_members bm ON bm.band_id=r.band_id
  JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
  WHERE r.release_status IN ('manufacturing','released')
    AND bm.member_status='active'
    AND NOT coalesce(bm.is_touring_member,false)
    AND p.is_active=true AND p.died_at IS NULL
    AND p.id=(
      SELECT p2.id FROM public.profiles p2
      WHERE p2.user_id=bm.user_id AND p2.is_active=true AND p2.died_at IS NULL
      ORDER BY p2.updated_at DESC NULLS LAST,
               p2.created_at DESC NULLS LAST,p2.id LIMIT 1
    )
  ORDER BY r.id LIMIT 1;
  IF v_release_id IS NULL THEN RAISE EXCEPTION 'No eligible fixture release/profile'; END IF;
  SELECT user_id INTO v_other_account
  FROM public.profiles WHERE user_id<>v_account ORDER BY id LIMIT 1;
  IF v_other_account IS NULL THEN RAISE EXCEPTION 'No second test account'; END IF;
  SELECT jsonb_agg(
    jsonb_build_object('question_id', q.id, 'chosen_option','a','timed_out',false)
  ) INTO v_answers FROM (
    SELECT id FROM public.release_party_questions ORDER BY id LIMIT 5
  ) q;
  IF jsonb_array_length(v_answers) <> 5 THEN RAISE EXCEPTION 'Not enough questions'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_account::text,true);

  -- Legacy flag without a result must not be rewarded a second time.
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_answers);
    RAISE EXCEPTION 'Legacy completion unexpectedly settled';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'RELEASE_PARTY_LEGACY_COMPLETED_WITHOUT_RESULT%' THEN RAISE; END IF;
  END;

  -- Isolated fixture: temporarily unlock a pre-existing release; rollback will
  -- restore all hype, status and inserted rows.
  UPDATE public.releases SET release_party_done=false WHERE id=v_release_id;
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,'[]'::jsonb);
    RAISE EXCEPTION 'Empty question list accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'RELEASE_PARTY_FIVE_ANSWERS_REQUIRED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.settle_release_party_atomic(
      v_release_id,
      jsonb_build_array(v_answers->0,v_answers->0,v_answers->1,v_answers->2,v_answers->3)
    );
    RAISE EXCEPTION 'Duplicate question accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'RELEASE_PARTY_DUPLICATE_QUESTION%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_other_account::text,true);
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_answers);
    RAISE EXCEPTION 'Unauthorized user accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'RELEASE_PARTY_NOT_AUTHORIZED%'
       AND SQLERRM NOT LIKE 'RELEASE_PARTY_ACTIVE_CHARACTER_REQUIRED%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_account::text,true);
  v_first := public.settle_release_party_atomic(v_release_id,v_answers);
  IF v_first->>'success' <> 'true' OR v_first->>'already_completed' <> 'false' THEN
    RAISE EXCEPTION 'Initial settlement failed: %',v_first;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.releases
    WHERE id=v_release_id AND release_party_done=true
      AND hype_score=least(1000,v_hype_before+(v_first->>'hype_awarded')::integer)
  ) THEN RAISE EXCEPTION 'Hype/status not committed together'; END IF;

  v_replay := public.settle_release_party_atomic(
    v_release_id,
    jsonb_build_array(
      jsonb_build_object('question_id','ffffffff-ffff-ffff-ffff-ffffffffffff','chosen_option','x')
    )
  );
  IF v_replay->>'already_completed' <> 'true'
  OR v_replay->>'result_id' <> v_first->>'result_id'
  OR v_replay->>'hype_awarded' <> v_first->>'hype_awarded' THEN
    RAISE EXCEPTION 'Replay is not idempotent: %',v_replay;
  END IF;
  SELECT count(*) INTO v_count FROM public.release_party_results WHERE release_id=v_release_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Multiple results on replay'; END IF;
  IF has_function_privilege('anon','public.settle_release_party_atomic(uuid,jsonb)','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.settle_release_party_atomic(uuid,jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','public.release_party_results','INSERT') THEN
    RAISE EXCEPTION 'Role grants invalid';
  END IF;
  RAISE NOTICE 'release_party_atomic_4272: PASS; fixtures rollback';
END $test$;
SELECT 'release_party_atomic_4272: PASS (changes rolled back)' AS result;
ROLLBACK;
