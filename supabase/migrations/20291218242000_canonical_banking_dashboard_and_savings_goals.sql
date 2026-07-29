-- Restore the active-character canonical banking dashboard and make savings goals
-- ledger-backed. Legacy savings-goal progress was only a facade counter and did
-- not have balanced financial ledger entries, so it is retained in metadata for
-- audit purposes while the canonical goal account starts at zero.

ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS owner_type public.financial_owner_type;
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS financial_account_id uuid REFERENCES public.financial_accounts(id);
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS savings_goals_financial_account_unique_idx
  ON public.savings_goals(financial_account_id)
  WHERE financial_account_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'savings_goals'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.savings_goals
      SET owner_type = COALESCE(owner_type, 'player'::public.financial_owner_type),
          owner_id = COALESCE(owner_id, profile_id)
      WHERE profile_id IS NOT NULL
        AND (owner_type IS NULL OR owner_id IS NULL)
    $sql$;
  END IF;
END $$;

DO $$
DECLARE
  goal_row record;
  wallet_row public.financial_accounts%ROWTYPE;
  goal_account_id uuid;
  goal_currency char(3);
BEGIN
  FOR goal_row IN
    SELECT id, owner_id, name, current_minor, currency_code, metadata
    FROM public.savings_goals
    WHERE owner_type = 'player'
      AND owner_id IS NOT NULL
      AND financial_account_id IS NULL
  LOOP
    SELECT *
    INTO wallet_row
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = goal_row.owner_id
      AND is_primary
    ORDER BY created_at, id
    LIMIT 1;

    IF wallet_row.id IS NULL THEN
      CONTINUE;
    END IF;

    goal_currency := COALESCE(wallet_row.currency_code, wallet_row.default_currency_code);

    INSERT INTO public.financial_accounts (
      owner_type,
      owner_id,
      account_name,
      account_status,
      current_balance_minor,
      default_currency_code,
      currency_code,
      is_primary,
      metadata
    ) VALUES (
      'player',
      goal_row.owner_id,
      'Savings goal: ' || goal_row.name,
      'active',
      0,
      goal_currency,
      goal_currency,
      false,
      jsonb_build_object(
        'account_role', 'savings_goal',
        'savings_goal_id', goal_row.id,
        'classification', 'restricted_savings'
      )
    )
    RETURNING id INTO goal_account_id;

    UPDATE public.savings_goals
    SET financial_account_id = goal_account_id,
        currency_code = goal_currency,
        current_minor = 0,
        metadata = COALESCE(goal_row.metadata, '{}'::jsonb) || jsonb_build_object(
          'legacy_unledgered_projection_minor', COALESCE(goal_row.current_minor, 0),
          'legacy_projection_currency_code', goal_row.currency_code,
          'canonicalised_at', now()
        )
    WHERE id = goal_row.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_my_savings_goal(
  p_name text,
  p_target_minor bigint,
  p_target_date date,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  wallet public.financial_accounts%ROWTYPE;
  existing_goal public.savings_goals%ROWTYPE;
  goal_account_id uuid;
  goal_id uuid;
  currency char(3);
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) < 2 THEN
    RAISE EXCEPTION 'goal_name_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF p_target_minor IS NULL OR p_target_minor <= 0 THEN
    RAISE EXCEPTION 'goal_target_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO existing_goal
  FROM public.savings_goals
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND metadata->>'creation_idempotency_key' = p_idempotency_key
  LIMIT 1;

  IF existing_goal.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'goalId', existing_goal.id,
      'financialAccountId', existing_goal.financial_account_id,
      'currencyCode', existing_goal.currency_code,
      'targetMinor', existing_goal.target_minor,
      'currentMinor', existing_goal.current_minor,
      'idempotent', true
    );
  END IF;

  SELECT *
  INTO wallet
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary
    AND account_status = 'active'
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE;

  IF wallet.id IS NULL THEN
    RAISE EXCEPTION 'active_wallet_not_found' USING ERRCODE = 'P0001';
  END IF;

  currency := COALESCE(wallet.currency_code, wallet.default_currency_code);

  INSERT INTO public.financial_accounts (
    owner_type,
    owner_id,
    account_name,
    account_status,
    current_balance_minor,
    default_currency_code,
    currency_code,
    is_primary,
    metadata
  ) VALUES (
    'player',
    profile_id,
    'Savings goal: ' || btrim(p_name),
    'active',
    0,
    currency,
    currency,
    false,
    jsonb_build_object(
      'account_role', 'savings_goal',
      'classification', 'restricted_savings'
    )
  )
  RETURNING id INTO goal_account_id;

  INSERT INTO public.savings_goals (
    owner_type,
    owner_id,
    name,
    target_minor,
    current_minor,
    currency_code,
    target_date,
    status,
    financial_account_id,
    metadata
  ) VALUES (
    'player',
    profile_id,
    btrim(p_name),
    p_target_minor,
    0,
    currency,
    p_target_date,
    'active',
    goal_account_id,
    jsonb_build_object('creation_idempotency_key', p_idempotency_key)
  )
  RETURNING id INTO goal_id;

  UPDATE public.financial_accounts
  SET metadata = metadata || jsonb_build_object('savings_goal_id', goal_id)
  WHERE id = goal_account_id;

  RETURN jsonb_build_object(
    'goalId', goal_id,
    'financialAccountId', goal_account_id,
    'currencyCode', currency,
    'targetMinor', p_target_minor,
    'currentMinor', 0,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_savings_goal_funding_sources(p_goal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  goal public.savings_goals%ROWTYPE;
  goal_account public.financial_accounts%ROWTYPE;
  sources jsonb;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO goal
  FROM public.savings_goals
  WHERE id = p_goal_id
    AND owner_type = 'player'
    AND owner_id = profile_id
  FOR UPDATE;

  IF goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO goal_account
  FROM public.financial_accounts
  WHERE id = goal.financial_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id
    AND account_status = 'active';

  IF goal_account.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_account_missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      source
      ORDER BY
        CASE source->>'sourceKind' WHEN 'wallet' THEN 0 ELSE 1 END,
        CASE WHEN COALESCE((source->>'eligible')::boolean, false) THEN 0 ELSE 1 END,
        source->>'displayName'
    ),
    '[]'::jsonb
  )
  INTO sources
  FROM (
    SELECT jsonb_build_object(
      'sourceKind', 'wallet',
      'sourceAccountId', NULL,
      'displayName', 'Character wallet',
      'accountType', 'wallet',
      'currencyCode', COALESCE(currency_code, default_currency_code),
      'availableBalanceMinor', available_balance_minor,
      'eligible', account_status = 'active'
        AND available_balance_minor > 0
        AND COALESCE(currency_code, default_currency_code) = goal.currency_code,
      'ineligibleReason', CASE
        WHEN account_status <> 'active' THEN 'Wallet is unavailable'
        WHEN COALESCE(currency_code, default_currency_code) <> goal.currency_code THEN 'Currency does not match this goal'
        WHEN available_balance_minor <= 0 THEN 'Wallet has no available funds'
        ELSE NULL
      END
    ) AS source
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = profile_id
      AND is_primary

    UNION ALL

    SELECT jsonb_build_object(
      'sourceKind', 'bank',
      'sourceAccountId', bank.id,
      'displayName', COALESCE(
        NULLIF(bank.metadata->>'display_name', ''),
        initcap(replace(bank.account_type::text, '_', ' ')) || ' account'
      ),
      'accountType', bank.account_type,
      'currencyCode', bank.currency_code,
      'availableBalanceMinor', finance.available_balance_minor,
      'eligible', COALESCE((eligibility.result->>'eligible')::boolean, false),
      'ineligibleReason', eligibility.result->>'reason'
    ) AS source
    FROM public.bank_accounts bank
    JOIN public.financial_accounts finance
      ON finance.id = bank.linked_finance_account_id
    CROSS JOIN LATERAL (
      SELECT public.is_bank_account_eligible_for_outgoing_payment(
        bank.id,
        NULL,
        goal.currency_code::char(3)
      ) AS result
    ) eligibility
    WHERE bank.owner_type = 'player'
      AND bank.owner_id = profile_id
  ) available_sources;

  RETURN jsonb_build_object(
    'status', 'ok',
    'goalId', goal.id,
    'goalName', goal.name,
    'currencyCode', goal.currency_code,
    'targetMinor', goal.target_minor,
    'currentMinor', goal_account.current_balance_minor,
    'sources', sources
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_my_savings_goal_funding(
  p_goal_id uuid,
  p_source_kind text,
  p_source_account_id uuid,
  p_amount_minor bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  goal public.savings_goals%ROWTYPE;
  goal_account public.financial_accounts%ROWTYPE;
  source_account public.financial_accounts%ROWTYPE;
  bank public.bank_accounts%ROWTYPE;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO goal
  FROM public.savings_goals
  WHERE id = p_goal_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  IF goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO goal_account
  FROM public.financial_accounts
  WHERE id = goal.financial_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id
    AND account_status = 'active';

  IF goal_account.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_account_missing' USING ERRCODE = 'P0001';
  END IF;

  IF p_source_kind = 'wallet' THEN
    IF mod(p_amount_minor, 100) <> 0 THEN
      RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = profile_id
      AND is_primary
      AND account_status = 'active';
  ELSIF p_source_kind = 'bank' THEN
    SELECT * INTO bank
    FROM public.bank_accounts
    WHERE id = p_source_account_id
      AND owner_type = 'player'
      AND owner_id = profile_id;

    IF bank.id IS NULL OR NOT COALESCE((
      public.is_bank_account_eligible_for_outgoing_payment(
        bank.id,
        p_amount_minor,
        goal.currency_code::char(3)
      )->>'eligible'
    )::boolean, false) THEN
      RAISE EXCEPTION 'source_account_ineligible' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE id = bank.linked_finance_account_id
      AND account_status = 'active';
  ELSE
    RAISE EXCEPTION 'source_kind_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF source_account.id IS NULL THEN
    RAISE EXCEPTION 'source_account_missing' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(source_account.currency_code, source_account.default_currency_code) <> goal.currency_code THEN
    RAISE EXCEPTION 'currency_mismatch_no_conversion' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.available_balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'goalId', goal.id,
    'goalName', goal.name,
    'sourceKind', p_source_kind,
    'sourceAccountId', p_source_account_id,
    'currencyCode', goal.currency_code,
    'sourceBalanceMinor', source_account.available_balance_minor,
    'amountMinor', p_amount_minor,
    'resultingSourceBalanceMinor', source_account.available_balance_minor - p_amount_minor,
    'goalBalanceMinor', goal_account.current_balance_minor,
    'resultingGoalBalanceMinor', goal_account.current_balance_minor + p_amount_minor,
    'targetMinor', goal.target_minor
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fund_my_savings_goal(
  p_goal_id uuid,
  p_source_kind text,
  p_source_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  goal public.savings_goals%ROWTYPE;
  goal_account public.financial_accounts%ROWTYPE;
  source_account public.financial_accounts%ROWTYPE;
  bank public.bank_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  transaction_id uuid;
  new_goal_balance bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.preview_my_savings_goal_funding(
    p_goal_id,
    p_source_kind,
    p_source_account_id,
    p_amount_minor
  );

  SELECT * INTO goal
  FROM public.savings_goals
  WHERE id = p_goal_id
    AND owner_type = 'player'
    AND owner_id = profile_id
  FOR UPDATE;

  SELECT * INTO goal_account
  FROM public.financial_accounts
  WHERE id = goal.financial_account_id
  FOR UPDATE;

  SELECT * INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.destination_account_id IS DISTINCT FROM goal_account.id
      OR existing_transaction.gross_amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'goalId', goal.id,
      'transactionId', existing_transaction.id,
      'currencyCode', goal.currency_code,
      'goalBalanceMinor', goal_account.current_balance_minor,
      'targetMinor', goal.target_minor,
      'idempotent', true
    );
  END IF;

  IF p_source_kind = 'wallet' THEN
    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = profile_id
      AND is_primary
    FOR UPDATE;
  ELSE
    SELECT * INTO bank
    FROM public.bank_accounts
    WHERE id = p_source_account_id
      AND owner_type = 'player'
      AND owner_id = profile_id
    FOR UPDATE;

    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE id = bank.linked_finance_account_id
    FOR UPDATE;
  END IF;

  transaction_id := public._move_financial_account_money(
    source_account.id,
    goal_account.id,
    p_amount_minor,
    'bank_transfer',
    'Savings goal contribution',
    p_idempotency_key,
    profile_id,
    'savings_goal',
    goal.id,
    jsonb_build_object(
      'classification', 'internal_savings_transfer',
      'source_kind', p_source_kind,
      'commercial_revenue', false
    )
  );

  SELECT current_balance_minor
  INTO new_goal_balance
  FROM public.financial_accounts
  WHERE id = goal_account.id;

  UPDATE public.savings_goals
  SET current_minor = new_goal_balance,
      status = CASE WHEN new_goal_balance >= target_minor THEN 'completed' ELSE 'active' END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_funded_at', now())
  WHERE id = goal.id;

  IF p_source_kind = 'wallet' THEN
    UPDATE public.profiles
    SET cash = (
      SELECT current_balance_minor / 100
      FROM public.financial_accounts
      WHERE id = source_account.id
    )
    WHERE id = profile_id;
  END IF;

  RETURN jsonb_build_object(
    'goalId', goal.id,
    'transactionId', transaction_id,
    'currencyCode', goal.currency_code,
    'sourceBalanceMinor', (
      SELECT current_balance_minor FROM public.financial_accounts WHERE id = source_account.id
    ),
    'goalBalanceMinor', new_goal_balance,
    'targetMinor', goal.target_minor,
    'completed', new_goal_balance >= goal.target_minor,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_banking_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  wallet public.financial_accounts%ROWTYPE;
  currency char(3) := 'GBP';
  accounts jsonb := '[]'::jsonb;
  loans jsonb := '[]'::jsonb;
  recent_activity jsonb := '[]'::jsonb;
  goals jsonb := '[]'::jsonb;
  notifications jsonb := '[]'::jsonb;
  credit_profile jsonb;
  wallet_minor bigint := 0;
  bank_minor bigint := 0;
  savings_minor bigint := 0;
  goal_minor bigint := 0;
  locked_minor bigint := 0;
BEGIN
  IF profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'accounts', accounts,
      'loans', loans,
      'creditProfile', jsonb_build_object(
        'band', 'Building',
        'positiveFactors', jsonb_build_array('Create a character to start banking.'),
        'negativeFactors', '[]'::jsonb
      ),
      'recentActivity', recent_activity,
      'savingsSummary', jsonb_build_object(
        'netWorthMinor', 0,
        'cashMinor', 0,
        'savingsMinor', 0,
        'lockedDepositsMinor', 0,
        'monthlyInterestMinor', 0,
        'interestEarnedYtdMinor', 0,
        'currencyCode', currency
      ),
      'cashFlowAnalytics', jsonb_build_object(
        'incomeMinor', 0,
        'expensesMinor', 0,
        'savingsRateBps', 0,
        'financialHealth', 'building',
        'largestExpenseCategories', '[]'::jsonb
      ),
      'savingsGoals', goals,
      'notifications', notifications
    );
  END IF;

  SELECT * INTO wallet
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary
  ORDER BY created_at, id
  LIMIT 1;

  IF wallet.id IS NOT NULL THEN
    currency := COALESCE(wallet.currency_code, wallet.default_currency_code, 'GBP'::char(3));
    wallet_minor := wallet.current_balance_minor;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', bank.id,
    'accountType', bank.account_type,
    'currencyCode', bank.currency_code,
    'balanceMinor', finance.current_balance_minor,
    'availableBalanceMinor', finance.available_balance_minor,
    'providerName', COALESCE(provider.brand_name, 'Bank account'),
    'nickname', NULLIF(bank.metadata->>'display_name', ''),
    'restrictionSummary', CASE
      WHEN bank.status <> 'active' THEN initcap(bank.status::text)
      WHEN COALESCE(bank.withdrawal_restrictions, '{}'::jsonb) <> '{}'::jsonb THEN 'Withdrawal restrictions apply'
      ELSE NULL
    END,
    'annualRateBps', COALESCE(
      (bank.interest_configuration->>'annual_rate_bps')::integer,
      provider.base_deposit_rate_basis_points,
      0
    )
  ) ORDER BY bank.created_at), '[]'::jsonb),
  COALESCE(sum(finance.current_balance_minor), 0),
  COALESCE(sum(finance.current_balance_minor) FILTER (
    WHERE bank.account_type::text <> 'current'
  ), 0)
  INTO accounts, bank_minor, savings_minor
  FROM public.bank_accounts bank
  JOIN public.financial_accounts finance
    ON finance.id = bank.linked_finance_account_id
  LEFT JOIN public.banking_providers provider
    ON provider.id = bank.provider_id
  WHERE bank.owner_type = 'player'
    AND bank.owner_id = profile_id
    AND bank.status <> 'closed';

  SELECT COALESCE(sum(finance.current_balance_minor), 0)
  INTO goal_minor
  FROM public.savings_goals goal
  JOIN public.financial_accounts finance
    ON finance.id = goal.financial_account_id
  WHERE goal.owner_type = 'player'
    AND goal.owner_id = profile_id
    AND goal.status IN ('active', 'completed');

  SELECT COALESCE(sum(amount_minor), 0)
  INTO locked_minor
  FROM public.fixed_deposits
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND status = 'active';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', contract.id,
    'providerName', COALESCE(provider.brand_name, 'Lender'),
    'status', contract.status,
    'principalMinor', contract.principal_minor,
    'outstandingPrincipalMinor', contract.outstanding_principal_minor,
    'currencyCode', contract.currency_code,
    'interestRateBps', contract.interest_rate_basis_points,
    'nextPaymentMinor', COALESCE(next_line.total_due_minor - next_line.amount_paid_minor, contract.scheduled_payment_minor, 0),
    'nextPaymentDate', COALESCE(next_line.due_date, contract.next_payment_date),
    'overdueMinor', COALESCE(overdue.overdue_minor, 0)
  ) ORDER BY COALESCE(next_line.due_date, contract.next_payment_date) NULLS LAST), '[]'::jsonb)
  INTO loans
  FROM public.loan_contracts contract
  LEFT JOIN public.banking_providers provider
    ON provider.id = contract.provider_id
  LEFT JOIN LATERAL (
    SELECT due_date, total_due_minor, amount_paid_minor
    FROM public.loan_schedule_lines line
    WHERE line.loan_contract_id = contract.id
      AND line.status <> 'paid'
    ORDER BY line.due_date, line.instalment_number
    LIMIT 1
  ) next_line ON true
  LEFT JOIN LATERAL (
    SELECT sum(total_due_minor - amount_paid_minor) AS overdue_minor
    FROM public.loan_schedule_lines line
    WHERE line.loan_contract_id = contract.id
      AND line.due_date < current_date
      AND line.status <> 'paid'
  ) overdue ON true
  WHERE contract.borrower_type = 'player'
    AND contract.borrower_id = profile_id
    AND contract.status NOT IN ('cancelled', 'paid_off');

  SELECT COALESCE(jsonb_build_object(
    'band', credit_band,
    'score', credit_score,
    'positiveFactors', jsonb_build_array('Savings and on-time payments improve your banking relationship.'),
    'negativeFactors', '[]'::jsonb
  ), jsonb_build_object(
    'band', 'Building',
    'positiveFactors', jsonb_build_array('Open a current or savings account to start banking.'),
    'negativeFactors', '[]'::jsonb
  ))
  INTO credit_profile
  FROM public.banking_customer_profiles
  WHERE owner_type = 'player'
    AND owner_id = profile_id;

  IF credit_profile IS NULL THEN
    credit_profile := jsonb_build_object(
      'band', 'Building',
      'positiveFactors', jsonb_build_array('Open a current or savings account to start banking.'),
      'negativeFactors', '[]'::jsonb
    );
  END IF;

  WITH owned_accounts AS (
    SELECT wallet.id AS id
    WHERE wallet.id IS NOT NULL
    UNION
    SELECT linked_finance_account_id
    FROM public.bank_accounts
    WHERE owner_type = 'player' AND owner_id = profile_id
    UNION
    SELECT financial_account_id
    FROM public.savings_goals
    WHERE owner_type = 'player' AND owner_id = profile_id
      AND financial_account_id IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', transaction.id,
    'description', transaction.description,
    'amountMinor', transaction.gross_amount_minor,
    'currencyCode', transaction.currency_code,
    'createdAt', transaction.created_at,
    'txType', CASE
      WHEN transaction.related_entity_type = 'savings_goal' THEN 'goal_contribution'
      WHEN transaction.related_entity_type = 'band'
        AND transaction.source_account_id IN (SELECT id FROM owned_accounts) THEN 'band_deposit'
      WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
        AND transaction.destination_account_id NOT IN (SELECT id FROM owned_accounts) THEN 'transfer_out'
      WHEN transaction.destination_account_id IN (SELECT id FROM owned_accounts)
        AND transaction.source_account_id NOT IN (SELECT id FROM owned_accounts) THEN 'transfer_in'
      ELSE transaction.transaction_category::text
    END
  ) ORDER BY transaction.created_at DESC), '[]'::jsonb)
  INTO recent_activity
  FROM (
    SELECT item.*
    FROM public.financial_transactions item
    WHERE item.source_account_id IN (SELECT id FROM owned_accounts)
       OR item.destination_account_id IN (SELECT id FROM owned_accounts)
    ORDER BY item.created_at DESC
    LIMIT 25
  ) transaction;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', goal.id,
    'name', goal.name,
    'targetMinor', goal.target_minor,
    'currentMinor', COALESCE(finance.current_balance_minor, 0),
    'currencyCode', goal.currency_code,
    'completionBps', LEAST(
      10000,
      floor(COALESCE(finance.current_balance_minor, 0)::numeric * 10000 / NULLIF(goal.target_minor, 0))::integer
    ),
    'projectedCompletionDate', goal.target_date,
    'status', goal.status,
    'financialAccountId', goal.financial_account_id
  ) ORDER BY goal.created_at), '[]'::jsonb)
  INTO goals
  FROM public.savings_goals goal
  LEFT JOIN public.financial_accounts finance
    ON finance.id = goal.financial_account_id
  WHERE goal.owner_type = 'player'
    AND goal.owner_id = profile_id
    AND goal.status IN ('active', 'completed');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', notification.id,
    'type', notification.notification_type,
    'title', notification.title,
    'body', notification.body,
    'severity', notification.severity,
    'createdAt', notification.created_at
  ) ORDER BY notification.created_at DESC), '[]'::jsonb)
  INTO notifications
  FROM (
    SELECT item.*
    FROM public.banking_notifications item
    WHERE item.owner_type = 'player'
      AND item.owner_id = profile_id
      AND item.read_at IS NULL
    ORDER BY item.created_at DESC
    LIMIT 5
  ) notification;

  RETURN jsonb_build_object(
    'accounts', accounts,
    'loans', loans,
    'creditProfile', credit_profile,
    'recentActivity', recent_activity,
    'savingsSummary', jsonb_build_object(
      'netWorthMinor', wallet_minor + bank_minor + goal_minor,
      'cashMinor', wallet_minor,
      'savingsMinor', savings_minor + goal_minor,
      'lockedDepositsMinor', locked_minor,
      'monthlyInterestMinor', 0,
      'interestEarnedYtdMinor', 0,
      'currencyCode', currency
    ),
    'cashFlowAnalytics', jsonb_build_object(
      'incomeMinor', 0,
      'expensesMinor', 0,
      'savingsRateBps', 0,
      'financialHealth', 'building',
      'largestExpenseCategories', '[]'::jsonb
    ),
    'savingsGoals', goals,
    'notifications', notifications
  );
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.create_savings_goal(text,bigint,date,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_savings_goal(text,bigint,date,uuid) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.contribute_to_savings_goal(uuid,uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.contribute_to_savings_goal(uuid,uuid,bigint) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.create_my_savings_goal(text,bigint,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_savings_goal_funding_sources(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_my_savings_goal_funding(uuid,text,uuid,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fund_my_savings_goal(uuid,text,uuid,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_banking_dashboard() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_my_savings_goal(text,bigint,date,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_savings_goal_funding_sources(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_my_savings_goal_funding(uuid,text,uuid,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fund_my_savings_goal(uuid,text,uuid,bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_banking_dashboard() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';