-- PR B4 follow-up: make settlement replay-safe against the indexes and ledger
-- rows written by the settlement itself.

-- PostgreSQL cannot infer a partial unique index from ON CONFLICT(columns)
-- without repeating its predicate. Keep the earlier partial indexes for older
-- query plans and add full nullable uniques so the canonical settlement UPSERTs
-- have an exact arbiter. NULL idempotency keys remain unconstrained by normal
-- PostgreSQL unique-index semantics.
CREATE UNIQUE INDEX IF NOT EXISTS festival_settlement_events_idempotency_full_idx
  ON public.festival_settlement_events(settlement_id,idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS festival_ledger_idempotency_full_idx
  ON public.festival_expense_ledger(edition_id,idempotency_key);

-- A completed settlement has added its own finance/ledger rows, so calling the
-- preparation function again would legitimately produce a different input hash.
-- Resolve an existing request before recomputing the original settlement input.
CREATE OR REPLACE FUNCTION public.settle_festival_edition(
  p_edition_id uuid,
  p_expected_readiness_hash text,
  p_idempotency_key text,
  p_admin_override_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  prepare_key text;
BEGIN
  IF NULLIF(btrim(p_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Settlement idempotency key required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.festival_editions e
    WHERE e.id=p_edition_id AND public.can_manage_festival_brand(e.festival_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to settle edition';
  END IF;

  prepare_key:=p_idempotency_key||':prepare';
  SELECT * INTO s
  FROM public.festival_edition_settlements
  WHERE edition_id=p_edition_id AND idempotency_key=prepare_key
  ORDER BY settlement_version DESC
  LIMIT 1
  FOR UPDATE;

  IF s.id IS NULL THEN
    s:=public.prepare_festival_edition_settlement(
      p_edition_id,p_expected_readiness_hash,prepare_key,p_admin_override_reason
    );
  END IF;

  IF s.status<>'completed' THEN
    s:=public.apply_festival_settlement_batch(s.id,p_idempotency_key||':apply');
  END IF;

  RETURN jsonb_build_object(
    'settlement',to_jsonb(s),
    'reconciliation',public.reconcile_festival_edition_settlement(s.id)
  );
END $$;

-- Do not dereference NEW on DELETE. Settlement source evidence becomes frozen as
-- soon as an edition has a current locked/completed settlement.
CREATE OR REPLACE FUNCTION public.prevent_festival_settlement_outcome_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=''
AS $$
DECLARE
  outcome uuid;
  edition uuid;
BEGIN
  outcome:=CASE WHEN TG_OP='DELETE' THEN OLD.outcome_id ELSE NEW.outcome_id END;
  SELECT o.edition_id INTO edition FROM public.festival_performance_outcomes o WHERE o.id=outcome;
  IF public.festival_current_settlement_blocks_mutation(edition) THEN
    RAISE EXCEPTION 'Settlement source inputs are locked for edition %',edition;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

-- A recognised finalised effect must not disappear into a blocked application.
-- This extends the reconciliation contract beyond row-count equality.
CREATE OR REPLACE FUNCTION public.reconcile_festival_edition_settlement(p_settlement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  discrepancies jsonb:='[]'::jsonb;
  expected integer;
  actual integer;
  expected_money bigint;
  actual_money bigint;
BEGIN
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id;

  SELECT count(*) INTO expected
  FROM public.festival_performance_effects fx
  JOIN public.festival_performance_outcomes o ON o.id=fx.outcome_id
  WHERE o.edition_id=s.edition_id;
  SELECT count(*) INTO actual FROM public.festival_effect_applications WHERE settlement_id=s.id;
  IF expected<>actual THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','effect_application_count_mismatch','expected',expected,'actual',actual,'blocking',true));
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.festival_effect_applications
    WHERE settlement_id=s.id AND application_status IN ('applied','adjusted') AND after_value IS NULL
  ) THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','career_projection_missing_after_state','blocking',true));
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.festival_effect_applications a
    JOIN public.festival_performance_outcomes o ON o.id=a.source_outcome_id
    WHERE a.settlement_id=s.id AND o.status='finalised'
      AND a.effect_type IN ('band_fame','festival_reputation','streaming_uplift')
      AND a.application_status NOT IN ('applied','adjusted')
  ) THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','recognised_career_effect_not_applied','blocking',true));
  END IF;

  SELECT count(*) INTO expected
  FROM public.festival_fan_conversion_outcomes f
  JOIN public.festival_performance_outcomes o ON o.id=f.outcome_id
  WHERE o.edition_id=s.edition_id AND o.status='finalised';
  SELECT count(*) INTO actual
  FROM public.festival_fan_conversion_applications
  WHERE settlement_id=s.id AND status='applied' AND after_state IS NOT NULL;
  IF expected<>actual THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','fan_application_count_mismatch','expected',expected,'actual',actual,'blocking',true));
  END IF;

  SELECT count(*) INTO expected FROM public.festival_contracts WHERE edition_id=s.edition_id;
  SELECT count(*) INTO actual
  FROM public.festival_contract_settlement_instructions
  WHERE settlement_id=s.id AND status='applied';
  IF expected<>actual THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','contract_instruction_count_mismatch','expected',expected,'actual',actual,'blocking',true));
  END IF;

  SELECT count(*) INTO expected
  FROM public.festival_contract_settlement_instructions
  WHERE settlement_id=s.id AND (artist_payout_cents>0 OR deposit_refund_cents>0);
  SELECT count(DISTINCT contract_id) INTO actual
  FROM public.festival_settlement_transactions
  WHERE settlement_id=s.id AND status='applied';
  IF expected<>actual THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','contract_finance_transaction_count_mismatch','expected_contracts',expected,
      'actual_contracts',actual,'blocking',true));
  END IF;

  SELECT COALESCE(sum(artist_payout_cents),0)+COALESCE(sum(deposit_refund_cents),0)
  INTO expected_money
  FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id;
  SELECT COALESCE(sum(net_amount_cents),0) INTO actual_money
  FROM public.festival_settlement_transactions WHERE settlement_id=s.id AND status='applied';
  IF expected_money<>actual_money THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','settlement_money_mismatch','expected_cents',expected_money,'actual_cents',actual_money,'blocking',true));
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.festival_settlement_transactions st
    LEFT JOIN public.financial_transactions ft
      ON ft.id=st.external_transaction_id AND ft.status='completed'
    WHERE st.settlement_id=s.id AND st.status='applied' AND ft.id IS NULL
  ) THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object(
      'code','finance_journal_receipt_missing','blocking',true));
  END IF;

  RETURN jsonb_build_object(
    'settlement_id',s.id,'edition_id',s.edition_id,
    'reconciled',jsonb_array_length(discrepancies)=0,
    'discrepancies',discrepancies,
    'totals',jsonb_build_object(
      'artist_payout_cents',(SELECT COALESCE(sum(artist_payout_cents),0)
        FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id),
      'deposit_refund_cents',(SELECT COALESCE(sum(deposit_refund_cents),0)
        FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id),
      'merch_share_cents',(SELECT COALESCE(sum(merch_share_cents),0)
        FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id)
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.settle_festival_edition(uuid,text,text,text),
  public.reconcile_festival_edition_settlement(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_festival_edition(uuid,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_festival_edition_settlement(uuid) TO service_role;
