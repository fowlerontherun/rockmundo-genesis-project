-- Read-only live smoke tests; no payouts or balances are changed.
DO $check$
BEGIN
  IF public.calculate_band_income_tax(50000,10) <> 5000
     OR public.calculate_band_income_tax(250000,10) <> 35000
     OR public.calculate_band_income_tax(2000000,10) <> 385000 THEN
    RAISE EXCEPTION 'Band marginal-income-tax calculation failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.band_earnings'::regclass
      AND tgname='zz_withhold_band_income_tax' AND tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'Band income-tax withholding trigger not installed';
  END IF;
  IF pg_get_functiondef('public.settle_gig_finance_v2(uuid)'::regprocedure)
     LIKE '%UPDATE public.bands SET band_balance%' THEN
    RAISE EXCEPTION 'Gig settlement still double-credits the band balance';
  END IF;
  IF has_function_privilege('authenticated','public.withhold_band_earned_income_tax()','EXECUTE')
     OR has_function_privilege('anon','public.withhold_band_earned_income_tax()','EXECUTE') THEN
    RAISE EXCEPTION 'Client role can execute privileged band income-tax trigger';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='band_income_tax_receipts'
      AND policyname='Band finance can view income tax'
  ) THEN
    RAISE EXCEPTION 'Band tax receipts missing finance-role RLS';
  END IF;
END;
$check$;
