-- Operational festival lifecycle recovery (forward-only).
-- Recovery owns the same durable identities as the normal workers.  Nothing in
-- this migration manufactures gameplay or financial evidence.

ALTER TABLE public.festival_lifecycle_operations
  ADD COLUMN IF NOT EXISTS lease_generation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.festival_lifecycle_transitions
  ADD COLUMN IF NOT EXISTS resulting_version integer;

CREATE TABLE public.festival_payment_resolution_authorisations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),
 terminal_state text NOT NULL CHECK (terminal_state IN ('waived','written_off','cancelled')),
 actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 reason_code text NOT NULL CHECK (btrim(reason_code) <> ''),
 explanation text NOT NULL CHECK (btrim(explanation) <> ''),
 evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
 expected_line_version integer NOT NULL CHECK (expected_line_version > 0),
 authorised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (settlement_line_id, terminal_state)
);
ALTER TABLE public.festival_payment_resolution_authorisations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_payment_resolution_authorisations FROM PUBLIC,anon,authenticated;

ALTER TABLE public.festival_payment_terminal_resolutions
  ADD COLUMN IF NOT EXISTS authorisation_id uuid REFERENCES public.festival_payment_resolution_authorisations(id),
  ADD COLUMN IF NOT EXISTS canonical_receipt_id uuid REFERENCES public.festival_settlement_receipts(id),
  ADD COLUMN IF NOT EXISTS canonical_transaction_id uuid REFERENCES public.financial_transactions(id);

-- Historical values which no worker understands are quarantined before the
-- forward constraint is made authoritative.
CREATE TABLE public.festival_recovery_quarantine (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL,
 entity_id uuid NOT NULL, reason text NOT NULL, evidence jsonb NOT NULL,
 quarantined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(entity_type,entity_id,reason)
);
ALTER TABLE public.festival_recovery_quarantine ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_recovery_quarantine FROM PUBLIC,anon,authenticated;
INSERT INTO public.festival_recovery_quarantine(entity_type,entity_id,reason,evidence)
SELECT 'settlement_line',id,'invalid_status',to_jsonb(l)
FROM public.festival_settlement_lines l
WHERE status NOT IN('pending','processing','paid','failed','outstanding','waived','resolved','not_applicable','written_off','cancelled','disputed')
ON CONFLICT DO NOTHING;
UPDATE public.festival_settlement_lines SET status='disputed'
WHERE status NOT IN('pending','processing','paid','failed','outstanding','waived','resolved','not_applicable','written_off','cancelled','disputed');
ALTER TABLE public.festival_settlement_lines VALIDATE CONSTRAINT festival_settlement_line_status_recovery;

CREATE OR REPLACE FUNCTION public._festival_worker_trusted() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT current_user IN ('postgres','supabase_admin','service_role')
    OR coalesce(nullif(current_setting('request.jwt.claim.role',true),'')='service_role',false)
$$;

CREATE OR REPLACE FUNCTION public._festival_lifecycle_authorised(p_runtime uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public._festival_worker_trusted()
    OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR public._festival_runtime_owner(p_runtime,public._caller_profile_id())
$$;

CREATE OR REPLACE FUNCTION public._claim_festival_lifecycle_operation(
 p_runtime uuid,p_settlement uuid,p_operation text,p_key uuid,p_digest text,
 p_worker uuid,p_lease interval DEFAULT interval '2 minutes') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_lifecycle_operations%ROWTYPE; outcome text;
BEGIN
 IF NOT public._festival_worker_trusted() THEN RAISE EXCEPTION 'festival_worker_forbidden'; END IF;
 IF p_operation NOT IN ('runtime_completion','settlement_preparation','payment_execution','finalisation','effect_execution','snapshot_rebuild','reconciliation')
 THEN RAISE EXCEPTION 'festival_lifecycle_operation_unknown'; END IF;
 INSERT INTO public.festival_lifecycle_operations(runtime_session_id,settlement_id,operation,idempotency_key,request_digest)
 VALUES(p_runtime,p_settlement,p_operation,p_key,p_digest) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT o FROM public.festival_lifecycle_operations
 WHERE runtime_session_id=p_runtime AND operation=p_operation AND idempotency_key=p_key FOR UPDATE;
 IF o.request_digest IS DISTINCT FROM p_digest OR o.settlement_id IS DISTINCT FROM p_settlement THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='festival_lifecycle_idempotency_conflict',
   DETAIL=format('operation=%s runtime=%s key=%s',p_operation,p_runtime,p_key);
 END IF;
 IF o.status='completed' THEN
  RETURN jsonb_build_object('outcome','completed_replay','operationId',o.id,'result',o.result,'attemptCount',o.attempt_count);
 END IF;
 IF o.status='processing' AND o.lease_expires_at>clock_timestamp() AND o.lease_owner IS DISTINCT FROM p_worker THEN
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',o.id,'leaseExpiresAt',o.lease_expires_at);
 END IF;
 outcome:=CASE WHEN o.status='processing' THEN 'expired_lease_resumed' WHEN o.attempt_count=0 THEN 'newly_claimed' ELSE 'expired_lease_resumed' END;
 UPDATE public.festival_lifecycle_operations SET status='processing',lease_owner=p_worker,
  lease_expires_at=clock_timestamp()+p_lease,attempt_count=attempt_count+1,
  lease_generation=lease_generation+1,started_at=coalesce(started_at,clock_timestamp()),
  last_error=NULL,updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('outcome',outcome,'operationId',o.id,'leaseGeneration',o.lease_generation,'attemptCount',o.attempt_count);
END $$;

CREATE OR REPLACE FUNCTION public._complete_festival_lifecycle_operation(
 p_operation uuid,p_worker uuid,p_generation integer,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_lifecycle_operations%ROWTYPE;
BEGIN
 IF NOT public._festival_worker_trusted() THEN RAISE EXCEPTION 'festival_worker_forbidden'; END IF;
 SELECT * INTO STRICT o FROM public.festival_lifecycle_operations WHERE id=p_operation FOR UPDATE;
 IF o.status='completed' THEN RETURN o.result; END IF;
 IF o.status<>'processing' OR o.lease_owner IS DISTINCT FROM p_worker OR o.lease_generation<>p_generation
 THEN RAISE EXCEPTION 'festival_lifecycle_lease_lost'; END IF;
 UPDATE public.festival_lifecycle_operations SET status='completed',result=p_result,last_error=NULL,
  lease_owner=NULL,lease_expires_at=NULL,completed_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=o.id;
 RETURN p_result;
END $$;

CREATE OR REPLACE FUNCTION public._fail_festival_lifecycle_operation(
 p_operation uuid,p_worker uuid,p_generation integer,p_error jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public._festival_worker_trusted() THEN RAISE EXCEPTION 'festival_worker_forbidden'; END IF;
 UPDATE public.festival_lifecycle_operations SET status='failed',last_error=p_error,
  lease_owner=NULL,lease_expires_at=NULL,updated_at=clock_timestamp()
 WHERE id=p_operation AND status='processing' AND lease_owner=p_worker AND lease_generation=p_generation;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_lifecycle_lease_lost'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._festival_physical_lifecycle_state(p_runtime uuid,p_settlement uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE physical text;
BEGIN
 IF p_settlement IS NOT NULL THEN
  SELECT status INTO physical FROM public.festival_financial_settlements WHERE id=p_settlement AND runtime_session_id=p_runtime;
  CASE physical WHEN 'draft' THEN RETURN 'settlement_preparing'; WHEN 'calculated' THEN RETURN 'calculated';
   WHEN 'settled' THEN RETURN 'settled'; WHEN 'finalising' THEN RETURN 'finalising';
   WHEN 'finalised' THEN RETURN 'finalised'; WHEN 'finalisation_failed' THEN RETURN 'finalisation_failed';
   WHEN NULL THEN NULL; ELSE RAISE EXCEPTION USING MESSAGE='festival_lifecycle_state_unknown',
    DETAIL=format('physical_state=%s runtime_id=%s settlement_id=%s',physical,p_runtime,p_settlement); END CASE;
 END IF;
 SELECT status INTO physical FROM public.festival_runtime_sessions WHERE id=p_runtime;
 CASE physical WHEN 'planning' THEN RETURN 'planning'; WHEN 'scheduled' THEN RETURN 'scheduled';
  WHEN 'preparing' THEN RETURN 'preparing'; WHEN 'live' THEN RETURN 'running';
  WHEN 'final_performance_complete' THEN RETURN 'running'; WHEN 'public_closed' THEN RETURN 'running';
  WHEN 'site_clearance' THEN RETURN 'running'; WHEN 'runtime_complete' THEN RETURN 'runtime_complete';
  WHEN NULL THEN RAISE EXCEPTION 'festival_runtime_not_found';
  ELSE RAISE EXCEPTION USING MESSAGE='festival_lifecycle_state_unknown',
   DETAIL=format('physical_state=%s runtime_id=%s settlement_id=%s',physical,p_runtime,coalesce(p_settlement::text,'null')); END CASE;
END $$;

CREATE OR REPLACE FUNCTION public.transition_festival_lifecycle(p_runtime uuid,p_from text,p_to text,p_operation uuid DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE; s public.festival_financial_settlements%ROWTYPE;
 current_state text; persisted text; resulting_version integer;
BEGIN
 SELECT * INTO STRICT r FROM public.festival_runtime_sessions WHERE id=p_runtime FOR UPDATE;
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime FOR UPDATE;
 IF NOT public._festival_lifecycle_authorised(p_runtime) THEN RAISE EXCEPTION 'festival_lifecycle_transition_forbidden'; END IF;
 current_state:=public._festival_physical_lifecycle_state(p_runtime,s.id);
 IF current_state IS DISTINCT FROM p_from THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='festival_lifecycle_state_stale',DETAIL=current_state; END IF;
 IF NOT public._festival_lifecycle_transition_allowed(current_state,p_to) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_lifecycle_transition_invalid'; END IF;
 IF p_to IN ('settlement_preparing','calculated','settled','finalising','finalised','finalisation_failed') THEN
  IF s.id IS NULL THEN RAISE EXCEPTION 'festival_settlement_missing'; END IF;
  UPDATE public.festival_financial_settlements SET status=CASE p_to WHEN 'settlement_preparing' THEN 'draft' ELSE p_to END,
   version=version+1,updated_at=clock_timestamp() WHERE id=s.id RETURNING version INTO resulting_version;
 ELSE
  UPDATE public.festival_runtime_sessions SET status=CASE p_to WHEN 'running' THEN 'live' ELSE p_to END,
   version=version+1,updated_at=clock_timestamp() WHERE id=r.id RETURNING version INTO resulting_version;
 END IF;
 persisted:=public._festival_physical_lifecycle_state(p_runtime,s.id);
 INSERT INTO public.festival_lifecycle_transitions(runtime_session_id,settlement_id,from_state,to_state,operation_id,actor_profile_id,reason,resulting_version)
 VALUES(p_runtime,s.id,current_state,persisted,p_operation,public._caller_profile_id(),p_reason,resulting_version);
 RETURN jsonb_build_object('runtimeSessionId',p_runtime,'settlementId',s.id,'from',current_state,'to',persisted,'version',resulting_version);
END $$;

-- Terminality is checked on both INSERT and UPDATE without touching OLD during
-- INSERT.  Non-payment resolutions must already have immutable authorisation.
CREATE OR REPLACE FUNCTION public._festival_payment_terminal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_terminal boolean:=false; auth_id uuid; receipt_id uuid; transaction_id uuid; existing text;
BEGIN
 IF TG_OP='UPDATE' THEN old_terminal:=OLD.status IN('paid','waived','written_off','cancelled'); END IF;
 IF old_terminal AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'festival_payment_terminal_state_immutable'; END IF;
 IF NEW.status NOT IN('paid','waived','written_off','cancelled') THEN RETURN NEW; END IF;
 SELECT terminal_state INTO existing FROM public.festival_payment_terminal_resolutions WHERE settlement_line_id=NEW.id;
 IF existing IS NOT NULL AND existing IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'festival_payment_multiple_terminal_states'; END IF;
 IF NEW.status IN('waived','written_off','cancelled') THEN
  SELECT id INTO auth_id FROM public.festival_payment_resolution_authorisations
   WHERE settlement_line_id=NEW.id AND terminal_state=NEW.status;
  IF auth_id IS NULL THEN RAISE EXCEPTION 'festival_payment_resolution_evidence_required'; END IF;
 ELSE
  SELECT id,canonical_transaction_id INTO receipt_id,transaction_id FROM public.festival_settlement_receipts WHERE settlement_line_id=NEW.id;
  IF receipt_id IS NULL AND coalesce(NEW.line_category,'')='liability' THEN RAISE EXCEPTION 'festival_payment_receipt_required'; END IF;
 END IF;
 INSERT INTO public.festival_payment_terminal_resolutions(settlement_line_id,terminal_state,authorisation_id,canonical_receipt_id,canonical_transaction_id)
 VALUES(NEW.id,NEW.status,auth_id,receipt_id,transaction_id)
 ON CONFLICT(settlement_line_id) DO UPDATE SET terminal_state=excluded.terminal_state
 WHERE public.festival_payment_terminal_resolutions.terminal_state=excluded.terminal_state;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_payment_terminal_state ON public.festival_settlement_lines;
CREATE TRIGGER festival_payment_terminal_state AFTER INSERT OR UPDATE OF status ON public.festival_settlement_lines
FOR EACH ROW EXECUTE FUNCTION public._festival_payment_terminal_guard();

CREATE TABLE public.festival_effect_dependency_rules (
 effect_type text NOT NULL, prerequisite_type text NOT NULL,
 requires_verified_destination boolean NOT NULL DEFAULT true,
 PRIMARY KEY(effect_type,prerequisite_type)
);
INSERT INTO public.festival_effect_dependency_rules(effect_type,prerequisite_type) VALUES
 ('award_eligibility','artist_reputation'),('award_eligibility','band_reputation'),('award_eligibility','festival_reputation'),
 ('followers','artist_reputation'),('followers','band_reputation'),('followers','festival_reputation'),
 ('player_news','festival_history'),('band_news','festival_history'),('company_news','company_history'),
 ('sponsor_related_news','sponsor_relationships'),('world_pulse','final_snapshot'),('world_pulse','festival_history'),
 ('rockmundo_fm','world_pulse'),('twaater','world_pulse'),('publication','final_snapshot'),('world_effect','final_snapshot')
ON CONFLICT DO NOTHING;
ALTER TABLE public.festival_effect_dependency_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_effect_dependency_rules FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._festival_effect_dependency_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) AND EXISTS(
  SELECT 1 FROM public.festival_effect_dependency_rules d
  WHERE d.effect_type=NEW.effect_type AND NOT EXISTS(
   SELECT 1 FROM public.festival_settlement_effect_receipts p
   JOIN public.festival_settlement_effect_destinations x ON x.receipt_id=p.id AND x.evidence_digest=p.evidence_digest
   WHERE p.settlement_id=NEW.settlement_id AND p.effect_type=d.prerequisite_type AND p.status='completed'))
 THEN RAISE EXCEPTION 'festival_effect_dependency_incomplete'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_effect_dependency_order ON public.festival_settlement_effect_receipts;
CREATE TRIGGER festival_effect_dependency_order BEFORE INSERT OR UPDATE OF status ON public.festival_settlement_effect_receipts
FOR EACH ROW EXECUTE FUNCTION public._festival_effect_dependency_guard();

-- Candidate values, not the still-persisted row, are supplied to verification.
CREATE OR REPLACE FUNCTION public._festival_progression_integrity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE integrity jsonb; recalculated text;
BEGIN
 IF NEW.status IN('calculated','settled','finalising','finalised') AND OLD.status IS DISTINCT FROM NEW.status THEN
  integrity:=public._festival_snapshot_integrity(NEW.id);
  recalculated:=public._festival_calculation_digest(NEW.id);
  IF NEW.runtime_snapshot_digest IS DISTINCT FROM NEW.runtime_outcome_digest THEN
   RAISE EXCEPTION USING MESSAGE='festival_snapshot_verification_failed',DETAIL='runtime_snapshot_to_stored_runtime_digest';
  ELSIF NEW.calculation_digest IS DISTINCT FROM recalculated THEN
   RAISE EXCEPTION USING MESSAGE='festival_snapshot_verification_failed',DETAIL='canonical_calculation_to_stored_calculation_digest';
  ELSIF NOT coalesce((integrity->>'pass')::boolean,false) THEN
   RAISE EXCEPTION USING MESSAGE='festival_snapshot_verification_failed',DETAIL=(integrity->'issues')::text;
  END IF;
 END IF;
 RETURN NEW;
END $$;

-- Public diagnostics is ownership scoped; workers use this private helper.
CREATE OR REPLACE FUNCTION public._festival_consistency_audit_private(p_runtime uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s uuid; rt jsonb; snap jsonb; lines_ok boolean; payments_ok boolean; effects_ok boolean; operations_ok boolean;
BEGIN
 SELECT id INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime;
 rt:=public.festival_runtime_integrity(p_runtime); snap:=CASE WHEN s IS NULL THEN NULL ELSE public._festival_snapshot_integrity(s) END;
 lines_ok:=NOT EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s AND l.net_amount_minor IS DISTINCT FROM
  (SELECT coalesce(sum(CASE c.direction WHEN 'credit' THEN c.amount_minor ELSE -c.amount_minor END),0) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id));
 payments_ok:=NOT EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=s AND status IN('processing','failed','outstanding','disputed'));
 effects_ok:=NOT EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=s AND status<>'completed');
 operations_ok:=NOT EXISTS(SELECT 1 FROM public.festival_lifecycle_operations WHERE runtime_session_id=p_runtime AND (status='failed' OR status='processing' AND lease_expires_at<now()));
 RETURN jsonb_build_object('runtimeIntegrity',coalesce((rt->>'pass')::boolean,false),'planIdentityIntegrity',s IS NOT NULL,
  'contractIntegrity',s IS NULL OR (snap->>'contractDigest') IS NOT NULL,'lineComponentReconciliation',lines_ok,
  'revenueCostProfitReconciliation',lines_ok,'taxReconciliation',lines_ok,'royaltyReconciliation',lines_ok,
  'bandSplitReconciliation',lines_ok,'receiptReconciliation',payments_ok,'ledgerBalance',payments_ok,
  'snapshotIntegrity',coalesce((snap->>'pass')::boolean,false),'effectIntegrity',effects_ok,
  'worldDestinationIntegrity',effects_ok,'lifecycleOperationHealth',operations_ok);
END $$;
CREATE OR REPLACE FUNCTION public.festival_consistency_audit(p_runtime uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public._festival_lifecycle_authorised(p_runtime) THEN RAISE EXCEPTION 'festival_diagnostics_forbidden'; END IF;
 RETURN public._festival_consistency_audit_private(p_runtime);
END $$;

REVOKE ALL ON FUNCTION public._festival_worker_trusted(),public._festival_lifecycle_authorised(uuid),
 public._claim_festival_lifecycle_operation(uuid,uuid,text,uuid,text,uuid,interval),
 public._complete_festival_lifecycle_operation(uuid,uuid,integer,jsonb),
 public._fail_festival_lifecycle_operation(uuid,uuid,integer,jsonb),
 public._festival_physical_lifecycle_state(uuid,uuid),public._festival_consistency_audit_private(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transition_festival_lifecycle(uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_festival_lifecycle(uuid,text,text,uuid,text),public.festival_consistency_audit(uuid) TO authenticated;

-- Attach durable operation ownership to the production entry points.  The
-- original implementations remain the canonical financial/runtime workers;
-- these wrappers only provide locking, replay and audited attempts.
ALTER FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) RENAME TO _prepare_festival_settlement_worker_v7;
CREATE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE worker uuid:=gen_random_uuid(); claim jsonb; operation_id uuid; generation integer;
 runtime_digest text; contract_digest text; request_digest text; result jsonb; settlement uuid;
BEGIN
 IF NOT public._festival_lifecycle_authorised(p_runtime_session_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 SELECT content_digest INTO STRICT runtime_digest FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=p_runtime_session_id;
 SELECT content_digest INTO contract_digest FROM public.festival_settlement_contract_snapshots WHERE runtime_session_id=p_runtime_session_id;
 IF contract_digest IS NULL THEN contract_digest:=public.festival_contract_package_digest(public._build_festival_contract_package_native_v6(p_runtime_session_id)); END IF;
 request_digest:=public.festival_json_content_digest(jsonb_build_object('runtimeId',p_runtime_session_id,
  'expectedRuntimeVersion',p_expected_runtime_version,'runtimeSnapshotDigest',runtime_digest,
  'contractSnapshotDigest',contract_digest,'idempotencyKey',p_idempotency_key),ARRAY[]::text[]);
 claim:=public._claim_festival_lifecycle_operation(p_runtime_session_id,NULL,'settlement_preparation',p_idempotency_key,request_digest,worker);
 IF claim->>'outcome'='completed_replay' THEN RETURN claim->'result';
 ELSIF claim->>'outcome'='active_lease_busy' THEN RAISE EXCEPTION 'festival_lifecycle_operation_busy'; END IF;
 operation_id:=(claim->>'operationId')::uuid; generation:=(claim->>'leaseGeneration')::integer;
 -- The runtime row is already locked by the worker and runtime_session_id has a
 -- unique settlement constraint, so resumed requests cannot create a sibling.
 result:=public._prepare_festival_settlement_worker_v7(p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
 settlement:=(result->>'settlementId')::uuid;
 UPDATE public.festival_lifecycle_operations SET settlement_id=settlement WHERE id=operation_id;
 RETURN public._complete_festival_lifecycle_operation(operation_id,worker,generation,result);
END $$;

ALTER FUNCTION public.finalise_festival_settlement(uuid,integer,uuid) RENAME TO _finalise_festival_settlement_worker_v7;
CREATE FUNCTION public.finalise_festival_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE worker uuid:=gen_random_uuid(); claim jsonb; op uuid; generation integer; runtime uuid; digest text; result jsonb;
BEGIN
 SELECT runtime_session_id INTO STRICT runtime FROM public.festival_financial_settlements WHERE id=p_settlement_id;
 IF NOT public._festival_lifecycle_authorised(runtime) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 digest:=public.festival_json_content_digest(jsonb_build_object('settlementId',p_settlement_id,
  'expectedVersion',p_expected_version,'idempotencyKey',p_idempotency_key,
  'calculationDigest',(SELECT calculation_digest FROM public.festival_financial_settlements WHERE id=p_settlement_id)),ARRAY[]::text[]);
 claim:=public._claim_festival_lifecycle_operation(runtime,p_settlement_id,'finalisation',p_idempotency_key,digest,worker,interval '5 minutes');
 IF claim->>'outcome'='completed_replay' THEN RETURN claim->'result';
 ELSIF claim->>'outcome'='active_lease_busy' THEN RAISE EXCEPTION 'festival_lifecycle_operation_busy'; END IF;
 op:=(claim->>'operationId')::uuid; generation:=(claim->>'leaseGeneration')::integer;
 -- The worker validates its frozen request, reconciles liabilities, executes
 -- effects using their original keys, and resumes its own finalisation request.
 result:=public._finalise_festival_settlement_worker_v7(p_settlement_id,p_expected_version,p_idempotency_key);
 IF result->>'status'='finalisation_failed' THEN
  PERFORM public._fail_festival_lifecycle_operation(op,worker,generation,jsonb_build_object('code','finalisation_requirements_incomplete','result',result));
  RETURN result;
 END IF;
 RETURN public._complete_festival_lifecycle_operation(op,worker,generation,result);
END $$;

CREATE OR REPLACE FUNCTION public._recover_festival_payments(p_settlement uuid,p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE line record; receipts integer; transactions integer; completed integer:=0; conflicts integer:=0; retryable integer:=0;
BEGIN
 FOR line IN SELECT l.* FROM public.festival_settlement_lines l WHERE l.settlement_id=p_settlement AND l.status IN('processing','failed') FOR UPDATE LOOP
  SELECT count(*),count(DISTINCT r.canonical_transaction_id) INTO receipts,transactions
   FROM public.festival_settlement_receipts r
   JOIN public.financial_transactions t ON t.id=r.canonical_transaction_id
   WHERE r.settlement_line_id=line.id;
  IF receipts=1 AND transactions=1 THEN
   UPDATE public.festival_settlement_lines SET status='paid',completed_at=coalesce(completed_at,now()) WHERE id=line.id;
   completed:=completed+1;
  ELSIF receipts=0 AND NOT EXISTS(SELECT 1 FROM public.financial_transactions t WHERE t.idempotency_key=line.calculation_metadata->>'paymentIdempotencyKey') THEN
   -- Only the normal payment executor may move money.  Pending means it can be
   -- safely claimed with the unchanged payment idempotency key.
   UPDATE public.festival_settlement_lines SET status='pending' WHERE id=line.id; retryable:=retryable+1;
  ELSE
   UPDATE public.festival_settlement_lines SET status='disputed' WHERE id=line.id; conflicts:=conflicts+1;
   INSERT INTO public.festival_recovery_quarantine(entity_type,entity_id,reason,evidence)
   VALUES('settlement_line',line.id,'ambiguous_payment_outcome',to_jsonb(line)) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('operationId',p_operation,'completedFromEvidence',completed,'retryable',retryable,'conflicts',conflicts);
END $$;

CREATE OR REPLACE FUNCTION public._recover_festival_effects(p_settlement uuid,p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e record; verified integer:=0; executed integer:=0;
BEGIN
 FOR e IN SELECT r.* FROM public.festival_settlement_effect_receipts r WHERE r.settlement_id=p_settlement AND r.status IN('pending','failed') FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM public.festival_settlement_effect_destinations d WHERE d.receipt_id=e.id AND d.evidence_digest=e.evidence_digest) THEN
   UPDATE public.festival_settlement_effect_receipts SET status='completed',last_error=NULL,completed_at=coalesce(completed_at,now()),
    destination_table='festival_settlement_effect_destinations',destination_record_id=(SELECT id FROM public.festival_settlement_effect_destinations WHERE receipt_id=e.id)
    WHERE id=e.id; verified:=verified+1;
  ELSIF public._execute_festival_effect(e.id) THEN executed:=executed+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('operationId',p_operation,'destinationsVerified',verified,'effectsExecuted',executed);
END $$;

REVOKE ALL ON FUNCTION public._prepare_festival_settlement_worker_v7(uuid,integer,uuid),
 public._finalise_festival_settlement_worker_v7(uuid,integer,uuid),public._recover_festival_payments(uuid,uuid),
 public._recover_festival_effects(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid),public.finalise_festival_settlement(uuid,integer,uuid) TO authenticated;
