-- Secure annual profit distribution with server-side game year computation and atomic reservation

CREATE OR REPLACE FUNCTION public.distribute_company_annual_profit(p_company_id uuid)
RETURNS TABLE(distributed_profit numeric, game_year integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_distribution_id uuid;
  v_game_year integer;
  v_latest_distributed_at timestamptz;
  v_profit numeric := 0;
  v_distributable_profit numeric := 0;
  v_total_shares integer := 0;
  v_company_balance numeric := 0;
  sh RECORD;
  payout integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.balance
  INTO v_company_balance
  FROM public.companies c
  WHERE c.id = p_company_id
    AND c.owner_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the company owner can distribute profits';
  END IF;

  -- Mirrors src/utils/gameCalendar.ts defaults:
  -- game_days_elapsed = floor((real_world_days / 10) * 30) = floor(real_world_days * 3)
  -- game_year = floor(game_days_elapsed / 360) + 1
  v_game_year := floor(
    floor(greatest(0, extract(epoch from (now() - timestamptz '2026-01-01T00:00:00Z')) / 86400) * 3)
    / 360
  ) + 1;

  INSERT INTO public.company_profit_distributions (
    company_id,
    game_year,
    distributed_profit,
    distributed_by
  )
  VALUES (p_company_id, v_game_year, 0, v_user_id)
  ON CONFLICT (company_id, game_year) DO NOTHING
  RETURNING id INTO v_distribution_id;

  IF v_distribution_id IS NULL THEN
    RAISE EXCEPTION 'Profit already distributed for this game year';
  END IF;

  SELECT d.distributed_at
  INTO v_latest_distributed_at
  FROM public.company_profit_distributions d
  WHERE d.company_id = p_company_id
    AND d.id <> v_distribution_id
  ORDER BY d.distributed_at DESC
  LIMIT 1;

  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_profit
  FROM public.company_transactions t
  WHERE t.company_id = p_company_id
    AND (
      v_latest_distributed_at IS NULL
      OR t.created_at > v_latest_distributed_at
    );

  v_distributable_profit := greatest(0, floor(v_profit));

  IF v_distributable_profit <= 0 THEN
    RAISE EXCEPTION 'No profit available to distribute';
  END IF;

  IF v_company_balance < v_distributable_profit THEN
    RAISE EXCEPTION 'Insufficient company balance';
  END IF;

  SELECT COALESCE(SUM(cs.shares), 0)
  INTO v_total_shares
  FROM public.company_shareholders cs
  WHERE cs.company_id = p_company_id;

  IF v_total_shares <= 0 THEN
    RAISE EXCEPTION 'Invalid total shares';
  END IF;

  FOR sh IN
    SELECT cs.user_id, cs.shares
    FROM public.company_shareholders cs
    WHERE cs.company_id = p_company_id
  LOOP
    payout := floor((v_distributable_profit * sh.shares) / v_total_shares);

    IF payout > 0 THEN
      UPDATE public.profiles
      SET cash = COALESCE(cash, 0) + payout
      WHERE user_id = sh.user_id;
    END IF;
  END LOOP;

  UPDATE public.companies
  SET balance = balance - v_distributable_profit
  WHERE id = p_company_id;

  INSERT INTO public.company_transactions (
    company_id,
    transaction_type,
    amount,
    description,
    category
  )
  VALUES (
    p_company_id,
    'dividend',
    -v_distributable_profit,
    format('Annual profit distribution (Game Year %s)', v_game_year),
    'owner_transfer'
  );

  UPDATE public.company_profit_distributions
  SET distributed_profit = v_distributable_profit
  WHERE id = v_distribution_id;

  RETURN QUERY SELECT v_distributable_profit, v_game_year;
END;
$$;

GRANT EXECUTE ON FUNCTION public.distribute_company_annual_profit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_company_annual_profit(uuid) TO service_role;
