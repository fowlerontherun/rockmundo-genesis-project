-- Static database contract checks for simplified Festival sponsorship budgeting.
DO $$
DECLARE
  v_budget text;
  v_sponsor text;
  v_settlement text;
  v_results text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_budget
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_festival_edition_budget_forecast'
  LIMIT 1;

  SELECT pg_get_functiondef(p.oid)
  INTO v_sponsor
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_festival_automatic_sponsorship_minor'
  LIMIT 1;

  SELECT pg_get_functiondef(p.oid)
  INTO v_settlement
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_complete_simplified_festival_settlement'
  LIMIT 1;

  SELECT pg_get_functiondef(p.oid)
  INTO v_results
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_festival_edition_results'
  LIMIT 1;

  IF v_budget IS NULL OR v_sponsor IS NULL OR v_settlement IS NULL OR v_results IS NULL THEN
    RAISE EXCEPTION 'simplified Festival sponsorship budget functions are incomplete';
  END IF;

  IF position('_festival_company_manager_authorized' IN v_budget) = 0 THEN
    RAISE EXCEPTION 'Festival budget forecast does not enforce manager authority';
  END IF;

  IF position('marketing_media' IN v_sponsor) = 0
     OR position('reputation_score' IN v_sponsor) = 0
     OR position('marketingDemandBasisPoints' IN v_sponsor) = 0 THEN
    RAISE EXCEPTION 'Festival sponsorship is not driven by canonical progression inputs';
  END IF;

  IF position(
    'actual_ticket_net+sponsorship+food+merch'
    IN regexp_replace(v_settlement, '\s+', '', 'g')
  ) = 0 THEN
    RAISE EXCEPTION 'Festival settlement does not include sponsorship revenue';
  END IF;

  IF position('sponsorshipRevenueMinor' IN v_results) = 0 THEN
    RAISE EXCEPTION 'Festival owner Results do not expose sponsorship revenue';
  END IF;

  IF has_function_privilege('authenticated', 'public._festival_automatic_sponsorship_minor(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute internal Festival sponsorship helper';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_festival_edition_budget_forecast(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role cannot execute Festival budget forecast';
  END IF;
END;
$$;
