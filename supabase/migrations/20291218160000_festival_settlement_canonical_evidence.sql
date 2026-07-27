-- Festival settlement v6.2: canonical evidence and exact plan identities.
-- Forward-only.  In particular, this migration does not rewrite the historical
-- migrations which originally produced incomplete component provenance.

-- A plan can be applicable with an exact identity, or explicitly inapplicable.
-- NULL is never treated as evidence that a plan is optional.
ALTER TABLE public.festival_runtime_sessions
  ADD COLUMN artist_programme_id uuid REFERENCES public.festival_artist_programmes(id),
  ADD COLUMN artist_programme_state text NOT NULL DEFAULT 'unresolved'
    CHECK (artist_programme_state IN ('exact','not_applicable','unresolved')),
  ADD COLUMN operations_plan_id uuid REFERENCES public.festival_operations_plans(id),
  ADD COLUMN operations_plan_state text NOT NULL DEFAULT 'unresolved'
    CHECK (operations_plan_state IN ('exact','not_applicable','unresolved')),
  ADD COLUMN sponsorship_plan_id uuid REFERENCES public.festival_sponsorship_plans(id),
  ADD COLUMN sponsorship_plan_state text NOT NULL DEFAULT 'unresolved'
    CHECK (sponsorship_plan_state IN ('exact','not_applicable','unresolved')),
  ADD COLUMN ticket_plan_id uuid REFERENCES public.festival_ticket_plans(id),
  ADD COLUMN ticket_plan_state text NOT NULL DEFAULT 'unresolved'
    CHECK (ticket_plan_state IN ('exact','not_applicable','unresolved')),
  ADD CONSTRAINT festival_runtime_artist_plan_state CHECK
    ((artist_programme_state='exact')=(artist_programme_id IS NOT NULL)),
  ADD CONSTRAINT festival_runtime_operations_plan_state CHECK
    ((operations_plan_state='exact')=(operations_plan_id IS NOT NULL)),
  ADD CONSTRAINT festival_runtime_sponsorship_plan_state CHECK
    ((sponsorship_plan_state='exact')=(sponsorship_plan_id IS NOT NULL)),
  ADD CONSTRAINT festival_runtime_ticket_plan_state CHECK
    ((ticket_plan_state='exact')=(ticket_plan_id IS NOT NULL));

-- Backfill only a single candidate.  Zero and multiple candidates deliberately
-- remain unresolved for an owner/admin repair; optionality is never guessed.
WITH candidates AS (
 SELECT r.id,array_agg(DISTINCT b.festival_artist_programme_id) ids
 FROM public.festival_runtime_sessions r
 JOIN public.festival_runtime_performances p ON p.runtime_session_id=r.id
 JOIN public.festival_artist_bookings b ON b.id=p.artist_booking_id GROUP BY r.id)
UPDATE public.festival_runtime_sessions r SET artist_programme_id=c.ids[1],artist_programme_state='exact'
FROM candidates c WHERE c.id=r.id AND cardinality(c.ids)=1;
WITH candidates AS (
 SELECT r.id,array_agg(DISTINCT s.festival_operations_plan_id) ids
 FROM public.festival_runtime_sessions r
 JOIN public.festival_runtime_staff_checkins c ON c.runtime_session_id=r.id
 JOIN public.festival_staff_shifts s ON s.id=c.staff_shift_id GROUP BY r.id)
UPDATE public.festival_runtime_sessions r SET operations_plan_id=c.ids[1],operations_plan_state='exact'
FROM candidates c WHERE c.id=r.id AND cardinality(c.ids)=1;
WITH candidates AS (
 SELECT r.id,array_agg(DISTINCT c.festival_sponsorship_plan_id) ids
 FROM public.festival_runtime_sessions r
 JOIN public.festival_runtime_sponsor_activations a ON a.runtime_session_id=r.id
 JOIN public.festival_sponsor_deliverables d ON d.id=a.contract_deliverable_id
 JOIN public.festival_sponsor_contracts c ON c.id=d.sponsor_contract_id GROUP BY r.id)
UPDATE public.festival_runtime_sessions r SET sponsorship_plan_id=c.ids[1],sponsorship_plan_state='exact'
FROM candidates c WHERE c.id=r.id AND cardinality(c.ids)=1;
WITH candidates AS (
 SELECT r.id,array_agg(DISTINCT p.festival_ticket_plan_id) ids
 FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_public_ticket_products x ON x.festival_launch_id=l.id
 JOIN public.festival_ticket_products p ON p.id=x.source_ticket_product_id GROUP BY r.id)
UPDATE public.festival_runtime_sessions r SET ticket_plan_id=c.ids[1],ticket_plan_state='exact'
FROM candidates c WHERE c.id=r.id AND cardinality(c.ids)=1;

CREATE TABLE public.festival_settlement_repair_diagnostics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_id uuid REFERENCES public.festival_financial_settlements(id),
 runtime_session_id uuid REFERENCES public.festival_runtime_sessions(id),
 diagnostic_type text NOT NULL,
 classification text NOT NULL CHECK(classification IN('verifiably_semantic','repairable','unverifiable')),
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.festival_settlement_repair_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_settlement_repair_diagnostics FROM PUBLIC,anon,authenticated;

-- Provenance formerly filled by the v6 trigger is not trusted merely because it
-- is syntactically populated. Preserve an audit and place affected calculated
-- settlements in review. Payment/finalisation already require a settled state.
INSERT INTO public.festival_settlement_repair_diagnostics
 (settlement_id,runtime_session_id,diagnostic_type,classification,details)
SELECT DISTINCT l.settlement_id,s.runtime_session_id,'manufactured_component_provenance','unverifiable',
 jsonb_build_object('componentId',c.id,'lineId',l.id,'repairInstruction',
  'Rebuild the component from immutable Festival source records, then re-prepare the settlement.')
FROM public.festival_settlement_line_components c
JOIN public.festival_settlement_lines l ON l.id=c.settlement_line_id
JOIN public.festival_financial_settlements s ON s.id=l.settlement_id
WHERE c.eligibility_result->>'reason'='frozen_source_rule'
   OR c.source_rule=l.source_type||':'||c.component_type
   OR c.input_values ? 'frozenEvidence';
UPDATE public.festival_financial_settlements s SET status='settlement_review',updated_at=now()
WHERE EXISTS (SELECT 1 FROM public.festival_settlement_repair_diagnostics d
 WHERE d.settlement_id=s.id AND d.classification='unverifiable')
  AND s.status NOT IN ('finalised');

-- Formatting may be normalised, but semantic facts are producer-owned.  This
-- trigger rejects omissions and never supplies a clause, rule, evidence or
-- eligibility result.
DROP TRIGGER IF EXISTS festival_component_provenance_v6 ON public.festival_settlement_line_components;
DROP FUNCTION IF EXISTS public._festival_component_provenance_v6();
CREATE OR REPLACE FUNCTION public._festival_component_provenance_canonical() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.formula_type:=nullif(btrim(NEW.formula_type),'');
 NEW.formula_version:=nullif(btrim(NEW.formula_version),'');
 NEW.contract_clause_id:=nullif(btrim(NEW.contract_clause_id),'');
 NEW.source_rule:=nullif(btrim(NEW.source_rule),'');
 NEW.currency_code:=upper(nullif(btrim(NEW.currency_code),''));
 IF NEW.formula_type IS NULL OR NEW.formula_version IS NULL
   OR num_nonnulls(NEW.contract_clause_id,NEW.source_rule)<>1
   OR jsonb_typeof(NEW.source_evidence_ids)<>'array'
   OR jsonb_array_length(NEW.source_evidence_ids)=0
   OR jsonb_typeof(NEW.input_values)<>'object' OR NEW.input_values='{}'
   OR jsonb_typeof(NEW.eligibility_result)<>'object'
   OR NOT (NEW.eligibility_result ? 'eligible')
   OR jsonb_typeof(NEW.eligibility_result->'eligible')<>'boolean'
   OR NEW.amount_minor IS NULL OR NEW.currency_code !~ '^[A-Z]{3}$' THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_semantic_component_provenance_incomplete',
   DETAIL='formula_type, formula_version, exactly one genuine clause/rule, immutable evidence IDs, exact inputs, explicit eligibility, signed amount and currency are required';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_component_provenance_canonical BEFORE INSERT OR UPDATE
 ON public.festival_settlement_line_components FOR EACH ROW
 EXECUTE FUNCTION public._festival_component_provenance_canonical();
REVOKE ALL ON FUNCTION public._festival_component_provenance_canonical() FROM PUBLIC,anon,authenticated;

-- Actionable, Festival-domain diagnostics replace SELECT INTO STRICT failures.
CREATE FUNCTION public._assert_festival_runtime_plan_evidence(
 p_runtime uuid,p_plan_type text,p_expected uuid,p_state text,p_candidates uuid[],p_sources jsonb)
RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE launch_id uuid;
BEGIN
 SELECT festival_launch_id INTO launch_id FROM public.festival_runtime_sessions WHERE id=p_runtime;
 IF p_state='unresolved' OR (p_state='exact' AND
    (p_expected IS NULL OR cardinality(p_candidates)<>1 OR p_candidates[1] IS DISTINCT FROM p_expected))
    OR (p_state='not_applicable' AND cardinality(p_candidates)>0) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='festival_cross_plan_evidence',
   DETAIL=jsonb_build_object('runtimeSession',p_runtime,'launch',launch_id,'planType',p_plan_type,
    'expectedPlan',p_expected,'planState',p_state,'candidatePlanIds',coalesce(to_jsonb(p_candidates),'[]'),
    'conflictingSourceRows',coalesce(p_sources,'[]'),'repairInstruction',
    'Quarantine the conflicting runtime rows or set the exact plan identity through the Festival repair workflow, then prepare again.')::text;
 END IF;
END $$;

-- Canonical evidence freezer. Every runtime shift is resolved by the one staff
-- resolver and overtime comes solely from the v3 request/leaf-decision model.
CREATE FUNCTION public._freeze_festival_staff_evidence_v62(p_runtime uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE row record; resolved jsonb; result jsonb:='[]'; chain jsonb; leaf record;
BEGIN
 FOR row IN SELECT c.id checkin_id,c.staff_shift_id FROM public.festival_runtime_staff_checkins c
            WHERE c.runtime_session_id=p_runtime ORDER BY c.staff_shift_id LOOP
  resolved:=public._resolve_festival_staff_shift_evidence(p_runtime,row.staff_shift_id);
  IF NOT coalesce((resolved->>'complete')::boolean,false) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_staff_shift_evidence_incomplete',DETAIL=row.staff_shift_id::text;
  END IF;
  SELECT q.id,q.requested_minutes,q.requested_by,q.reason request_reason,d.id decision_id,
    d.decision_state,d.approved_minutes,d.reason decision_reason INTO leaf
  FROM public.festival_staff_overtime_requests_v3 q
  LEFT JOIN public.festival_staff_overtime_decisions_v3 d ON d.request_id=q.id
    AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=d.id)
  WHERE q.staff_checkin_id=row.checkin_id ORDER BY q.requested_at DESC,q.id DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('decisionId',d.id,'supersedes',d.superseded_decision_id,
    'state',d.decision_state,'approvedMinutes',d.approved_minutes) ORDER BY d.decided_at,d.id),'[]') INTO chain
  FROM public.festival_staff_overtime_decisions_v3 d WHERE d.request_id=leaf.id;
  result:=result||jsonb_build_array(jsonb_build_object('shiftId',row.staff_shift_id,'checkInId',row.checkin_id,
   'rawCheckIn',resolved->'checkIn','rawCheckOut',resolved->'checkOut','effectiveEvidenceSource',resolved->'source',
   'workedMinutes',resolved->'effectiveWorkedMinutes','absence',resolved->'absence','cancellation',resolved->'cancellation',
   'disputeCorrection',resolved->'disputeCorrection','manualCompletion',resolved->'manualCompletion','decisionIdentity',resolved->'decisionId',
   'overtimeRequestId',leaf.id,'requestedMinutes',leaf.requested_minutes,'requester',leaf.requested_by,
   'requestProvenance',leaf.request_reason,'effectiveDecisionId',leaf.decision_id,'decisionState',leaf.decision_state,
   'approvedMinutes',coalesce(leaf.approved_minutes,0),'decisionReason',leaf.decision_reason,
   'supersessionChainDigest',public.festival_json_content_digest(chain,ARRAY[]::text[])));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public._freeze_festival_staff_evidence_v62(uuid) FROM PUBLIC,anon,authenticated;

-- Store the fact that a NULL expected version was repaired; it was not the
-- caller's original expectation.
ALTER TABLE public.festival_settlement_finalisation_requests
 ADD COLUMN expected_version_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.festival_settlement_finalisation_requests q
SET expected_version_provenance=jsonb_build_object('source','migration_derived_current_version',
 'migration','20291218160000','derivedAt',statement_timestamp())
WHERE expected_version_provenance='{}' AND expected_version IS NOT NULL AND created_at < statement_timestamp();
UPDATE public.festival_settlement_finalisation_requests
 SET lease_owner=NULL,lease_expires_at=NULL
WHERE status<>'processing';
ALTER TABLE public.festival_settlement_finalisation_requests
 VALIDATE CONSTRAINT festival_finalisation_request_lease_coherent;

-- Stable, deliberately enumerated review projection; no unrestricted row JSON.
CREATE FUNCTION public.festival_settlement_review_projection_v1(p_settlement uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('schemaVersion','festival-settlement-review-v1','settlementId',s.id,
  'runtimeDigest',s.runtime_outcome_digest,'contractDigest',s.contract_snapshot_digest,
  'calculationDigest',s.calculation_digest,'currencyTotals',jsonb_build_object('currency',s.currency_code,
   'revenueMinor',s.total_revenue_minor,'costMinor',s.total_cost_minor,'netMinor',s.net_profit_loss_minor),
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'type',l.line_type,'sourceType',l.source_type,
   'sourceId',l.source_id,'recipientType',l.recipient_type,'recipientId',l.recipient_id,'grossMinor',l.gross_amount_minor,
   'taxMinor',l.tax_amount_minor,'feeMinor',l.fee_amount_minor,'netMinor',l.net_amount_minor,'currency',l.currency_code,'status',l.status)
   ORDER BY l.priority,l.id) FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id),'[]'),
  'semanticComponents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'lineId',c.settlement_line_id,
   'type',c.component_type,'formulaType',c.formula_type,'formulaVersion',c.formula_version,'contractClauseId',c.contract_clause_id,
   'sourceRule',c.source_rule,'sourceEvidenceIds',c.source_evidence_ids,'inputValues',c.input_values,
   'eligibilityResult',c.eligibility_result,'direction',c.direction,'amountMinor',c.amount_minor,'currency',c.currency_code)
   ORDER BY c.settlement_line_id,c.id) FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines l
   ON l.id=c.settlement_line_id WHERE l.settlement_id=s.id),'[]'),
  'taxes',coalesce((SELECT jsonb_agg(jsonb_build_object('lineId',t.settlement_line_id,'jurisdiction',t.jurisdiction,
   'taxType',t.tax_type,'rate',t.rate,'taxableBaseMinor',t.taxable_base_minor,'taxMinor',t.tax_amount_minor,'currency',t.currency_code)
   ORDER BY t.settlement_line_id,t.jurisdiction) FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines l
   ON l.id=t.settlement_line_id WHERE l.settlement_id=s.id),'[]'),
  'royalties',coalesce((SELECT jsonb_agg(jsonb_build_object('lineId',r.settlement_line_id,'payeeType',r.payee_type,
   'payeeId',r.payee_id,'royaltyBaseMinor',r.royalty_base_minor,'royaltyMinor',r.royalty_amount_minor,'currency',r.currency_code))
   FROM public.festival_royalty_receipts r JOIN public.festival_settlement_lines l ON l.id=r.settlement_line_id WHERE l.settlement_id=s.id),'[]'),
  'bandSplits',coalesce((SELECT jsonb_agg(jsonb_build_object('lineId',b.settlement_line_id,'bandId',b.band_id,
   'transferKey',b.transfer_key,'canonicalTransactionId',b.canonical_band_transaction_id,'canonicalSplitReceiptId',b.canonical_split_receipt_id))
   FROM public.festival_band_split_receipts b JOIN public.festival_settlement_lines l ON l.id=b.settlement_line_id WHERE l.settlement_id=s.id),'[]'))
 FROM public.festival_financial_settlements s WHERE s.id=p_settlement
$$;
REVOKE ALL ON FUNCTION public.festival_settlement_review_projection_v1(uuid) FROM PUBLIC,anon,authenticated;
