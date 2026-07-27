-- Make the private lifecycle lease protocol usable by authorised public
-- workers while retaining its database privilege boundary (forward-only).

CREATE OR REPLACE FUNCTION public._claim_festival_lifecycle_operation(
 p_runtime uuid,p_settlement uuid,p_operation text,p_key uuid,p_digest text,
 p_worker uuid,p_lease interval DEFAULT interval '2 minutes') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_lifecycle_operations%ROWTYPE;
 active public.festival_lifecycle_operations%ROWTYPE;
 outcome text;
BEGIN
 -- This routine is an internal capability: PUBLIC/anon/authenticated have no
 -- EXECUTE privilege.  Checking session_user here made an authorised owner
 -- wrapper unusable because nested SECURITY DEFINER calls retain session_user.
 IF p_worker IS NULL OR p_lease IS NULL OR p_lease <= interval '0 seconds' THEN
  RAISE EXCEPTION 'festival_lifecycle_claim_invalid';
 END IF;
 IF p_operation NOT IN ('runtime_completion','settlement_preparation','payment_execution',
   'finalisation','effect_execution','snapshot_rebuild','reconciliation') THEN
  RAISE EXCEPTION 'festival_lifecycle_operation_unknown';
 END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(p_runtime::text||':'||p_operation,0));
 SELECT * INTO active FROM public.festival_lifecycle_operations
  WHERE runtime_session_id=p_runtime AND operation=p_operation AND status='processing'
  ORDER BY created_at,id FOR UPDATE LIMIT 1;

 -- An unexpired lease is busy even when a caller happens to reuse its owner
 -- UUID. Lease generations, rather than possession of a UUID, fence workers.
 IF active.id IS NOT NULL AND active.lease_expires_at>clock_timestamp() THEN
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',active.id,
    'leaseExpiresAt',active.lease_expires_at,'attemptCount',active.attempt_count);
 END IF;
 -- An expired preparation is resumable only with its original durable key.
 IF active.id IS NOT NULL AND active.idempotency_key IS DISTINCT FROM p_key THEN
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',active.id,
    'leaseExpiresAt',active.lease_expires_at,'leaseExpired',true);
 END IF;

 INSERT INTO public.festival_lifecycle_operations
   (runtime_session_id,settlement_id,operation,idempotency_key,request_digest)
 VALUES(p_runtime,p_settlement,p_operation,p_key,p_digest)
 ON CONFLICT(runtime_session_id,operation,idempotency_key) DO NOTHING;
 SELECT * INTO STRICT o FROM public.festival_lifecycle_operations
  WHERE runtime_session_id=p_runtime AND operation=p_operation
    AND idempotency_key=p_key FOR UPDATE;

 IF o.request_digest IS DISTINCT FROM p_digest OR o.settlement_id IS DISTINCT FROM p_settlement THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='festival_lifecycle_idempotency_conflict',
   DETAIL=format('operation=%s runtime=%s settlement=%s key=%s',p_operation,p_runtime,
     coalesce(p_settlement::text,'null'),p_key);
 END IF;
 IF o.status='completed' THEN
  RETURN jsonb_build_object('outcome','completed_replay','operationId',o.id,
    'result',o.result,'attemptCount',o.attempt_count);
 END IF;
 IF o.status='processing' AND o.lease_expires_at>clock_timestamp() THEN
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',o.id,
    'leaseExpiresAt',o.lease_expires_at,'attemptCount',o.attempt_count);
 END IF;

 outcome:=CASE WHEN o.attempt_count=0 THEN 'newly_claimed' ELSE 'expired_lease_resumed' END;
 UPDATE public.festival_lifecycle_operations SET status='processing',
  lease_owner=p_worker,lease_expires_at=clock_timestamp()+p_lease,
  attempt_count=attempt_count+1,lease_generation=lease_generation+1,
  started_at=coalesce(started_at,clock_timestamp()),last_error=NULL,
  updated_at=clock_timestamp()
 WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('outcome',outcome,'operationId',o.id,
   'leaseGeneration',o.lease_generation,'attemptCount',o.attempt_count);
END $$;

REVOKE ALL ON FUNCTION public._claim_festival_lifecycle_operation(
 uuid,uuid,text,uuid,text,uuid,interval) FROM PUBLIC,anon,authenticated;

-- A terminal paid line always needs canonical money-movement evidence.  The
-- former liability exception allowed unaudited paid resolutions on inserts.
CREATE OR REPLACE FUNCTION public._festival_payment_terminal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_terminal boolean:=false; auth_id uuid; receipt_id uuid;
 transaction_id uuid; existing text; expected_version integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_terminal:=OLD.status IN('paid','waived','written_off','cancelled');
 END IF;
 IF old_terminal AND NEW.status IS DISTINCT FROM OLD.status THEN
  RAISE EXCEPTION 'festival_payment_terminal_state_immutable';
 END IF;
 IF NEW.status NOT IN('paid','waived','written_off','cancelled') THEN RETURN NEW; END IF;
 SELECT terminal_state INTO existing FROM public.festival_payment_terminal_resolutions
  WHERE settlement_line_id=NEW.id;
 IF existing IS NOT NULL THEN
  IF existing IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'festival_payment_multiple_terminal_states'; END IF;
  RETURN NEW;
 END IF;
 expected_version:=CASE WHEN TG_OP='UPDATE' THEN OLD.version ELSE NEW.version END;
 IF NEW.status IN('waived','written_off','cancelled') THEN
  SELECT id INTO auth_id FROM public.festival_payment_resolution_authorisations
   WHERE settlement_line_id=NEW.id AND terminal_state=NEW.status
     AND expected_line_version=expected_version;
  IF auth_id IS NULL THEN RAISE EXCEPTION 'festival_payment_resolution_evidence_required'; END IF;
 ELSE
  SELECT r.id,r.canonical_transaction_id INTO receipt_id,transaction_id
   FROM public.festival_settlement_receipts r
   JOIN public.financial_transactions t ON t.id=r.canonical_transaction_id
   WHERE r.settlement_line_id=NEW.id
   ORDER BY r.created_at,r.id LIMIT 1;
  IF receipt_id IS NULL OR transaction_id IS NULL THEN RAISE EXCEPTION 'festival_payment_receipt_required'; END IF;
 END IF;
 INSERT INTO public.festival_payment_terminal_resolutions
  (settlement_line_id,terminal_state,authorisation_id,canonical_receipt_id,canonical_transaction_id)
 VALUES(NEW.id,NEW.status,auth_id,receipt_id,transaction_id);
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public._festival_payment_terminal_guard() FROM PUBLIC,anon,authenticated;
