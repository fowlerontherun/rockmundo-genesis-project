\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE body text; k text;
BEGIN
  IF to_regprocedure('public._festival_settlement_identity(uuid)') IS NULL THEN
    RAISE EXCEPTION 'canonical lifecycle resolver missing';
  END IF;
  body:=pg_get_functiondef('public._festival_settlement_identity(uuid)'::regprocedure);
  FOREACH k IN ARRAY ARRAY['runtimeSessionId','launchId','publicEditionId','festivalId',
    'festivalCompanyId','companyId','cityId','countryId'] LOOP
    IF position(quote_literal(k) in body)=0 THEN RAISE EXCEPTION 'identity key missing: %',k; END IF;
  END LOOP;

  body:=pg_get_functiondef('public._build_festival_contract_package(uuid)'::regprocedure);
  IF position('runtime_session_id=p_runtime_session_id' in body)=0
     OR position('festival_company_id=fc' in body)=0 THEN
    RAISE EXCEPTION 'contract package is not runtime and festival isolated';
  END IF;

  body:=pg_get_functiondef('public.decide_festival_overtime(uuid,integer,text,uuid)'::regprocedure);
  IF position('actual-contracted' in body)=0 OR position('req.requested_minutes' in body)=0 THEN
    RAISE EXCEPTION 'overtime evidence inequality missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='festival_staff_overtime_state_check'
    AND pg_get_constraintdef(oid) LIKE '%requested%approved%rejected%superseded%') THEN
    RAISE EXCEPTION 'overtime state machine missing';
  END IF;

  FOREACH k IN ARRAY ARRAY['create_festival_shift_evidence_decision(uuid,integer,text,uuid)',
    'supersede_festival_shift_evidence_decision(uuid,integer,text,uuid)',
    'get_festival_shift_evidence_history(uuid)'] LOOP
    IF to_regprocedure('public.'||k) IS NULL THEN RAISE EXCEPTION 'shift evidence RPC missing: %',k; END IF;
  END LOOP;

  body:=pg_get_functiondef('public._populate_festival_payable_components(uuid)'::regprocedure);
  FOREACH k IN ARRAY ARRAY['contracted_regular_pay','approved_overtime','lateness_deduction',
   'appearance_guarantee','revenue_share','cancellation_payment','deposit','quality','sla_breach',
   'fixed_fee','exposure_target','category_conflict','sponsor_refund'] LOOP
    IF position(quote_literal(k) in body)=0 THEN RAISE EXCEPTION 'payable component missing: %',k; END IF;
  END LOOP;

  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='festival_settlement_status_v2'
    AND pg_get_constraintdef(oid) LIKE '%processing%' AND pg_get_constraintdef(oid) NOT LIKE '%settling%') THEN
    RAISE EXCEPTION 'canonical settlement status constraint missing';
  END IF;
  IF to_regclass('public.festival_settlement_processing_requests') IS NULL THEN
    RAISE EXCEPTION 'durable processing request store missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_line_prepared_immutable' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'prepared line immutability missing';
  END IF;
END $$;

ROLLBACK;
