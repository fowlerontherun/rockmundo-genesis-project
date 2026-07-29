-- Harden annual company profit distribution around the canonical finance ledger.
-- The public RPC signature is preserved so existing clients continue to work.

CREATE OR REPLACE FUNCTION public.distribute_company_annual_profit(p_company_id uuid)
RETURNS TABLE(distributed_profit numeric, game_year integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_actor_profile_id uuid := public._caller_profile_id();
  v_company public.companies%ROWTYPE;
  v_distribution_id uuid;
  v_existing_profit numeric;
  v_game_year integer;
  v_latest_distributed_at timestamptz;
  v_profit numeric := 0;
  v_distributable_profit numeric := 0;
  v_total_shares bigint := 0;
  v_paid_total numeric := 0;
  v_financial_transaction_id uuid;
  v_payout record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_company
  FROM public.companies c
  WHERE c.id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_company.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'company_not_owned' USING ERRCODE = 'P0001';
  END IF;

  IF v_company.status <> 'active' OR coalesce(v_company.is_bankrupt, false) THEN
    RAISE EXCEPTION 'company_not_active' USING ERRCODE = 'P0001';
  END IF;

  -- Mirrors the canonical defaults currently used by src/utils/gameCalendar.ts.
  v_game_year := floor(
    floor(
      greatest(
        0,
        extract(epoch FROM (now() - timestamptz '2026-01-01T00:00:00Z')) / 86400
      ) * 3
    ) / 360
  ) + 1;

  SELECT d.distributed_profit INTO v_existing_profit
  FROM public.company_profit_distributions d
  WHERE d.company_id = p_company_id
    AND d.game_year = v_game_year
  FOR UPDATE;

  IF FOUND THEN
    IF coalesce(v_existing_profit, 0) <= 0 THEN
      RAISE EXCEPTION 'company_profit_distribution_incomplete' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_existing_profit, v_game_year;
    RETURN;
  END IF;

  SELECT d.distributed_at INTO v_latest_distributed_at
  FROM public.company_profit_distributions d
  WHERE d.company_id = p_company_id
  ORDER BY d.distributed_at DESC
  LIMIT 1;

  SELECT coalesce(sum(t.amount), 0) INTO v_profit
  FROM public.company_transactions t
  WHERE t.company_id = p_company_id
    AND (v_latest_distributed_at IS NULL OR t.created_at > v_latest_distributed_at)
    AND coalesce(t.category, '') <> 'owner_transfer'
    AND t.transaction_type NOT IN ('investment', 'dividend', 'transfer_in', 'transfer_out');

  v_distributable_profit := greatest(0, floor(v_profit));

  IF v_distributable_profit <= 0 THEN
    RAISE EXCEPTION 'no_profit_available_to_distribute' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(v_company.balance, 0) < v_distributable_profit THEN
    RAISE EXCEPTION 'insufficient_company_balance' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.company_shareholders sh
  WHERE sh.company_id = p_company_id
  FOR UPDATE;

  SELECT coalesce(sum(sh.shares), 0) INTO v_total_shares
  FROM public.company_shareholders sh
  WHERE sh.company_id = p_company_id;

  IF v_total_shares <= 0 THEN
    RAISE EXCEPTION 'no_valid_company_shareholders' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_shareholders sh
    WHERE sh.company_id = p_company_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = sh.user_id
          AND p.is_active = true
          AND p.died_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'shareholder_active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.company_profit_distributions(
    company_id,
    game_year,
    distributed_profit,
    distributed_by
  ) VALUES (
    p_company_id,
    v_game_year,
    0,
    v_user_id
  )
  RETURNING id INTO v_distribution_id;

  FOR v_payout IN
    WITH shareholder_profiles AS (
      SELECT
        sh.user_id,
        sh.shares,
        p.id AS profile_id,
        (v_distributable_profit * sh.shares::numeric / v_total_shares::numeric) AS exact_payout
      FROM public.company_shareholders sh
      CROSS JOIN LATERAL (
        SELECT profile.id
        FROM public.profiles profile
        WHERE profile.user_id = sh.user_id
          AND profile.is_active = true
          AND profile.died_at IS NULL
        ORDER BY profile.updated_at DESC NULLS LAST, profile.id
        LIMIT 1
      ) p
      WHERE sh.company_id = p_company_id
    ), base_allocations AS (
      SELECT
        shareholder_profiles.user_id,
        shareholder_profiles.shares,
        shareholder_profiles.profile_id,
        floor(shareholder_profiles.exact_payout) AS base_payout,
        shareholder_profiles.exact_payout - floor(shareholder_profiles.exact_payout) AS fractional_remainder
      FROM shareholder_profiles
    ), ranked_allocations AS (
      SELECT
        base_allocations.*,
        sum(base_allocations.base_payout) OVER () AS base_total,
        row_number() OVER (
          ORDER BY base_allocations.fractional_remainder DESC,
                   base_allocations.shares DESC,
                   base_allocations.user_id
        ) AS remainder_rank
      FROM base_allocations
    )
    SELECT
      ranked_allocations.user_id,
      ranked_allocations.profile_id,
      ranked_allocations.base_payout + CASE
        WHEN ranked_allocations.remainder_rank <=
             (v_distributable_profit - ranked_allocations.base_total)::integer THEN 1
        ELSE 0
      END AS payout
    FROM ranked_allocations
    ORDER BY ranked_allocations.user_id
  LOOP
    IF v_payout.payout <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM 1
    FROM public.profiles p
    WHERE p.id = v_payout.profile_id
    FOR UPDATE;

    SELECT public.finance_transfer(
      'company',
      p_company_id,
      'player',
      v_payout.profile_id,
      round(v_payout.payout * 100)::bigint,
      'company_revenue',
      format('Annual shareholder distribution, game year %s', v_game_year),
      format('company-profit-distribution:%s:%s:%s', p_company_id, v_game_year, v_payout.user_id),
      'company_profit_distribution',
      v_distribution_id,
      v_actor_profile_id,
      jsonb_build_object(
        'flow', 'shareholder_dividend',
        'companyId', p_company_id,
        'gameYear', v_game_year,
        'shareholderUserId', v_payout.user_id
      )
    ) INTO v_financial_transaction_id;

    UPDATE public.profiles p
    SET cash = coalesce(p.cash, 0) + v_payout.payout,
        updated_at = now()
    WHERE p.id = v_payout.profile_id;

    v_paid_total := v_paid_total + v_payout.payout;
  END LOOP;

  IF v_paid_total <> v_distributable_profit THEN
    RAISE EXCEPTION 'company_profit_allocation_mismatch' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.companies c
  SET balance = c.balance - v_paid_total,
      updated_at = now()
  WHERE c.id = p_company_id;

  INSERT INTO public.company_transactions(
    company_id,
    transaction_type,
    amount,
    description,
    category,
    related_entity_id,
    related_entity_type
  ) VALUES (
    p_company_id,
    'dividend',
    -v_paid_total,
    format('Annual profit distribution (Game Year %s)', v_game_year),
    'owner_transfer',
    v_distribution_id,
    'company_profit_distribution'
  );

  UPDATE public.company_profit_distributions d
  SET distributed_profit = v_paid_total,
      distributed_at = now()
  WHERE d.id = v_distribution_id;

  RETURN QUERY SELECT v_paid_total, v_game_year;
END;
$$;

REVOKE ALL ON FUNCTION public.distribute_company_annual_profit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distribute_company_annual_profit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_company_annual_profit(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
