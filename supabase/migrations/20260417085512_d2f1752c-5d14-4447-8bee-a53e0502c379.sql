CREATE OR REPLACE FUNCTION public.spend_campaign_funds(
  p_candidate_id uuid,
  p_category text,
  p_amount integer,
  p_funded_from text,
  p_party_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_candidate_profile uuid;
  v_dollars numeric;
  v_cash numeric;
  v_treasury bigint;
  v_role text;
  v_effect integer;
  v_expenditure_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_funded_from NOT IN ('personal','party') THEN
    RAISE EXCEPTION 'Invalid funding source';
  END IF;

  -- Resolve candidate's profile and ensure caller owns that profile
  SELECT cc.profile_id INTO v_candidate_profile
  FROM public.city_candidates cc
  WHERE cc.id = p_candidate_id;
  IF v_candidate_profile IS NULL THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.id = v_candidate_profile AND p.user_id = v_user_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Only the candidate can log spend for this campaign';
  END IF;

  v_dollars := p_amount::numeric / 100.0;
  v_effect := floor(p_amount / 1000);

  IF p_funded_from = 'personal' THEN
    SELECT cash INTO v_cash FROM public.profiles WHERE id = v_profile_id FOR UPDATE;
    IF v_cash IS NULL OR v_cash < v_dollars THEN
      RAISE EXCEPTION 'Insufficient personal funds';
    END IF;
    UPDATE public.profiles SET cash = cash - v_dollars WHERE id = v_profile_id;
  ELSE
    IF p_party_id IS NULL THEN
      RAISE EXCEPTION 'Party id required for party funding';
    END IF;
    SELECT role INTO v_role FROM public.party_memberships
      WHERE party_id = p_party_id AND profile_id = v_profile_id;
    IF v_role IS NULL OR v_role NOT IN ('founder','officer') THEN
      RAISE EXCEPTION 'Only founders or officers can spend from party treasury';
    END IF;
    SELECT treasury_balance INTO v_treasury FROM public.political_parties
      WHERE id = p_party_id FOR UPDATE;
    IF v_treasury IS NULL OR v_treasury < p_amount THEN
      RAISE EXCEPTION 'Insufficient party treasury funds';
    END IF;
    UPDATE public.political_parties
      SET treasury_balance = treasury_balance - p_amount
      WHERE id = p_party_id;
  END IF;

  INSERT INTO public.campaign_expenditures (
    candidate_id, spender_profile_id, category, amount, effect_value, funded_from, party_id
  ) VALUES (
    p_candidate_id, v_profile_id, p_category, p_amount, v_effect, p_funded_from,
    CASE WHEN p_funded_from = 'party' THEN p_party_id ELSE NULL END
  )
  RETURNING id INTO v_expenditure_id;

  UPDATE public.city_candidates
    SET campaign_spend_total = COALESCE(campaign_spend_total, 0) + p_amount
    WHERE id = p_candidate_id;

  RETURN v_expenditure_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_campaign_funds(uuid, text, integer, text, uuid) TO authenticated;