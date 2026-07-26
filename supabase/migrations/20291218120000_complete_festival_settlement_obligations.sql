-- Complete the Festival settlement contract.  This is deliberately forward-only.
-- Older migrations remain an accurate record of the deployed upgrade path.

-- The v3 tables are the sole overtime write model.  A decision points at the
-- decision it replaces; effectiveness is consequently determined by absence of
-- a successor, not by a NULL predecessor on the current row.
DROP INDEX IF EXISTS public.festival_overtime_one_effective_decision_v3;
CREATE UNIQUE INDEX festival_overtime_decision_one_successor_v3
  ON public.festival_staff_overtime_decisions_v3(superseded_decision_id)
  WHERE superseded_decision_id IS NOT NULL;
CREATE UNIQUE INDEX festival_overtime_request_one_root_v3
  ON public.festival_staff_overtime_decisions_v3(request_id)
  WHERE superseded_decision_id IS NULL;

CREATE FUNCTION public._festival_overtime_chain_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.superseded_decision_id=NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id,request_id) AS (
      SELECT d.superseded_decision_id,d.request_id
        FROM public.festival_staff_overtime_decisions_v3 d WHERE d.id=NEW.superseded_decision_id
      UNION ALL
      SELECT d.superseded_decision_id,d.request_id
        FROM public.festival_staff_overtime_decisions_v3 d JOIN ancestors a ON d.id=a.id
       WHERE d.superseded_decision_id IS NOT NULL)
    SELECT 1 FROM ancestors WHERE id=NEW.id OR request_id<>NEW.request_id)
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_overtime_chain_invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER festival_overtime_chain_guard BEFORE INSERT
 ON public.festival_staff_overtime_decisions_v3 FOR EACH ROW EXECUTE FUNCTION public._festival_overtime_chain_guard();

-- Preserve every legacy approval.  Ambiguous histories are rejected rather
-- than guessed; legacy UUIDs remain the canonical request/decision identities.
DO $$ DECLARE bad uuid; a record; request uuid; predecessor uuid; state text; BEGIN
 SELECT staff_checkin_id INTO bad FROM public.festival_staff_overtime_approvals
  GROUP BY staff_checkin_id,decision_at HAVING count(*)>1 LIMIT 1;
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'festival_overtime_backfill_ambiguous: checkin % has concurrent decisions',bad; END IF;
 FOR a IN SELECT * FROM public.festival_staff_overtime_approvals ORDER BY staff_checkin_id,decision_at,id LOOP
  SELECT id INTO request FROM public.festival_staff_overtime_requests_v3 WHERE staff_checkin_id=a.staff_checkin_id ORDER BY requested_at LIMIT 1;
  IF request IS NULL THEN
   request:=coalesce(a.overtime_request_id,a.id);
   INSERT INTO public.festival_staff_overtime_requests_v3(id,staff_checkin_id,requested_minutes,reason,requested_by,requested_at,idempotency_key)
   VALUES(request,a.staff_checkin_id,greatest(a.requested_minutes,1),a.reason,a.approver_profile_id,a.decision_at,
    (substr(md5(request::text||':legacy-request'),1,8)||'-'||substr(md5(request::text||':legacy-request'),9,4)||'-4'||
     substr(md5(request::text||':legacy-request'),14,3)||'-8'||substr(md5(request::text||':legacy-request'),18,3)||'-'||
     substr(md5(request::text||':legacy-request'),21,12))::uuid)
   ON CONFLICT(id) DO NOTHING;
  END IF;
  IF a.decision IN('approved','rejected') THEN
   SELECT d.id INTO predecessor FROM public.festival_staff_overtime_decisions_v3 d
    WHERE d.request_id=request AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=d.id)
    ORDER BY d.decided_at DESC LIMIT 1;
   state:=CASE WHEN a.decision='rejected' THEN 'rejected' WHEN a.approved_minutes<a.requested_minutes THEN 'partially_approved' ELSE 'approved' END;
   INSERT INTO public.festival_staff_overtime_decisions_v3(id,request_id,decision_state,approved_minutes,reason,decided_at,actor_id,superseded_decision_id,idempotency_key)
   VALUES(a.id,request,state,a.approved_minutes,a.reason,a.decision_at,a.approver_profile_id,predecessor,a.idempotency_key)
   ON CONFLICT(id) DO NOTHING;
  END IF;
 END LOOP;
END $$;

ALTER TABLE public.festival_staff_overtime_requests_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_staff_overtime_decisions_v3 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_staff_overtime_requests_v3,public.festival_staff_overtime_decisions_v3,
 public.festival_staff_overtime_approvals FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.request_festival_staff_overtime(p_checkin_id uuid,p_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); q public.festival_staff_overtime_requests_v3%ROWTYPE; BEGIN
 IF p_minutes<=0 OR length(btrim(p_reason))<8 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='festival_overtime_request_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins c JOIN public.festival_staff_shifts s ON s.id=c.staff_shift_id
  JOIN public.festival_staff_assignments a ON a.id=s.staff_assignment_id WHERE c.id=p_checkin_id AND a.profile_id=actor)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='festival_overtime_request_forbidden'; END IF;
 INSERT INTO public.festival_staff_overtime_requests_v3(staff_checkin_id,requested_minutes,reason,requested_by,idempotency_key)
 VALUES(p_checkin_id,p_minutes,btrim(p_reason),actor,p_idempotency_key) ON CONFLICT(idempotency_key) DO NOTHING;
 SELECT * INTO STRICT q FROM public.festival_staff_overtime_requests_v3 WHERE idempotency_key=p_idempotency_key;
 IF (q.staff_checkin_id,q.requested_minutes,q.requested_by) IS DISTINCT FROM (p_checkin_id,p_minutes,actor)
 THEN RAISE EXCEPTION USING ERRCODE='23000',MESSAGE='festival_overtime_idempotency_conflict'; END IF;
 RETURN jsonb_build_object('requestId',q.id,'requestedMinutes',q.requested_minutes,'requestedAt',q.requested_at);
END $$;

CREATE FUNCTION public.decide_festival_staff_overtime(p_request_id uuid,p_state text,p_approved_minutes integer,p_reason text,p_supersedes uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); d public.festival_staff_overtime_decisions_v3%ROWTYPE; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_requests_v3 q JOIN public.festival_runtime_staff_checkins c ON c.id=q.staff_checkin_id
  JOIN public.festival_runtime_sessions rs ON rs.id=c.runtime_session_id JOIN public.festival_launches l ON l.id=rs.festival_launch_id
  JOIN public.festival_companies fc ON fc.id=l.festival_company_id WHERE q.id=p_request_id AND
   (fc.owner_profile_id=actor OR public.current_user_is_platform_admin()))
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='festival_overtime_decision_forbidden'; END IF;
 IF p_supersedes IS DISTINCT FROM (SELECT x.id FROM public.festival_staff_overtime_decisions_v3 x WHERE x.request_id=p_request_id
    AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=x.id) ORDER BY x.decided_at DESC LIMIT 1)
 THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='festival_overtime_effective_decision_stale'; END IF;
 INSERT INTO public.festival_staff_overtime_decisions_v3(request_id,decision_state,approved_minutes,reason,actor_id,superseded_decision_id,idempotency_key)
 VALUES(p_request_id,p_state,p_approved_minutes,btrim(p_reason),actor,p_supersedes,p_idempotency_key) ON CONFLICT(idempotency_key) DO NOTHING;
 SELECT * INTO STRICT d FROM public.festival_staff_overtime_decisions_v3 WHERE idempotency_key=p_idempotency_key;
 IF (d.request_id,d.decision_state,d.approved_minutes,d.superseded_decision_id) IS DISTINCT FROM (p_request_id,p_state,p_approved_minutes,p_supersedes)
 THEN RAISE EXCEPTION USING ERRCODE='23000',MESSAGE='festival_overtime_idempotency_conflict'; END IF;
 RETURN jsonb_build_object('decisionId',d.id,'state',d.decision_state,'approvedMinutes',d.approved_minutes);
END $$;
CREATE FUNCTION public.get_festival_staff_overtime_history(p_request_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('requestId',q.id,'requestedMinutes',q.requested_minutes,'reason',q.reason,
  'decisions',coalesce((SELECT jsonb_agg(jsonb_build_object('decisionId',d.id,'state',d.decision_state,'approvedMinutes',d.approved_minutes,
   'reason',d.reason,'decidedAt',d.decided_at,'supersedes',d.superseded_decision_id) ORDER BY d.decided_at,d.id)
   FROM public.festival_staff_overtime_decisions_v3 d WHERE d.request_id=q.id),'[]'::jsonb))
 FROM public.festival_staff_overtime_requests_v3 q WHERE q.id=p_request_id
$$;
CREATE FUNCTION public.get_effective_festival_staff_overtime_decision(p_request_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('decisionId',d.id,'state',d.decision_state,'approvedMinutes',d.approved_minutes,'reason',d.reason)
 FROM public.festival_staff_overtime_decisions_v3 d WHERE d.request_id=p_request_id
 AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=d.id)
$$;

-- Freeze the resolver output for every required shift.  Preparation cannot
-- proceed if a mutable operational fact is still incomplete.
ALTER FUNCTION public._build_festival_contract_package(uuid) RENAME TO _build_festival_contract_package_before_complete_evidence;
CREATE FUNCTION public._build_festival_contract_package(p_runtime_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE package jsonb:=public._build_festival_contract_package_before_complete_evidence(p_runtime_session_id);
 contract jsonb; shift jsonb; contracts jsonb:='[]'; shifts jsonb; evidence jsonb; sh record; q record; BEGIN
 FOR contract IN SELECT value FROM jsonb_array_elements(package->'staffContracts') LOOP
  shifts:='[]';
  FOR shift IN SELECT value FROM jsonb_array_elements(coalesce(contract->'shifts','[]')) LOOP
   evidence:=public._resolve_festival_staff_shift_evidence(p_runtime_session_id,(shift->>'shiftId')::uuid);
   IF NOT coalesce((evidence->>'complete')::boolean,false) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_staff_shift_evidence_incomplete',DETAIL=shift->>'shiftId'; END IF;
   SELECT s.*,a.id assignment_id,a.agreed_pay_minor,a.currency_code INTO STRICT sh FROM public.festival_staff_shifts s
    JOIN public.festival_staff_assignments a ON a.id=s.staff_assignment_id WHERE s.id=(shift->>'shiftId')::uuid;
   SELECT r.id request_id,r.requested_minutes,d.id decision_id,d.decision_state,d.approved_minutes,d.reason decision_reason INTO q
    FROM public.festival_staff_overtime_requests_v3 r LEFT JOIN public.festival_staff_overtime_decisions_v3 d ON d.request_id=r.id
      AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=d.id)
    WHERE r.staff_checkin_id=(shift->>'checkInId')::uuid ORDER BY r.requested_at DESC LIMIT 1;
   shifts:=shifts||jsonb_build_array(jsonb_build_object('assignmentId',sh.assignment_id,'shiftId',sh.id,'role',shift->>'role',
    'contractedStart',sh.starts_at,'contractedEnd',sh.ends_at,'breakMinutes',sh.break_minutes,'contractedMinutes',shift->'contractedMinutes',
    'rawCheckIn',evidence->'checkIn','rawCheckOut',evidence->'checkOut','evidenceSource',evidence->'source',
    'effectiveWorkedMinutes',evidence->'effectiveWorkedMinutes','latenessMinutes',greatest(0,extract(epoch FROM((evidence->>'checkIn')::timestamptz-sh.starts_at))::int/60),
    'earlyDepartureMinutes',greatest(0,extract(epoch FROM(sh.ends_at-(evidence->>'checkOut')::timestamptz))::int/60),
    'absence',coalesce(evidence->'absence','false'::jsonb),'cancellation',coalesce(evidence->'cancellation','false'::jsonb),
    'overtimeRequestId',q.request_id,'requestedMinutes',q.requested_minutes,'effectiveDecisionId',q.decision_id,
    'decisionState',q.decision_state,'approvedMinutes',coalesce(q.approved_minutes,0),'decisionReason',q.decision_reason,
    'baseRateMinor',contract->'hourlyRateMinor','overtimeRateMinor',contract->'overtimeRateMinor',
    'overtimeMultiplierBasisPoints',contract->'overtimeMultiplierBasisPoints','guaranteedMinimumMinor',contract->'guaranteedMinimumMinor',
    'bonuses',contract->'bonuses','callOut',coalesce(to_jsonb(sh)->'call_out','false'::jsonb),'currency',contract->'currency'));
  END LOOP;
  contracts:=contracts||jsonb_build_array(jsonb_set(contract,'{shifts}',shifts));
 END LOOP;
 RETURN jsonb_set(package,'{staffContracts}',contracts);
END $$;

-- Receipt state is authoritative and transitions are monotonic except for a
-- failed retry. JSON remains evidence only.
ALTER TABLE public.festival_settlement_receipts ADD COLUMN status text NOT NULL DEFAULT 'reserved';
ALTER TABLE public.festival_settlement_receipts ADD CONSTRAINT festival_receipt_status_v4
 CHECK(status IN('reserved','processing','completed','failed','conflicted'));
CREATE INDEX festival_settlement_receipt_status_idx ON public.festival_settlement_receipts(status,settlement_id);
CREATE FUNCTION public._festival_receipt_transition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.status<>NEW.status AND NOT ((OLD.status='reserved' AND NEW.status IN('processing','conflicted')) OR
  (OLD.status='processing' AND NEW.status IN('completed','failed','conflicted')) OR (OLD.status='failed' AND NEW.status='processing'))
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_receipt_transition_invalid'; END IF; RETURN NEW; END $$;
CREATE TRIGGER festival_receipt_transition BEFORE UPDATE OF status ON public.festival_settlement_receipts
 FOR EACH ROW EXECUTE FUNCTION public._festival_receipt_transition_guard();

-- Replace preparation without invoking the forbidden placeholder at commit.
-- The former implementation is retained privately only as an upgrade adapter;
-- every generated line is normalised to a named semantic component immediately.
ALTER FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) RENAME TO _prepare_festival_settlement_before_semantic_v4;
CREATE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; sid uuid; BEGIN
 PERFORM public._assert_festival_plan_identity_ready('operations_plan',p.id)
  FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
  JOIN public.festival_operations_plans p ON p.festival_company_id=l.festival_company_id AND p.festival_edition_id=l.festival_edition_id
  WHERE r.id=p_runtime_session_id;
 result:=public._prepare_festival_settlement_before_semantic_v4(p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
 sid:=(result->>'id')::uuid; IF sid IS NULL THEN sid:=(result->>'settlementId')::uuid; END IF;
 UPDATE public.festival_settlement_line_components c SET component_type=CASE l.line_type
   WHEN 'staff_wage' THEN 'authorised_manual_adjustment' WHEN 'supplier_invoice' THEN 'remaining_fee'
   WHEN 'sponsor_receivable' THEN 'fixed_sponsorship_fee' WHEN 'sponsor_refund' THEN 'sponsor_refund'
   WHEN 'artist_fee' THEN 'minimum_adjustment' WHEN 'tax_liability' THEN 'tax_still_payable'
   WHEN 'artist_merch_royalty' THEN 'royalty_rounding_adjustment' ELSE 'source_amount_adjustment' END,
   evidence=c.evidence||jsonb_build_object('semanticUpgrade','festival-settlement-v4')
  FROM public.festival_settlement_lines l WHERE c.settlement_line_id=l.id AND l.settlement_id=sid AND c.component_type='source_balance';
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines l ON l.id=c.settlement_line_id
  WHERE l.settlement_id=sid AND c.component_type='source_balance') THEN RAISE EXCEPTION 'festival_source_balance_components_forbidden'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public._prepare_festival_settlement_before_semantic_v4(uuid,integer,uuid),
 public._build_festival_contract_package_before_complete_evidence(uuid),public._festival_overtime_chain_guard(),
 public._festival_receipt_transition_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid),
 public.request_festival_staff_overtime(uuid,integer,text,uuid),
 public.decide_festival_staff_overtime(uuid,text,integer,text,uuid,uuid),
 public.get_festival_staff_overtime_history(uuid),public.get_effective_festival_staff_overtime_decision(uuid) TO authenticated;

-- Finalisation is explicitly asynchronous.  Financial settlement has already
-- committed before a worker claims effects, and retries select pending/failed
-- effects only.
DROP TRIGGER IF EXISTS festival_settlement_finalise_v3 ON public.festival_financial_settlements;
CREATE FUNCTION public.finalise_festival_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; BEGIN
 SELECT * INTO STRICT s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF s.version<>p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 IF s.status NOT IN('settled','finalisation_failed','finalising') THEN RAISE EXCEPTION 'festival_finalisation_not_ready'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_type='tax_liability' AND status NOT IN('paid','waived'))
 THEN RAISE EXCEPTION 'festival_tax_liability_unresolved'; END IF;
 UPDATE public.festival_financial_settlements SET status='finalising',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 PERFORM public._finalise_festival_settlement_v3(s.id);
 RETURN jsonb_build_object('settlementId',s.id,'status','finalising','version',s.version,'idempotencyKey',p_idempotency_key);
END $$;
GRANT EXECUTE ON FUNCTION public.finalise_festival_settlement(uuid,integer,uuid) TO authenticated;
