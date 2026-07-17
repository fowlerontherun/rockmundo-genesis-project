\i supabase/migrations/20260717090000_finance_phase1_ledger.sql
\i supabase/migrations/20260717120000_finance_phase2_player_band_management.sql
\i supabase/migrations/20260717153000_finance_phase3_company_operations.sql
\i supabase/migrations/20260717170000_finance_phase4_city_economies.sql

DO $$
DECLARE city_a uuid; city_b uuid; company_id uuid; quote_a jsonb; quote_b jsonb; tx uuid; award uuid; snap uuid;
BEGIN
  SELECT id INTO city_a FROM public.cities ORDER BY population NULLS LAST LIMIT 1;
  SELECT id INTO city_b FROM public.cities WHERE id <> city_a ORDER BY population DESC NULLS LAST LIMIT 1;
  IF city_a IS NULL OR city_b IS NULL THEN RAISE EXCEPTION 'expected at least two cities'; END IF;
  IF EXISTS (SELECT 1 FROM public.city_economy_integrity_issues WHERE issue_type IN ('missing_economic_profile','missing_treasury_account','invalid_index_values')) THEN RAISE EXCEPTION 'city economy integrity issues exist'; END IF;

  quote_a := public.city_price_quote(city_a, 10000, 'commercial_rent');
  quote_b := public.city_price_quote(city_b, 10000, 'commercial_rent');
  IF (quote_a->>'finalAmountMinor')::bigint < 0 OR (quote_b->>'finalAmountMinor')::bigint < 0 THEN RAISE EXCEPTION 'negative city price quote'; END IF;

  INSERT INTO public.companies(name, owner_id, company_type, headquarters_city_id, operating_tier) SELECT 'Phase 4 Harness Company', id, 'venue', city_a, 'micro' FROM public.profiles LIMIT 1 RETURNING id INTO company_id;
  IF company_id IS NOT NULL THEN
    PERFORM public.finance_credit_owner('company', company_id, 100000, 'owner_investment', 'Harness company float', 'phase4-company-float-' || company_id);
    tx := public.city_collect_business_licence_fee(company_id, 'phase4-licence-' || company_id);
    IF NOT EXISTS (SELECT 1 FROM public.financial_transactions WHERE id=tx AND transaction_category='city_business_licence_fee') THEN RAISE EXCEPTION 'licence transaction missing'; END IF;
  END IF;

  INSERT INTO public.city_grant_programmes(city_id,name,grant_type,available_budget_minor,award_amount_minor,recipient_type,status) VALUES(city_a,'Harness Music Grant','local_artist_support',50000,10000,'company','open') RETURNING id INTO award;
  snap := public.generate_city_economic_snapshot(city_a, CURRENT_DATE - 7, CURRENT_DATE);
  IF snap IS NULL THEN RAISE EXCEPTION 'snapshot not generated'; END IF;
END $$;
