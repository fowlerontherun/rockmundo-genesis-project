-- #4272: server-authoritative, single-transaction release party settlement.
-- Never trust client-supplied hype, effect multipliers, user_id, band_id or cash.
CREATE OR REPLACE FUNCTION public.settle_release_party_atomic(
  p_release_id uuid,
  p_answers jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_active_profile uuid;
  v_release public.releases%ROWTYPE;
  v_existing public.release_party_results%ROWTYPE;
  v_answer jsonb;
  v_question_id uuid;
  v_option text;
  v_question public.release_party_questions%ROWTYPE;
  v_effect jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_validated jsonb := '[]'::jsonb;
  v_rep jsonb := '{}'::jsonb;
  v_rep_entry record;
  v_total_hype numeric := 0;
  v_total_fans numeric := 0;
  v_total_cash numeric := 0;
  v_hype integer;
  v_new_hype integer;
  v_total_effects jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'RELEASE_PARTY_UNAUTHENTICATED';
  END IF;
  v_active_profile := public.current_active_player_profile_id();
  IF v_active_profile IS NULL THEN
    RAISE EXCEPTION 'RELEASE_PARTY_ACTIVE_CHARACTER_REQUIRED';
  END IF;
  IF p_release_id IS NULL THEN
    RAISE EXCEPTION 'RELEASE_PARTY_RELEASE_REQUIRED';
  END IF;

  -- Lock serializes two tabs / overlapping requests and prevents lost updates
  -- to hype_score. Every subsequent write is in this same transaction.
  SELECT * INTO v_release FROM public.releases
  WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RELEASE_PARTY_NOT_FOUND';
  END IF;

  -- Band work requires active non-touring membership for THIS character.
  -- Solo releases only store account user_id in the existing schema.
  IF v_release.band_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = v_release.band_id
        AND bm.profile_id = v_active_profile
        AND bm.user_id = v_caller
        AND coalesce(bm.member_status, 'active') = 'active'
        AND NOT coalesce(bm.is_touring_member, false)
    ) THEN
      RAISE EXCEPTION 'RELEASE_PARTY_NOT_AUTHORIZED';
    END IF;
  ELSIF v_release.user_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'RELEASE_PARTY_NOT_AUTHORIZED';
  END IF;

  SELECT * INTO v_existing FROM public.release_party_results
  WHERE release_id = p_release_id;
  IF FOUND THEN
    IF NOT v_release.release_party_done THEN
      RAISE EXCEPTION 'RELEASE_PARTY_INCONSISTENT_EXISTING_RESULT';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'already_completed', true,
      'hype_awarded', v_existing.hype_awarded,
      'hype_score', v_release.hype_score,
      'result_id', v_existing.id
    );
  END IF;
  IF v_release.release_party_done THEN
    -- Older rows can have the flag set without a result. Fail closed, do not
    -- fabricate history or re-award hype on a retry.
    RAISE EXCEPTION 'RELEASE_PARTY_LEGACY_COMPLETED_WITHOUT_RESULT';
  END IF;

  IF v_release.release_status NOT IN ('manufacturing', 'released') THEN
    RAISE EXCEPTION 'RELEASE_PARTY_RELEASE_NOT_ELIGIBLE';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array'
    OR jsonb_array_length(p_answers) <> 5 THEN
    RAISE EXCEPTION 'RELEASE_PARTY_FIVE_ANSWERS_REQUIRED';
  END IF;

  FOR v_answer IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
    IF jsonb_typeof(v_answer) <> 'object'
      OR coalesce(v_answer->>'question_id', '') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'RELEASE_PARTY_INVALID_QUESTION';
    END IF;
    v_question_id := (v_answer->>'question_id')::uuid;
    v_option := v_answer->>'chosen_option';
    IF v_option IS NULL OR v_option NOT IN ('a', 'b', 'c', 'd') THEN
      RAISE EXCEPTION 'RELEASE_PARTY_INVALID_OPTION';
    END IF;
    IF v_question_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'RELEASE_PARTY_DUPLICATE_QUESTION';
    END IF;
    v_seen := array_append(v_seen, v_question_id);

    SELECT * INTO v_question FROM public.release_party_questions
    WHERE id = v_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RELEASE_PARTY_UNKNOWN_QUESTION';
    END IF;

    v_effect := CASE v_option
      WHEN 'a' THEN v_question.option_a_effects
      WHEN 'b' THEN v_question.option_b_effects
      WHEN 'c' THEN v_question.option_c_effects
      ELSE v_question.option_d_effects
    END;
    -- Effects come from the server's trusted question catalogue, not the
    -- caller. Bound multipliers to keep catalogue mistakes from minting hype.
    v_total_hype := v_total_hype +
      least(2.0, greatest(0.0, coalesce((v_effect->>'hype_mult')::numeric, 1)));
    v_total_fans := v_total_fans +
      least(2.0, greatest(0.0, coalesce((v_effect->>'fan_mult')::numeric, 1)));
    v_total_cash := v_total_cash +
      least(2.0, greatest(0.0, coalesce((v_effect->>'cash_mult')::numeric, 1)));
    FOR v_rep_entry IN SELECT key, value FROM jsonb_each_text(
      CASE WHEN jsonb_typeof(v_effect->'reputation') = 'object'
        THEN v_effect->'reputation' ELSE '{}'::jsonb END
    ) LOOP
      v_rep := jsonb_set(v_rep, ARRAY[v_rep_entry.key],
        to_jsonb(greatest(-50, least(50,
          coalesce((v_rep->>v_rep_entry.key)::integer, 0) +
          greatest(-10, least(10, v_rep_entry.value::integer))
        ))), true);
    END LOOP;
    v_validated := v_validated || jsonb_build_array(jsonb_build_object(
      'question_id', v_question_id,
      'chosen_option', v_option,
      'timed_out', coalesce((v_answer->>'timed_out')::boolean, false)
    ));
  END LOOP;

  v_hype := least(200, greatest(0, round(100 * v_total_hype / 5)::integer));
  v_new_hype := least(1000, greatest(0, coalesce(v_release.hype_score, 0)) + v_hype);
  v_total_effects := jsonb_build_object(
    'hype_mult', v_total_hype / 5,
    'fan_mult', v_total_fans / 5,
    'cash_mult', v_total_cash / 5,
    'reputation', v_rep
  );

  INSERT INTO public.release_party_results(
    release_id, user_id, band_id, questions, total_effects, hype_awarded
  ) VALUES (
    p_release_id, v_caller, v_release.band_id,
    v_validated, v_total_effects, v_hype
  ) RETURNING * INTO v_existing;

  UPDATE public.releases
  SET hype_score = v_new_hype, release_party_done = true
  WHERE id = p_release_id;

  RETURN jsonb_build_object(
    'success', true, 'already_completed', false,
    'result_id', v_existing.id, 'hype_awarded', v_hype,
    'hype_score', v_new_hype, 'total_effects', v_total_effects
  );
END;
$function$;

-- No browser writes to results outside the atomic RPC; reads retain existing RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.release_party_results
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_release_party_atomic(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_release_party_atomic(uuid,jsonb)
  TO authenticated, service_role;
