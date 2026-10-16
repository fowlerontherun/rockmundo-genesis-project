-- Issue #4072 / #4119 / #4082: reversible, non-settling finance safety protections.
-- This does NOT install payroll/sponsorship settlement, alter cash or activate cron.
DO $preflight$
BEGIN
  IF to_regclass('public.band_earnings') IS NULL
    OR to_regprocedure('public.update_band_balance_from_earnings()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.update_band_balance_from_earnings()'::regprocedure AND p.prorettype='trigger'::regtype)
  THEN
    RAISE EXCEPTION 'band_earnings_guard_schema_drift';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.band_earnings e
    WHERE e.source='sponsorship' AND e.metadata->>'payment_id' IS NOT NULL
    GROUP BY e.metadata->>'payment_id' HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'sponsorship_payment_duplicates_require_manual_reconciliation';
  END IF;
END;
$preflight$;
CREATE UNIQUE INDEX IF NOT EXISTS band_earnings_sponsorship_payment_once
  ON public.band_earnings ((metadata->>'payment_id'))
  WHERE source='sponsorship' AND metadata->>'payment_id' IS NOT NULL;
-- A trigger function is internal and must not be directly exposed as a privileged RPC.
-- PostgreSQL executes existing triggers independently of these direct EXECUTE grants.
REVOKE ALL ON FUNCTION public.update_band_balance_from_earnings()
  FROM PUBLIC, anon, authenticated, service_role;