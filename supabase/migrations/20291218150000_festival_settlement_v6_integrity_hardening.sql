-- Festival settlement v6.1 integrity hardening (forward-only).
-- This migration repairs receipts produced by the former placeholder effect worker
-- and makes semantic provenance and durable request leases database invariants.

UPDATE public.festival_settlement_finalisation_requests q
SET expected_version = s.version
FROM public.festival_financial_settlements s
WHERE s.id = q.settlement_id AND q.expected_version IS NULL;

ALTER TABLE public.festival_settlement_finalisation_requests
  ALTER COLUMN expected_version SET NOT NULL;

UPDATE public.festival_settlement_finalisation_requests
SET lease_owner=NULL, lease_expires_at=NULL
WHERE status <> 'processing';

ALTER TABLE public.festival_settlement_finalisation_requests
  DROP CONSTRAINT IF EXISTS festival_finalisation_request_lease_coherent;
ALTER TABLE public.festival_settlement_finalisation_requests
  ADD CONSTRAINT festival_finalisation_request_lease_coherent CHECK (
    (status = 'processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL AND started_at IS NOT NULL)
    OR (status <> 'processing' AND lease_owner IS NULL AND lease_expires_at IS NULL)
  ) NOT VALID;

-- A historical receipt is not proof of an effect.  Only a destination whose
-- identity and evidence digest agree with the receipt is accepted.  Preserve a
-- machine-readable audit marker before making the effect retryable.
UPDATE public.festival_settlement_effect_receipts r
SET status = 'pending',
    completed_at = NULL,
    destination_table = NULL,
    destination_record_id = NULL,
    last_error = jsonb_build_object(
      'repair', 'festival-effect-destination-verification-v6.1',
      'previousStatus', r.status,
      'previousDestinationTable', r.destination_table,
      'previousDestinationRecordId', r.destination_record_id,
      'repairedAt', statement_timestamp()
    )::text
WHERE r.status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.festival_settlement_effect_destinations d
    WHERE d.receipt_id = r.id
      AND d.id = r.destination_record_id
      AND r.destination_table = 'festival_settlement_effect_destinations'
      AND d.evidence_digest = r.evidence_digest
      AND d.destination_kind = r.effect_type
  );

-- Remove destinations that cannot possibly verify their receipt. They are
-- placeholder artefacts, not permanent Festival outcomes.
DELETE FROM public.festival_settlement_effect_destinations d
USING public.festival_settlement_effect_receipts r
WHERE r.id = d.receipt_id
  AND (d.evidence_digest IS DISTINCT FROM r.evidence_digest
       OR d.destination_kind IS DISTINCT FROM r.effect_type);

CREATE OR REPLACE FUNCTION public._festival_native_component_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE evidence_count integer;
BEGIN
 evidence_count := CASE WHEN jsonb_typeof(NEW.source_evidence_ids) = 'array'
   THEN jsonb_array_length(NEW.source_evidence_ids) ELSE 0 END;
 IF NEW.component_type IN ('source_balance','source_amount_adjustment') THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_balance_plug_component_forbidden';
 END IF;
 IF NEW.component_type='minimum_adjustment' AND NOT (
      coalesce(NEW.contract_clause_id,NEW.source_rule) IS NOT NULL
      AND evidence_count > 0
      AND NEW.input_values ? 'contractualMinimumMinor') THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_minimum_requires_frozen_contract_clause';
 END IF;
 IF NEW.component_type='authorised_manual_adjustment' AND NOT (
      evidence_count > 0
      AND NEW.input_values ? 'authorisationRecordId'
      AND NEW.eligibility_result @> '{"authorised":true}'::jsonb) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_manual_adjustment_requires_immutable_authorisation';
 END IF;
 IF NEW.component_type='royalty_rounding_adjustment' AND NOT (
      abs(NEW.amount_minor) <= 1
      AND NEW.source_rule = 'bounded_currency_rounding'
      AND evidence_count > 0
      AND NEW.input_values ? 'unroundedAmount') THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_royalty_rounding_requires_bounded_evidence';
 END IF;
 IF NEW.formula_type IS NULL OR NEW.formula_version IS NULL
    OR coalesce(NEW.contract_clause_id,NEW.source_rule) IS NULL
    OR evidence_count = 0 OR NEW.input_values='{}'::jsonb
    OR NEW.eligibility_result='{}'::jsonb OR NEW.currency_code IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_semantic_component_provenance_incomplete';
 END IF;
 RETURN NEW;
END $$;

-- Validate every line at the transaction boundary.  This applies to native
-- preparation and to all future Festival line producers, so no renamed plug can
-- bypass the public RPC's local validation.
CREATE OR REPLACE FUNCTION public._festival_component_total_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target uuid; expected bigint; actual bigint;
BEGIN
 target := coalesce(NEW.settlement_line_id, OLD.settlement_line_id);
 SELECT net_amount_minor INTO expected FROM public.festival_settlement_lines WHERE id=target;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(sum(CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END),0)
 INTO actual FROM public.festival_settlement_line_components WHERE settlement_line_id=target;
 IF expected IS DISTINCT FROM actual THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_settlement_component_sum_mismatch',
     DETAIL=format('line=%s expected=%s actual=%s',target,expected,actual);
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS festival_component_total_guard ON public.festival_settlement_line_components;
CREATE CONSTRAINT TRIGGER festival_component_total_guard
 AFTER INSERT OR UPDATE OR DELETE ON public.festival_settlement_line_components
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION public._festival_component_total_guard();

REVOKE ALL ON FUNCTION public._festival_native_component_guard(),
 public._festival_component_total_guard() FROM PUBLIC,anon,authenticated;
