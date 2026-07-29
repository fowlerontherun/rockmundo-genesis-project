-- Canonical active-character finance command centre.
-- Personal net worth is derived from the selected character's ledger-backed accounts,
-- investments and canonical liabilities. Band treasuries and other currencies are
-- returned separately and are never folded into the personal headline total.

CREATE OR REPLACE FUNCTION public.get_my_finance_command_center(
  p_transaction_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_user_id uuid := auth.uid();
  active_profile_id uuid := public.current_active_player_profile_id();
  row_limit integer := LEAST(GREATEST(COALESCE(p_transaction_limit, 100), 1), 250);
  banking_dashboard jsonb;
  primary_currency char(3) := 'GBP';
  wallet_minor bigint := 0;
  personal_accounts_minor bigint := 0;
  total_invested_minor bigint := 0;
  investment_value_minor bigint := 0;
  total_loans_minor bigint := 0;
  total_earnings_minor bigint := 0;
  total_expenses_minor bigint := 0;
  monthly_income_minor bigint := 0;
  monthly_expenses_minor bigint := 0;
  transactions_json jsonb := '[]'::jsonb;
  monthly_ledger_json jsonb := '[]'::jsonb;
  earnings_by_source_json jsonb := '{}'::jsonb;
  investments_json jsonb := '[]'::jsonb;
  loans_json jsonb := '[]'::jsonb;
  bands_json jsonb := '[]'::jsonb;
  other_currency_balances_json jsonb := '[]'::jsonb;
BEGIN
  IF actor_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF active_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = active_profile_id
      AND profile.user_id = actor_user_id
  ) THEN
    RAISE EXCEPTION 'active_profile_not_owned' USING ERRCODE = '42501';
  END IF;

  banking_dashboard := public.get_banking_dashboard();
  primary_currency := COALESCE(
    NULLIF(banking_dashboard #>> '{savingsSummary,currencyCode}', ''),
    'GBP'
  )::char(3);

  SELECT COALESCE((
    SELECT account.current_balance_minor
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
      AND account.is_primary
      AND account.account_status <> 'archived'
      AND COALESCE(account.currency_code, account.default_currency_code) = primary_currency
    ORDER BY account.created_at, account.id
    LIMIT 1
  ), 0)
  INTO wallet_minor;

  SELECT COALESCE(SUM(account.current_balance_minor), 0)
  INTO personal_accounts_minor
  FROM public.financial_accounts account
  WHERE account.owner_type = 'player'
    AND account.owner_id = active_profile_id
    AND account.account_status <> 'archived'
    AND COALESCE(account.currency_code, account.default_currency_code) = primary_currency;

  SELECT
    COALESCE(SUM(investment.invested_amount::bigint * 100), 0),
    COALESCE(SUM(investment.current_value::bigint * 100), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', investment.id,
        'name', investment.investment_name,
        'category', investment.category,
        'investedMinor', investment.invested_amount::bigint * 100,
        'currentValueMinor', investment.current_value::bigint * 100,
        'growthRate', investment.growth_rate,
        'purchasedAt', investment.purchased_at,
        'notes', investment.notes,
        'currencyCode', primary_currency
      ) ORDER BY investment.purchased_at DESC, investment.id
    ), '[]'::jsonb)
  INTO total_invested_minor, investment_value_minor, investments_json
  FROM public.player_investments investment
  WHERE investment.profile_id = active_profile_id;

  SELECT
    COALESCE(SUM(contract.outstanding_principal_minor + contract.accrued_interest_minor), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', contract.id,
        'providerName', COALESCE(provider.brand_name, 'Lender'),
        'status', contract.status,
        'principalMinor', contract.principal_minor,
        'outstandingMinor', contract.outstanding_principal_minor + contract.accrued_interest_minor,
        'currencyCode', contract.currency_code,
        'interestRateBps', contract.interest_rate_basis_points,
        'scheduledPaymentMinor', contract.scheduled_payment_minor,
        'nextPaymentDate', contract.next_payment_date,
        'maturityDate', contract.maturity_date,
        'purpose', contract.purpose
      ) ORDER BY contract.next_payment_date NULLS LAST, contract.created_at DESC
    ), '[]'::jsonb)
  INTO total_loans_minor, loans_json
  FROM public.loan_contracts contract
  LEFT JOIN public.banking_providers provider ON provider.id = contract.provider_id
  WHERE contract.borrower_type = 'player'
    AND contract.borrower_id = active_profile_id
    AND contract.currency_code = primary_currency
    AND contract.status NOT IN ('paid_off', 'written_off', 'cancelled');

  WITH owned_accounts AS (
    SELECT account.id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
  ), classified AS (
    SELECT
      transaction.net_amount_minor,
      CASE
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN 'transfer'
        WHEN transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN 'income'
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          THEN 'expense'
        ELSE 'other'
      END AS direction,
      CASE
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN false
        WHEN transaction.transaction_category::text IN (
          'starting_funds', 'administrative_adjustment',
          'loan_disbursement', 'loan_refinance_settlement'
        ) THEN false
        WHEN COALESCE(transaction.metadata->>'classification', '') IN (
          'transfer', 'internal_savings_transfer', 'wallet_reconciliation'
        ) THEN false
        ELSE true
      END AS is_external_cash_flow
    FROM public.financial_transactions transaction
    WHERE transaction.status = 'completed'
      AND transaction.currency_code = primary_currency
      AND (
        transaction.source_account_id IN (SELECT id FROM owned_accounts)
        OR transaction.destination_account_id IN (SELECT id FROM owned_accounts)
      )
  )
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'income' AND is_external_cash_flow THEN net_amount_minor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'expense' AND is_external_cash_flow THEN net_amount_minor ELSE 0 END), 0)
  INTO total_earnings_minor, total_expenses_minor
  FROM classified;

  WITH owned_accounts AS (
    SELECT account.id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
  ), classified AS (
    SELECT
      transaction.*,
      CASE
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN 'transfer'
        WHEN transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN 'income'
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          THEN 'expense'
        ELSE 'other'
      END AS direction,
      CASE
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          THEN false
        WHEN transaction.transaction_category::text IN (
          'starting_funds', 'administrative_adjustment',
          'loan_disbursement', 'loan_refinance_settlement'
        ) THEN false
        WHEN COALESCE(transaction.metadata->>'classification', '') IN (
          'transfer', 'internal_savings_transfer', 'wallet_reconciliation'
        ) THEN false
        ELSE true
      END AS is_external_cash_flow
    FROM public.financial_transactions transaction
    WHERE transaction.status = 'completed'
      AND transaction.currency_code = primary_currency
      AND (
        transaction.source_account_id IN (SELECT id FROM owned_accounts)
        OR transaction.destination_account_id IN (SELECT id FROM owned_accounts)
      )
    ORDER BY transaction.created_at DESC, transaction.id DESC
    LIMIT row_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', item.id,
      'createdAt', item.created_at,
      'direction', item.direction,
      'source', initcap(replace(item.transaction_category::text, '_', ' ')),
      'amountMinor', item.net_amount_minor,
      'description', item.description,
      'currencyCode', item.currency_code,
      'category', item.transaction_category,
      'sourceAccountId', item.source_account_id,
      'destinationAccountId', item.destination_account_id,
      'relatedEntityType', item.related_entity_type,
      'relatedEntityId', item.related_entity_id,
      'externalCashFlow', item.is_external_cash_flow
    ) ORDER BY item.created_at DESC, item.id DESC
  ), '[]'::jsonb)
  INTO transactions_json
  FROM classified item;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  ), owned_accounts AS (
    SELECT account.id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
  ), external_transactions AS (
    SELECT
      transaction.created_at,
      transaction.net_amount_minor,
      CASE
        WHEN transaction.destination_account_id IN (SELECT id FROM owned_accounts)
          AND NOT EXISTS (
            SELECT 1 FROM owned_accounts owned
            WHERE owned.id = transaction.source_account_id
          ) THEN 'income'
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND NOT EXISTS (
            SELECT 1 FROM owned_accounts owned
            WHERE owned.id = transaction.destination_account_id
          ) THEN 'expense'
        ELSE 'other'
      END AS direction
    FROM public.financial_transactions transaction
    WHERE transaction.status = 'completed'
      AND transaction.currency_code = primary_currency
      AND transaction.transaction_category::text NOT IN (
        'starting_funds', 'administrative_adjustment',
        'loan_disbursement', 'loan_refinance_settlement'
      )
      AND COALESCE(transaction.metadata->>'classification', '') NOT IN (
        'transfer', 'internal_savings_transfer', 'wallet_reconciliation'
      )
      AND (
        transaction.source_account_id IN (SELECT id FROM owned_accounts)
        OR transaction.destination_account_id IN (SELECT id FROM owned_accounts)
      )
  ), monthly AS (
    SELECT
      month.month_start,
      COALESCE(SUM(item.net_amount_minor) FILTER (WHERE item.direction = 'income'), 0)::bigint AS income_minor,
      COALESCE(SUM(item.net_amount_minor) FILTER (WHERE item.direction = 'expense'), 0)::bigint AS expenses_minor
    FROM months month
    LEFT JOIN external_transactions item
      ON date_trunc('month', item.created_at) = month.month_start
    GROUP BY month.month_start
    ORDER BY month.month_start
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'monthKey', to_char(month_start, 'YYYY-MM'),
        'month', to_char(month_start, 'Mon'),
        'incomeMinor', income_minor,
        'expensesMinor', expenses_minor,
        'currencyCode', primary_currency
      ) ORDER BY month_start
    ), '[]'::jsonb),
    COALESCE(round(avg(income_minor))::bigint, 0),
    COALESCE(round(avg(expenses_minor))::bigint, 0)
  INTO monthly_ledger_json, monthly_income_minor, monthly_expenses_minor
  FROM monthly;

  WITH owned_accounts AS (
    SELECT account.id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
  ), source_totals AS (
    SELECT
      initcap(replace(transaction.transaction_category::text, '_', ' ')) AS source,
      SUM(transaction.net_amount_minor)::bigint AS amount_minor
    FROM public.financial_transactions transaction
    WHERE transaction.status = 'completed'
      AND transaction.currency_code = primary_currency
      AND transaction.destination_account_id IN (SELECT id FROM owned_accounts)
      AND NOT EXISTS (
        SELECT 1 FROM owned_accounts owned
        WHERE owned.id = transaction.source_account_id
      )
      AND transaction.transaction_category::text NOT IN (
        'starting_funds', 'administrative_adjustment',
        'loan_disbursement', 'loan_refinance_settlement'
      )
      AND COALESCE(transaction.metadata->>'classification', '') NOT IN (
        'transfer', 'internal_savings_transfer', 'wallet_reconciliation'
      )
    GROUP BY transaction.transaction_category
  )
  SELECT COALESCE(jsonb_object_agg(source, amount_minor), '{}'::jsonb)
  INTO earnings_by_source_json
  FROM source_totals;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'currencyCode', grouped.currency_code,
      'balanceMinor', grouped.balance_minor,
      'availableBalanceMinor', grouped.available_minor
    ) ORDER BY grouped.currency_code
  ), '[]'::jsonb)
  INTO other_currency_balances_json
  FROM (
    SELECT
      COALESCE(account.currency_code, account.default_currency_code) AS currency_code,
      SUM(account.current_balance_minor)::bigint AS balance_minor,
      SUM(account.available_balance_minor)::bigint AS available_minor
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = active_profile_id
      AND account.account_status <> 'archived'
      AND COALESCE(account.currency_code, account.default_currency_code) <> primary_currency
    GROUP BY COALESCE(account.currency_code, account.default_currency_code)
  ) grouped;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', band_row.id,
      'name', band_row.name,
      'memberCount', band_row.member_count,
      'treasuries', band_row.treasuries
    ) ORDER BY band_row.name, band_row.id
  ), '[]'::jsonb)
  INTO bands_json
  FROM (
    SELECT
      band.id,
      band.name,
      (
        SELECT COUNT(*)::integer
        FROM public.band_members counted_member
        WHERE counted_member.band_id = band.id
          AND COALESCE(counted_member.member_status, 'active') = 'active'
      ) AS member_count,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'accountId', treasury.id,
            'currencyCode', COALESCE(treasury.currency_code, treasury.default_currency_code),
            'balanceMinor', treasury.current_balance_minor,
            'availableBalanceMinor', treasury.available_balance_minor
          ) ORDER BY COALESCE(treasury.currency_code, treasury.default_currency_code), treasury.created_at
        )
        FROM public.financial_accounts treasury
        WHERE treasury.owner_type = 'band'
          AND treasury.owner_id = band.id
          AND treasury.account_status = 'active'
          AND treasury.metadata->>'account_role' = 'band_treasury'
      ), '[]'::jsonb) AS treasuries
    FROM public.band_members membership
    JOIN public.bands band ON band.id = membership.band_id
    WHERE membership.profile_id = active_profile_id
      AND COALESCE(membership.member_status, 'active') = 'active'
  ) band_row;

  RETURN jsonb_build_object(
    'status', 'ok',
    'profileId', active_profile_id,
    'currencyCode', primary_currency,
    'banking', banking_dashboard,
    'summary', jsonb_build_object(
      'cashMinor', wallet_minor,
      'personalAccountsMinor', personal_accounts_minor,
      'totalInvestedMinor', total_invested_minor,
      'investmentValueMinor', investment_value_minor,
      'totalLoansMinor', total_loans_minor,
      'netWorthMinor', personal_accounts_minor + investment_value_minor - total_loans_minor,
      'totalEarningsMinor', total_earnings_minor,
      'totalExpensesMinor', total_expenses_minor,
      'monthlyIncomeMinor', monthly_income_minor,
      'monthlyExpensesMinor', monthly_expenses_minor
    ),
    'transactions', transactions_json,
    'monthlyLedger', monthly_ledger_json,
    'earningsBySource', earnings_by_source_json,
    'investments', investments_json,
    'loans', loans_json,
    'bands', bands_json,
    'otherCurrencyBalances', other_currency_balances_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_finance_command_center(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_finance_command_center(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
