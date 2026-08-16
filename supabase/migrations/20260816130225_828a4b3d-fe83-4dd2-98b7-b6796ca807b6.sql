
CREATE OR REPLACE FUNCTION public.play_casino_round(
  p_game_type text,
  p_bet_amount numeric,
  p_payout numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id uuid;
  v_cash numeric;
  v_bet numeric := ROUND(COALESCE(p_bet_amount, 0));
  v_payout numeric := ROUND(GREATEST(0, COALESCE(p_payout, 0)));
  v_max_payout numeric;
  v_net numeric;
  v_new_cash numeric;
  v_addiction record;
  v_developed boolean := false;
BEGIN
  SELECT p.id, COALESCE(p.cash, 0) INTO v_profile_id, v_cash
    FROM public.profiles p
   WHERE p.user_id = auth.uid()
   ORDER BY COALESCE(p.is_active, true) DESC, p.created_at
   LIMIT 1
   FOR UPDATE;

  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'no_active_profile'; END IF;
  IF v_bet <= 0 THEN RAISE EXCEPTION 'invalid_bet'; END IF;
  IF v_bet > 1000000 THEN RAISE EXCEPTION 'bet_too_large'; END IF;
  IF v_cash < v_bet THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  -- Payout ceilings per game keep a tampered client from claiming impossible wins.
  v_max_payout := v_bet * CASE lower(COALESCE(p_game_type, ''))
    WHEN 'slots' THEN 100
    WHEN 'roulette' THEN 36
    WHEN 'blackjack' THEN 3
    WHEN 'poker' THEN 50
    WHEN 'dice' THEN 30
    WHEN 'coinflip' THEN 2
    WHEN 'scratchcard' THEN 60
    ELSE 100 END;
  IF v_payout > v_max_payout THEN v_payout := v_max_payout; END IF;

  v_net := v_payout - v_bet;
  v_new_cash := GREATEST(0, v_cash + v_net);

  UPDATE public.profiles SET cash = v_new_cash WHERE id = v_profile_id;

  INSERT INTO public.casino_transactions (profile_id, game_type, bet_amount, payout, net_result, metadata)
  VALUES (v_profile_id, p_game_type, v_bet, v_payout, v_net, COALESCE(p_metadata, '{}'::jsonb));

  -- Gambling addiction risk (5% per resolved bet), evaluated server-side.
  IF random() < 0.05 THEN
    SELECT id, severity INTO v_addiction
      FROM public.player_addictions
     WHERE profile_id = v_profile_id
       AND addiction_type = 'gambling'
       AND status IN ('active','recovering')
     LIMIT 1;

    IF v_addiction.id IS NOT NULL THEN
      UPDATE public.player_addictions
         SET severity = LEAST(100, COALESCE(severity, 0) + 3), updated_at = now()
       WHERE id = v_addiction.id;
    ELSE
      INSERT INTO public.player_addictions (user_id, profile_id, addiction_type, severity, status, triggered_at, days_clean, relapse_count)
      VALUES (auth.uid(), v_profile_id, 'gambling', 10, 'active', now(), 0, 0);
      v_developed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'netResult', v_net,
    'newCash', v_new_cash,
    'payout', v_payout,
    'developedAddiction', v_developed
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.play_casino_round(text, numeric, numeric, jsonb) TO authenticated, service_role;
