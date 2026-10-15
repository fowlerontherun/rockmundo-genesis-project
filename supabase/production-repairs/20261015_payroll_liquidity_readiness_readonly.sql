-- #4119 / #4082. READ-ONLY liquidity and ledger-authority readiness.
-- Intended for a trusted DBA in staging, then a redacted production gate.
-- No inserts, updates, locks, payroll RPCs, secrets or money movements.
-- A mismatch does NOT authorize compensating credits/backfill.
WITH bands_to_pay AS (
  SELECT id,band_balance::bigint displayed_major,weekly_pay_percent
  FROM public.bands
  WHERE status='active' AND COALESCE(weekly_pay_percent,0)>0
), reconciled AS (
  SELECT b.id,b.displayed_major,
    bt.count AS gameplay_treasury_count,
    bt.balance_minor AS gameplay_minor,
    bt.reserved_minor AS gameplay_reserved_minor,
    fa.count AS financial_treasury_count,
    fa.balance_minor AS financial_minor,
    fa.available_minor AS financial_available_minor,
    fa.currency AS financial_currency,
    bt.currency AS gameplay_currency,
    COALESCE(e.total_major,0) AS journal_major
  FROM bands_to_pay b
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer count,MAX(t.balance_minor) balance_minor,
      MAX(t.reserved_balance_minor) reserved_minor,
      MAX(t.currency_code) currency
    FROM public.band_treasuries t
    WHERE t.band_id=b.id AND t.is_primary IS TRUE
  ) bt ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer count,MAX(a.current_balance_minor) balance_minor,
      MAX(a.available_balance_minor) available_minor,
      MAX(a.default_currency_code) currency
    FROM public.financial_accounts a
    WHERE a.owner_type='band'
      AND a.owner_id=b.id
      AND a.account_status='active'
      AND a.metadata->>'account_role'='band_treasury'
  ) fa ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount)::bigint total_major
    FROM public.band_earnings e WHERE e.band_id=b.id
  ) e ON true
)
SELECT COUNT(*) AS pay_enabled_bands,
 COUNT(*) FILTER (WHERE gameplay_treasury_count<>1) AS gameplay_primary_not_unique,
 COUNT(*) FILTER (WHERE financial_treasury_count<>1) AS payroll_accounts_not_unique,
 COUNT(*) FILTER (WHERE gameplay_minor IS NULL OR gameplay_minor < 0
    OR gameplay_reserved_minor < 0 OR gameplay_reserved_minor > gameplay_minor)
    AS gameplay_invalid_or_over_reserved,
 COUNT(*) FILTER (WHERE financial_minor IS NULL OR financial_minor < 0
    OR financial_available_minor < 0 OR financial_available_minor > financial_minor)
    AS payroll_invalid_or_over_reserved,
 COUNT(*) FILTER (WHERE gameplay_minor IS NOT NULL
    AND (gameplay_minor / 100) <> displayed_major) AS game_display_treasury_drift,
 COUNT(*) FILTER (WHERE gameplay_minor IS DISTINCT FROM financial_minor
    OR gameplay_currency IS DISTINCT FROM financial_currency)
    AS third_ledger_not_reconciled,
 COUNT(*) FILTER (WHERE displayed_major <> journal_major)
    AS earnings_history_differs_from_spendable_balance
FROM reconciled;

-- A clean band/treasury display alone is NOT approval to enable payroll.
-- The finance/payroll account counts and third-ledger equality must also be
-- zero; historical earnings differences may represent legitimate bookings.
