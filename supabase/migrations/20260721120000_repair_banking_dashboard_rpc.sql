-- Repair Finance Phase 7 banking dashboard RPC after partially-applied or cache-stale deployments.
-- The original Phase 7.3/7.4/7.5 migrations all define public.get_banking_dashboard(),
-- but statements before those definitions can fail in partial environments. Keep this repair
-- migration forward-only and tolerant of optional Phase 7.5 savings structures.

DO $$
DECLARE
  has_core boolean;
BEGIN
  -- Remove obsolete overloads so PostgREST has one unambiguous zero-argument RPC target.
  -- There are no supported callers for parameterised dashboard overloads; the application
  -- calls supabase.rpc('get_banking_dashboard') without arguments.
  EXECUTE (
    SELECT COALESCE(string_agg(format('DROP FUNCTION IF EXISTS public.get_banking_dashboard(%s);', pg_get_function_identity_arguments(p.oid)), E'\n'), '')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_banking_dashboard'
      AND p.pronargs <> 0
  );

  SELECT bool_and(to_regclass(tbl) IS NOT NULL) INTO has_core
  FROM (VALUES
    ('public.profiles'),
    ('public.bank_accounts'),
    ('public.financial_accounts'),
    ('public.banking_providers'),
    ('public.loan_contracts'),
    ('public.loan_schedule_lines'),
    ('public.banking_customer_profiles')
  ) AS required(tbl);

  IF has_core THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.get_banking_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  pid uuid;
  result jsonb;
BEGIN
  SELECT id INTO pid FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF pid IS NULL THEN
    RETURN jsonb_build_object(
      'accounts', '[]'::jsonb,
      'loans', '[]'::jsonb,
      'creditProfile', jsonb_build_object('band', 'Building', 'positiveFactors', jsonb_build_array('Create a profile to start banking.'), 'negativeFactors', '[]'::jsonb),
      'recentActivity', '[]'::jsonb,
      'savingsSummary', jsonb_build_object('netWorthMinor', 0, 'cashMinor', 0, 'savingsMinor', 0, 'lockedDepositsMinor', 0, 'monthlyInterestMinor', 0, 'interestEarnedYtdMinor', 0, 'currencyCode', 'USD'),
      'cashFlowAnalytics', jsonb_build_object('incomeMinor', 0, 'expensesMinor', 0, 'savingsRateBps', 0, 'financialHealth', 'building', 'largestExpenseCategories', '[]'::jsonb),
      'savingsGoals', '[]'::jsonb,
      'notifications', '[]'::jsonb
    );
  END IF;

  SELECT jsonb_build_object(
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ba.id,
        'accountType', ba.account_type,
        'currencyCode', ba.currency_code,
        'balanceMinor', fa.current_balance_minor,
        'providerName', bp.brand_name,
        'restrictionSummary', CASE WHEN ba.status = 'restricted' THEN 'Restricted' ELSE 'Unrestricted' END,
        'annualRateBps', COALESCE((ba.interest_configuration->>'annual_rate_bps')::int, bp.base_deposit_rate_basis_points, 0)
      ) ORDER BY ba.created_at)
      FROM public.bank_accounts ba
      JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id
      JOIN public.banking_providers bp ON bp.id = ba.provider_id
      WHERE ba.owner_type = 'player' AND ba.owner_id = pid
    ), '[]'::jsonb),
    'loans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'providerName', bp.brand_name,
        'status', c.status,
        'principalMinor', c.principal_minor,
        'outstandingPrincipalMinor', c.outstanding_principal_minor,
        'currencyCode', c.currency_code,
        'interestRateBps', c.interest_rate_basis_points,
        'nextPaymentMinor', COALESCE(n.total_due_minor - n.amount_paid_minor, c.scheduled_payment_minor, 0),
        'nextPaymentDate', COALESCE(n.due_date, c.next_payment_date),
        'overdueMinor', COALESCE(o.overdue_minor, 0)
      ) ORDER BY COALESCE(n.due_date, c.next_payment_date) NULLS LAST, c.created_at)
      FROM public.loan_contracts c
      JOIN public.banking_providers bp ON bp.id = c.provider_id
      LEFT JOIN LATERAL (
        SELECT due_date, total_due_minor, amount_paid_minor
        FROM public.loan_schedule_lines l
        WHERE l.loan_contract_id = c.id AND l.status <> 'paid'
        ORDER BY l.due_date, l.instalment_number
        LIMIT 1
      ) n ON true
      LEFT JOIN LATERAL (
        SELECT sum(total_due_minor - amount_paid_minor) AS overdue_minor
        FROM public.loan_schedule_lines l
        WHERE l.loan_contract_id = c.id AND l.due_date < CURRENT_DATE AND l.status <> 'paid'
      ) o ON true
      WHERE c.borrower_type = 'player' AND c.borrower_id = pid AND c.status NOT IN ('cancelled', 'paid_off')
    ), '[]'::jsonb),
    'creditProfile', COALESCE((
      SELECT jsonb_build_object('band', credit_band, 'score', credit_score, 'positiveFactors', jsonb_build_array('On-time payments improve your band.'), 'negativeFactors', '[]'::jsonb)
      FROM public.banking_customer_profiles
      WHERE owner_type = 'player' AND owner_id = pid
    ), jsonb_build_object('band', 'Building', 'positiveFactors', jsonb_build_array('Open a current account to start building a banking history.'), 'negativeFactors', '[]'::jsonb)),
    'recentActivity', '[]'::jsonb,
    'savingsSummary', jsonb_build_object('netWorthMinor', COALESCE((SELECT sum(fa.current_balance_minor) FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id WHERE ba.owner_type = 'player' AND ba.owner_id = pid), 0), 'cashMinor', COALESCE((SELECT sum(fa.current_balance_minor) FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id WHERE ba.owner_type = 'player' AND ba.owner_id = pid AND ba.account_type = 'current'), 0), 'savingsMinor', COALESCE((SELECT sum(fa.current_balance_minor) FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id WHERE ba.owner_type = 'player' AND ba.owner_id = pid AND ba.account_type <> 'current'), 0), 'lockedDepositsMinor', 0, 'monthlyInterestMinor', 0, 'interestEarnedYtdMinor', 0, 'currencyCode', COALESCE((SELECT ba.currency_code FROM public.bank_accounts ba WHERE ba.owner_type = 'player' AND ba.owner_id = pid ORDER BY ba.created_at LIMIT 1), 'USD')),
    'cashFlowAnalytics', jsonb_build_object('incomeMinor', 0, 'expensesMinor', 0, 'savingsRateBps', 0, 'financialHealth', 'building', 'largestExpenseCategories', '[]'::jsonb),
    'savingsGoals', '[]'::jsonb,
    'notifications', '[]'::jsonb
  ) INTO result;

  RETURN result;
END
$body$;
$fn$;
  ELSE
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.get_banking_dashboard()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $body$
  SELECT jsonb_build_object('accounts', '[]'::jsonb, 'loans', '[]'::jsonb, 'creditProfile', jsonb_build_object('band', 'Building', 'positiveFactors', jsonb_build_array('Banking is being prepared.'), 'negativeFactors', '[]'::jsonb), 'recentActivity', '[]'::jsonb, 'savingsSummary', jsonb_build_object('netWorthMinor', 0, 'cashMinor', 0, 'savingsMinor', 0, 'lockedDepositsMinor', 0, 'monthlyInterestMinor', 0, 'interestEarnedYtdMinor', 0, 'currencyCode', 'USD'), 'cashFlowAnalytics', jsonb_build_object('incomeMinor', 0, 'expensesMinor', 0, 'savingsRateBps', 0, 'financialHealth', 'building', 'largestExpenseCategories', '[]'::jsonb), 'savingsGoals', '[]'::jsonb, 'notifications', '[]'::jsonb)
$body$;
$fn$;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_banking_dashboard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_banking_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_banking_dashboard() TO authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_banking_dashboard' AND p.pronargs = 0) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one public.get_banking_dashboard() zero-argument function';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
