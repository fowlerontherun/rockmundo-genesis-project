-- Correct the v2 foundation's default-based provenance and make v2 preparation
-- evidence-bound. Existing final snapshots and receipts are deliberately untouched.
ALTER TABLE public.festival_financial_settlements
  ADD COLUMN prepared_at timestamptz;

-- Every settlement present at this forward-only boundary was prepared by the v1
-- function. The presence of columns added in 20291218030000 is not v2 evidence.
UPDATE public.festival_financial_settlements
SET runtime_schema_version = CASE
      WHEN EXISTS (SELECT 1 FROM public.festival_runtime_outcome_snapshots o
                   WHERE o.runtime_session_id=festival_financial_settlements.runtime_session_id
                     AND o.snapshot->>'schemaVersion'='festival-runtime-outcome-v2')
        THEN 'festival-runtime-outcome-v2'
      ELSE 'festival-runtime-outcome-v1'
    END,
    settlement_formula_version='festival-settlement-v1',
    formula_version='festival-settlement-v1',
    tax_rule_version=coalesce((SELECT o.formula_versions->>'tax'
                               FROM public.festival_runtime_outcome_snapshots o
                               WHERE o.runtime_session_id=festival_financial_settlements.runtime_session_id),
                              'festival-tax-v1'),
    prepared_at=created_at;

-- Defaults are conservative. Only the executable v2 preparation function may
-- label evidence as v2.
ALTER TABLE public.festival_financial_settlements
  ALTER COLUMN runtime_schema_version SET DEFAULT 'festival-runtime-outcome-v1',
  ALTER COLUMN settlement_formula_version SET DEFAULT 'festival-settlement-v1';

ALTER FUNCTION public.prepare_festival_settlement(uuid,integer,uuid)
  RENAME TO _prepare_festival_settlement_v1;

CREATE FUNCTION public.prepare_festival_settlement(
  p_runtime_session_id uuid,
  p_expected_runtime_version integer,
  p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  outcome public.festival_runtime_outcome_snapshots%ROWTYPE;
  settlement public.festival_financial_settlements%ROWTYPE;
  result jsonb;
  contracts_digest text;
  calculation_digest text;
BEGIN
  -- Serialise preparation with finalisation and settlement processing.
  SELECT * INTO outcome
  FROM public.festival_runtime_outcome_snapshots
  WHERE runtime_session_id=p_runtime_session_id
  FOR SHARE;
  IF outcome.id IS NULL THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;
  PERFORM public.assert_festival_runtime_outcome_v2(outcome.snapshot);
  IF outcome.content_digest IS DISTINCT FROM encode(digest(outcome.snapshot::text,'sha256'),'hex')
  THEN RAISE EXCEPTION 'festival_settlement_snapshot_digest_invalid'; END IF;

  SELECT * INTO settlement FROM public.festival_financial_settlements
  WHERE runtime_session_id=p_runtime_session_id FOR UPDATE;
  IF settlement.id IS NOT NULL THEN
    IF settlement.runtime_snapshot_digest IS DISTINCT FROM outcome.content_digest
       OR settlement.runtime_schema_version<>'festival-runtime-outcome-v2'
       OR settlement.settlement_formula_version<>'festival-settlement-v2'
    THEN RAISE EXCEPTION 'festival_settlement_idempotency_conflict'; END IF;
    RETURN public._festival_settlement_json(settlement);
  END IF;

  -- The v1 implementation builds from accepted booking/assignment/contract
  -- snapshots and remains the line generator while v2 binds and fingerprints it.
  result:=public._prepare_festival_settlement_v1(
    p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
  SELECT * INTO settlement FROM public.festival_financial_settlements
  WHERE runtime_session_id=p_runtime_session_id FOR UPDATE;

  SELECT encode(digest(coalesce(jsonb_agg(e ORDER BY kind,id)::text,'[]'),'sha256'),'hex')
  INTO contracts_digest FROM (
    SELECT 'line-evidence' kind,l.id,
           jsonb_build_object('sourceType',l.source_type,'sourceId',l.source_id,
             'formula',l.formula_version,'evidence',l.calculation_metadata) e
    FROM public.festival_settlement_lines l WHERE l.settlement_id=settlement.id
  ) immutable_contract_evidence;
  SELECT encode(digest(coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.priority,l.id)::text,'[]'),'sha256'),'hex')
  INTO calculation_digest FROM public.festival_settlement_lines l
  WHERE l.settlement_id=settlement.id;

  UPDATE public.festival_financial_settlements SET
    runtime_schema_version='festival-runtime-outcome-v2',
    settlement_formula_version='festival-settlement-v2',
    formula_version='festival-settlement-v2', tax_rule_version='festival-tax-v1',
    payment_priority_version='festival-priority-v1',
    runtime_snapshot_digest=outcome.content_digest,
    contract_snapshot_digest=contracts_digest,
    calculation_digest=calculation_digest, prepared_at=now()
  WHERE id=settlement.id RETURNING * INTO settlement;
  UPDATE public.festival_settlement_lines SET formula_version='festival-settlement-v2'
  WHERE settlement_id=settlement.id;
  RETURN public._festival_settlement_json(settlement);
END $$;

REVOKE ALL ON FUNCTION public._prepare_festival_settlement_v1(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) TO authenticated;

COMMENT ON COLUMN public.festival_financial_settlements.prepared_at IS
  'Preparation boundary timestamp; created_at is retained as historical evidence and column presence never implies v2.';
COMMENT ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) IS
  'Validates and locks runtime-outcome-v2, verifies its digest, generates immutable lines once, and binds v2 provenance digests.';
