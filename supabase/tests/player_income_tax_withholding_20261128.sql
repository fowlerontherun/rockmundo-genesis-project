-- Read-only live smoke tests for the personal-income withholding policy.
-- No player balances, payments, tax receipts, or city treasury rows are changed.
DO $check$
BEGIN
  IF public.calculate_player_income_tax_minor(1000000,10) <> 100000 THEN
    RAISE EXCEPTION 'First monthly income-tax bracket failed';
  END IF;
  IF public.calculate_player_income_tax_minor(5000000,10) <> 700000 THEN
    RAISE EXCEPTION 'Second monthly income-tax bracket failed';
  END IF;
  IF public.calculate_player_income_tax_minor(10000000,10) <> 1700000 THEN
    RAISE EXCEPTION 'Top monthly income-tax bracket failed';
  END IF;
  IF public.calculate_player_income_tax_minor(10000000,25) <> 3200000 THEN
    RAISE EXCEPTION 'Higher base city income-tax rate failed';
  END IF;
  IF public.calculate_player_income_tax_minor(0,10) <> 0 THEN
    RAISE EXCEPTION 'Zero gross should have zero income tax';
  END IF;
  IF has_function_privilege('authenticated',
      'public.withhold_player_income_tax(uuid,bigint,text,text,uuid)','EXECUTE')
     OR has_function_privilege('anon',
      'public.withhold_player_income_tax(uuid,bigint,text,text,uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role',
      'public.withhold_player_income_tax(uuid,bigint,text,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Withholding helper must not be client callable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='player_income_tax_receipts'
                 AND policyname='Players view own income tax') THEN
    RAISE EXCEPTION 'Income tax receipts missing owner-only RLS';
  END IF;
END;
$check$;
