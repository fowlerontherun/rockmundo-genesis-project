-- #4272 negative authorization / malformed outcome checks, transactionally rolled back.
BEGIN;

CREATE TEMP TABLE rp_negative_fixture ON COMMIT DROP AS
SELECT r.id AS release_id, bm.user_id AS owner_id
FROM public.releases r
JOIN public.band_members bm ON bm.band_id=r.band_id
JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
WHERE r.release_status IN ('manufacturing','released')
  AND bm.member_status='active'
  AND NOT coalesce(bm.is_touring_member,false)
  AND p.is_active IS TRUE AND p.died_at IS NULL
  AND p.id = (
    SELECT id FROM public.profiles px
    WHERE px.user_id=bm.user_id AND px.is_active=true AND px.died_at IS NULL
    ORDER BY px.updated_at DESC NULLS LAST,px.created_at DESC NULLS LAST,px.id
    LIMIT 1
  )
ORDER BY r.id LIMIT 1;

SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM rp_negative_fixture),true);

DO $negative$
DECLARE
  v_release_id uuid;
  v_owner uuid;
  v_other uuid;
  v_answers jsonb;
  v_invalid jsonb;
BEGIN
  SELECT release_id,owner_id INTO v_release_id,v_owner FROM rp_negative_fixture;
  SELECT user_id INTO v_other FROM public.profiles
  WHERE user_id <> v_owner ORDER BY id LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object('question_id',id,'chosen_option','a'))
  INTO v_answers FROM (SELECT id FROM public.release_party_questions ORDER BY id LIMIT 5) q;

  IF v_release_id IS NULL OR v_other IS NULL OR jsonb_array_length(v_answers) <> 5 THEN
    RAISE EXCEPTION 'Missing fixture data';
  END IF;

  -- Historical completed releases without a result are never re-awarded.
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_answers);
    RAISE EXCEPTION 'EXPECTED_LEGACY_FAILURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RELEASE_PARTY_LEGACY_COMPLETED_WITHOUT_RESULT' THEN RAISE; END IF;
  END;

  UPDATE public.releases SET release_party_done=false WHERE id=v_release_id;

  -- A different auth account must not settle another band's release.
  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_answers);
    RAISE EXCEPTION 'EXPECTED_UNAUTHORIZED_FAILURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RELEASE_PARTY_NOT_AUTHORIZED'
       AND SQLERRM <> 'RELEASE_PARTY_ACTIVE_CHARACTER_REQUIRED' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);

  -- Rejected submissions must not write a result or a hype increment.
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,'[]'::jsonb);
    RAISE EXCEPTION 'EXPECTED_COUNT_FAILURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RELEASE_PARTY_FIVE_ANSWERS_REQUIRED' THEN RAISE; END IF;
  END;

  v_invalid := jsonb_build_array(v_answers->0,v_answers->0,
                                   v_answers->2,v_answers->3,v_answers->4);
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_invalid);
    RAISE EXCEPTION 'EXPECTED_DUPLICATE_FAILURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RELEASE_PARTY_DUPLICATE_QUESTION' THEN RAISE; END IF;
  END;

  v_invalid := jsonb_set(v_answers,'{0,chosen_option}','"x"'::jsonb);
  BEGIN
    PERFORM public.settle_release_party_atomic(v_release_id,v_invalid);
    RAISE EXCEPTION 'EXPECTED_OPTION_FAILURE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RELEASE_PARTY_INVALID_OPTION' THEN RAISE; END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.release_party_results WHERE release_id=v_release_id) THEN
    RAISE EXCEPTION 'Negative test unexpectedly created result';
  END IF;
  RAISE NOTICE 'release_party_negative_4272: PASS';
END;
$negative$;

SELECT 'release_party_negative_4272: PASS; fixtures rolled back' AS result;
ROLLBACK;
