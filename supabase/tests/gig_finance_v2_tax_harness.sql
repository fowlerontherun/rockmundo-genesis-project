-- Non-mutating production-safe contract test for the v2 gig finance repair.
DO $test$
BEGIN
  IF to_regclass('public.gig_financial_settlements') IS NULL THEN
    RAISE EXCEPTION 'gig finance receipt table is missing';
  END IF;
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.gig_financial_settlements'::regclass AND contype='p') <> 1 THEN
    RAISE EXCEPTION 'gig settlement must be unique per gig';
  END IF;
  IF has_function_privilege('authenticated','public.settle_gig_finance_v2(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'client role must not directly settle gig finances';
  END IF;
  IF NOT has_function_privilege('service_role','public.settle_gig_finance_v2(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'service worker cannot settle gig finances';
  END IF;
  IF public.calculate_gig_city_tax_v2(1000,10) <> 100
    OR public.calculate_gig_city_tax_v2(250000,10) <> 35000
    OR public.calculate_gig_city_tax_v2(1032020,10) <> 191404
    OR public.calculate_gig_city_tax_v2(-500,10) <> 0 THEN
    RAISE EXCEPTION 'gig income tax brackets do not calculate correctly';
  END IF;
END;
$test$;
