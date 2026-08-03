CREATE OR REPLACE FUNCTION public.get_my_finance_command_center(p_transaction_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  pid uuid := public._caller_profile_id();
  row_limit integer := LEAST(GREATEST(COALESCE(p_transaction_limit, 100), 1), 250);
  banking jsonb := jsonb_build_object('accounts','[]'::jsonb,'loans','[]'::jsonb,'recentActivity','[]'::jsonb,'savingsGoals','[]'::jsonb);
  currency text := 'GBP';
  cash_minor bigint := 0;
  accounts_minor bigint := 0;
  invested_minor bigint := 0;
  value_minor bigint := 0;
  loans_minor bigint := 0;
  earnings_minor bigint := 0;
  expenses_minor bigint := 0;
  monthly_income bigint := 0;
  monthly_expenses bigint := 0;
  transactions_json jsonb := '[]'::jsonb;
  monthly_json jsonb := '[]'::jsonb;
  earnings_json jsonb := '{}'::jsonb;
  investments_json jsonb := '[]'::jsonb;
  loans_json jsonb := '[]'::jsonb;
  bands_json jsonb := '[]'::jsonb;
  other_json jsonb := '[]'::jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF pid IS NULL THEN
    RETURN jsonb_build_object(
      'status','ok','profileId',NULL,'currencyCode',currency,'banking',banking,
      'summary', jsonb_build_object('cashMinor',0,'personalAccountsMinor',0,'totalInvestedMinor',0,'investmentValueMinor',0,'totalLoansMinor',0,'netWorthMinor',0,'totalEarningsMinor',0,'totalExpensesMinor',0,'monthlyIncomeMinor',0,'monthlyExpensesMinor',0),
      'transactions','[]'::jsonb,'monthlyLedger','[]'::jsonb,'earningsBySource','{}'::jsonb,
      'investments','[]'::jsonb,'loans','[]'::jsonb,'bands','[]'::jsonb,'otherCurrencyBalances','[]'::jsonb
    );
  END IF;

  banking := public.get_banking_dashboard();

  SELECT COALESCE(a.currency_code,'GBP') INTO currency
  FROM public.bank_accounts a
  WHERE a.profile_id = pid AND a.status = 'active'
  ORDER BY a.created_at
  LIMIT 1;
  currency := COALESCE(currency,'GBP');

  SELECT COALESCE(ROUND(COALESCE(p.cash,0)::numeric * 100)::bigint, 0) INTO cash_minor
  FROM public.profiles p WHERE p.id = pid;
  cash_minor := COALESCE(cash_minor, 0);

  SELECT cash_minor + COALESCE(SUM(a.balance_minor),0) INTO accounts_minor
  FROM public.bank_accounts a
  WHERE a.profile_id = pid AND a.status = 'active' AND COALESCE(a.currency_code,'GBP') = currency;
  accounts_minor := COALESCE(accounts_minor, cash_minor);

  SELECT
    COALESCE(SUM(i.invested_amount)::bigint * 100, 0),
    COALESCE(SUM(i.current_value)::bigint * 100, 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'name', i.investment_name,
      'category', COALESCE(i.category,'general'),
      'investedMinor', i.invested_amount::bigint * 100,
      'currentValueMinor', i.current_value::bigint * 100,
      'growthRate', COALESCE(i.growth_rate,0),
      'purchasedAt', i.purchased_at,
      'notes', i.notes,
      'currencyCode', currency
    ) ORDER BY i.purchased_at DESC NULLS LAST, i.id), '[]'::jsonb)
  INTO invested_minor, value_minor, investments_json
  FROM public.player_investments i
  WHERE i.profile_id = pid;

  SELECT
    COALESCE(SUM(l.remaining_balance)::bigint * 100, 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'providerName', COALESCE(l.loan_name,'Lender'),
      'status', COALESCE(l.status,'active'),
      'principalMinor', COALESCE(l.principal,0)::bigint * 100,
      'outstandingMinor', COALESCE(l.remaining_balance,0)::bigint * 100,
      'currencyCode', currency,
      'interestRateBps', ROUND(COALESCE(l.interest_rate,0) * 100)::int,
      'scheduledPaymentMinor', COALESCE(l.weekly_payment,0)::bigint * 100,
      'nextPaymentDate', l.due_date,
      'maturityDate', l.due_date,
      'purpose', 'personal_loan'
    ) ORDER BY l.due_date NULLS LAST, l.id), '[]'::jsonb)
  INTO loans_minor, loans_json
  FROM public.player_loans l
  WHERE l.profile_id = pid AND COALESCE(l.status,'active') NOT IN ('paid_off','closed','cancelled');

  WITH tx AS (
    SELECT t.*,
      CASE WHEN t.amount_minor >= 0 THEN 'income' ELSE 'expense' END AS direction,
      COALESCE(t.tx_type,'transaction') AS category
    FROM public.bank_transactions t
    WHERE t.profile_id = pid AND COALESCE(t.currency_code,'GBP') = currency
  )
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'income' THEN ABS(amount_minor) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN direction = 'expense' THEN ABS(amount_minor) ELSE 0 END),0)
  INTO earnings_minor, expenses_minor
  FROM tx;

  WITH tx AS (
    SELECT t.id, t.created_at, t.amount_minor, t.description, t.currency_code, t.account_id, t.related_account_id, t.related_band_id,
      CASE WHEN t.amount_minor >= 0 THEN 'income' ELSE 'expense' END AS direction,
      COALESCE(t.tx_type,'transaction') AS category
    FROM public.bank_transactions t
    WHERE t.profile_id = pid AND COALESCE(t.currency_code,'GBP') = currency
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT row_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tx.id,
    'createdAt', tx.created_at,
    'direction', tx.direction,
    'source', initcap(replace(tx.category,'_',' ')),
    'amountMinor', ABS(tx.amount_minor),
    'description', tx.description,
    'currencyCode', COALESCE(tx.currency_code, currency),
    'category', tx.category,
    'sourceAccountId', CASE WHEN tx.direction = 'expense' THEN tx.account_id ELSE tx.related_account_id END,
    'destinationAccountId', CASE WHEN tx.direction = 'income' THEN tx.account_id ELSE tx.related_account_id END,
    'relatedEntityType', CASE WHEN tx.related_band_id IS NOT NULL THEN 'band' ELSE NULL END,
    'relatedEntityId', tx.related_band_id,
    'externalCashFlow', tx.category NOT IN ('transfer','deposit','withdrawal','internal_transfer')
  ) ORDER BY tx.created_at DESC, tx.id DESC), '[]'::jsonb)
  INTO transactions_json
  FROM tx;

  WITH months AS (
    SELECT generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m
  ), tx AS (
    SELECT t.created_at, t.amount_minor
    FROM public.bank_transactions t
    WHERE t.profile_id = pid AND COALESCE(t.currency_code,'GBP') = currency
  ), monthly AS (
    SELECT months.m,
      COALESCE(SUM(CASE WHEN tx.amount_minor >= 0 THEN tx.amount_minor ELSE 0 END),0)::bigint AS income_minor,
      COALESCE(SUM(CASE WHEN tx.amount_minor < 0 THEN ABS(tx.amount_minor) ELSE 0 END),0)::bigint AS expenses_minor
    FROM months LEFT JOIN tx ON date_trunc('month', tx.created_at) = months.m
    GROUP BY months.m
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'monthKey', to_char(m,'YYYY-MM'),
      'month', to_char(m,'Mon'),
      'incomeMinor', income_minor,
      'expensesMinor', expenses_minor,
      'currencyCode', currency
    ) ORDER BY m), '[]'::jsonb),
    COALESCE(ROUND(AVG(income_minor))::bigint,0),
    COALESCE(ROUND(AVG(expenses_minor))::bigint,0)
  INTO monthly_json, monthly_income, monthly_expenses
  FROM monthly;

  SELECT COALESCE(jsonb_object_agg(source, amount_minor), '{}'::jsonb)
  INTO earnings_json
  FROM (
    SELECT initcap(replace(COALESCE(t.tx_type,'transaction'),'_',' ')) AS source, SUM(t.amount_minor)::bigint AS amount_minor
    FROM public.bank_transactions t
    WHERE t.profile_id = pid AND COALESCE(t.currency_code,'GBP') = currency AND t.amount_minor > 0
    GROUP BY 1
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'currencyCode', g.currency_code,
    'balanceMinor', g.balance_minor,
    'availableBalanceMinor', g.balance_minor
  ) ORDER BY g.currency_code), '[]'::jsonb)
  INTO other_json
  FROM (
    SELECT COALESCE(a.currency_code,'GBP') AS currency_code, SUM(a.balance_minor)::bigint AS balance_minor
    FROM public.bank_accounts a
    WHERE a.profile_id = pid AND a.status = 'active' AND COALESCE(a.currency_code,'GBP') <> currency
    GROUP BY 1
  ) g;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'memberCount', (SELECT COUNT(*)::int FROM public.band_members m2 WHERE m2.band_id = b.id AND COALESCE(m2.member_status,'active') = 'active'),
    'treasuries', jsonb_build_array(jsonb_build_object(
      'accountId', b.id,
      'currencyCode', currency,
      'balanceMinor', COALESCE(b.band_balance,0)::bigint * 100,
      'availableBalanceMinor', COALESCE(b.band_balance,0)::bigint * 100
    ))
  ) ORDER BY b.name, b.id), '[]'::jsonb)
  INTO bands_json
  FROM public.band_members m
  JOIN public.bands b ON b.id = m.band_id
  WHERE m.profile_id = pid AND COALESCE(m.member_status,'active') = 'active';

  RETURN jsonb_build_object(
    'status','ok',
    'profileId', pid,
    'currencyCode', currency,
    'banking', banking,
    'summary', jsonb_build_object(
      'cashMinor', cash_minor,
      'personalAccountsMinor', accounts_minor,
      'totalInvestedMinor', invested_minor,
      'investmentValueMinor', value_minor,
      'totalLoansMinor', loans_minor,
      'netWorthMinor', accounts_minor + value_minor - loans_minor,
      'totalEarningsMinor', earnings_minor,
      'totalExpensesMinor', expenses_minor,
      'monthlyIncomeMinor', monthly_income,
      'monthlyExpensesMinor', monthly_expenses
    ),
    'transactions', transactions_json,
    'monthlyLedger', monthly_json,
    'earningsBySource', earnings_json,
    'investments', investments_json,
    'loans', loans_json,
    'bands', bands_json,
    'otherCurrencyBalances', other_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_finance_command_center(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_finance_command_center(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';