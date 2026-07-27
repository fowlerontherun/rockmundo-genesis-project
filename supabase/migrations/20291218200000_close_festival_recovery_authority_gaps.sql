-- Close authority and concurrency gaps in operational lifecycle recovery.
-- Forward-only: the preceding recovery migrations remain an immutable record.

-- SECURITY DEFINER changes current_user to the function owner.  Trust must be
-- based on the connection/JWT identity, otherwise every authenticated caller
-- of a public definer function is accidentally treated as an internal worker.
CREATE OR REPLACE FUNCTION public._festival_worker_trusted() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT session_user IN ('postgres','supabase_admin','service_role')
    OR coalesce(nullif(current_setting('request.jwt.claim.role',true),'')='service_role',false)
$$;

CREATE OR REPLACE FUNCTION public._festival_lifecycle_authorised(p_runtime uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public._festival_worker_trusted()
    OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR public._festival_runtime_owner(p_runtime,public._caller_profile_id())
$$;

-- Serialize creation by logical operation identity before INSERT.  In
-- particular this turns the partial settlement-preparation uniqueness rule
-- into a canonical `active_lease_busy` result instead of either a missing-row
-- STRICT error or a raw unique violation.
CREATE OR REPLACE FUNCTION public._claim_festival_lifecycle_operation(
 p_runtime uuid,p_settlement uuid,p_operation text,p_key uuid,p_digest text,
 p_worker uuid,p_lease interval DEFAULT interval '2 minutes') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_lifecycle_operations%ROWTYPE; active public.festival_lifecycle_operations%ROWTYPE; outcome text;
BEGIN
 IF NOT public._festival_worker_trusted() THEN RAISE EXCEPTION 'festival_worker_forbidden'; END IF;
 IF p_operation NOT IN ('runtime_completion','settlement_preparation','payment_execution','finalisation','effect_execution','snapshot_rebuild','reconciliation')
 THEN RAISE EXCEPTION 'festival_lifecycle_operation_unknown'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_runtime::text||':'||p_operation,0));
 SELECT * INTO active FROM public.festival_lifecycle_operations
  WHERE runtime_session_id=p_runtime AND operation=p_operation AND status='processing'
  ORDER BY created_at FOR UPDATE LIMIT 1;
 IF active.id IS NOT NULL AND active.idempotency_key IS DISTINCT FROM p_key THEN
  -- Only the original durable identity may resume an expired request.  A new
  -- key is never allowed to steal it or create a sibling settlement.
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',active.id,
   'leaseExpiresAt',active.lease_expires_at,'leaseExpired',active.lease_expires_at<=clock_timestamp());
 END IF;
 INSERT INTO public.festival_lifecycle_operations(runtime_session_id,settlement_id,operation,idempotency_key,request_digest)
 VALUES(p_runtime,p_settlement,p_operation,p_key,p_digest) ON CONFLICT(runtime_session_id,operation,idempotency_key) DO NOTHING;
 SELECT * INTO STRICT o FROM public.festival_lifecycle_operations
  WHERE runtime_session_id=p_runtime AND operation=p_operation AND idempotency_key=p_key FOR UPDATE;
 IF o.request_digest IS DISTINCT FROM p_digest OR o.settlement_id IS DISTINCT FROM p_settlement THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='festival_lifecycle_idempotency_conflict',
   DETAIL=format('operation=%s runtime=%s settlement=%s key=%s',p_operation,p_runtime,coalesce(p_settlement::text,'null'),p_key);
 END IF;
 IF o.status='completed' THEN
  RETURN jsonb_build_object('outcome','completed_replay','operationId',o.id,'result',o.result,'attemptCount',o.attempt_count);
 END IF;
 IF o.status='processing' AND o.lease_expires_at>clock_timestamp() AND o.lease_owner IS DISTINCT FROM p_worker THEN
  RETURN jsonb_build_object('outcome','active_lease_busy','operationId',o.id,'leaseExpiresAt',o.lease_expires_at);
 END IF;
 outcome:=CASE WHEN o.attempt_count=0 THEN 'newly_claimed' ELSE 'expired_lease_resumed' END;
 UPDATE public.festival_lifecycle_operations SET status='processing',lease_owner=p_worker,
  lease_expires_at=clock_timestamp()+p_lease,attempt_count=attempt_count+1,
  lease_generation=lease_generation+1,started_at=coalesce(started_at,clock_timestamp()),
  last_error=NULL,updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('outcome',outcome,'operationId',o.id,'leaseGeneration',o.lease_generation,'attemptCount',o.attempt_count);
END $$;

-- A terminal resolution is immutable evidence.  The earlier UPSERT was
-- idempotent, but an UPDATE privilege or future trigger change could mutate it.
CREATE OR REPLACE FUNCTION public._festival_terminal_resolution_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'festival_payment_terminal_resolution_immutable';
END $$;
DROP TRIGGER IF EXISTS festival_terminal_resolution_immutable ON public.festival_payment_terminal_resolutions;
CREATE TRIGGER festival_terminal_resolution_immutable BEFORE UPDATE OR DELETE
 ON public.festival_payment_terminal_resolutions FOR EACH ROW
 EXECUTE FUNCTION public._festival_terminal_resolution_immutable();
DROP TRIGGER IF EXISTS festival_resolution_authorisation_immutable ON public.festival_payment_resolution_authorisations;
CREATE TRIGGER festival_resolution_authorisation_immutable BEFORE UPDATE OR DELETE
 ON public.festival_payment_resolution_authorisations FOR EACH ROW
 EXECUTE FUNCTION public._festival_terminal_resolution_immutable();

-- Evidence is checked against the exact line version being resolved.
ALTER TABLE public.festival_settlement_lines
 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version>0);
CREATE OR REPLACE FUNCTION public._festival_settlement_line_bump_version() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN NEW.version:=OLD.version+1; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_settlement_line_version ON public.festival_settlement_lines;
CREATE TRIGGER festival_settlement_line_version BEFORE UPDATE ON public.festival_settlement_lines
 FOR EACH ROW EXECUTE FUNCTION public._festival_settlement_line_bump_version();

CREATE OR REPLACE FUNCTION public._festival_payment_terminal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_terminal boolean:=false; auth_id uuid; receipt_id uuid; transaction_id uuid; existing text;
BEGIN
 IF TG_OP='UPDATE' THEN old_terminal:=OLD.status IN('paid','waived','written_off','cancelled'); END IF;
 IF old_terminal AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'festival_payment_terminal_state_immutable'; END IF;
 IF NEW.status NOT IN('paid','waived','written_off','cancelled') THEN RETURN NEW; END IF;
 SELECT terminal_state INTO existing FROM public.festival_payment_terminal_resolutions WHERE settlement_line_id=NEW.id;
 IF existing IS NOT NULL THEN
  IF existing IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'festival_payment_multiple_terminal_states'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.status IN('waived','written_off','cancelled') THEN
  SELECT id INTO auth_id FROM public.festival_payment_resolution_authorisations
   WHERE settlement_line_id=NEW.id AND terminal_state=NEW.status
     AND expected_line_version=CASE WHEN TG_OP='UPDATE' THEN OLD.version ELSE NEW.version END;
  IF auth_id IS NULL THEN RAISE EXCEPTION 'festival_payment_resolution_evidence_required'; END IF;
 ELSE
  SELECT r.id,r.canonical_transaction_id INTO receipt_id,transaction_id
   FROM public.festival_settlement_receipts r JOIN public.financial_transactions t ON t.id=r.canonical_transaction_id
   WHERE r.settlement_line_id=NEW.id ORDER BY r.created_at LIMIT 1;
  IF receipt_id IS NULL THEN RAISE EXCEPTION 'festival_payment_receipt_required'; END IF;
 END IF;
 INSERT INTO public.festival_payment_terminal_resolutions(settlement_line_id,terminal_state,authorisation_id,canonical_receipt_id,canonical_transaction_id)
 VALUES(NEW.id,NEW.status,auth_id,receipt_id,transaction_id);
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public._festival_worker_trusted(),public._festival_lifecycle_authorised(uuid),
 public._claim_festival_lifecycle_operation(uuid,uuid,text,uuid,text,uuid,interval),
 public._festival_terminal_resolution_immutable(),public._festival_settlement_line_bump_version(),
 public._festival_payment_terminal_guard()
 FROM PUBLIC,anon,authenticated;
