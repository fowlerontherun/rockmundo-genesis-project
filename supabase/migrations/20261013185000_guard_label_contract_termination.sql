-- Apply a transactional lifecycle guard to every direct label contract status
-- update, not just the owner UI and approved RPCs. A direct Data API UPDATE
-- must not bypass the settlement calculation.
CREATE OR REPLACE FUNCTION public.guard_label_contract_termination()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_outstanding numeric;
BEGIN
 IF NEW.status='terminated' AND OLD.status IS DISTINCT FROM 'terminated' THEN
   -- Approved settlement routines are SECURITY DEFINER functions owned by
   -- postgres. Browser updates run as authenticated and are rejected.
   IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
     RAISE EXCEPTION 'LABEL_CONTRACT_TERMINATION_REQUIRES_SETTLEMENT_RPC'
       USING ERRCODE='42501';
   END IF;
   v_outstanding:=greatest(0,coalesce(OLD.advance_amount,0)-coalesce(OLD.recouped_amount,0));
   IF coalesce(NEW.termination_fee_paid,0)<v_outstanding THEN
     RAISE EXCEPTION 'UNRECOUPED_ADVANCE_REQUIRES_SETTLEMENT';
   END IF;
   IF NEW.terminated_at IS NULL THEN
     RAISE EXCEPTION 'TERMINATION_TIMESTAMP_REQUIRED';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_label_contract_termination() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enforce_label_contract_termination_settlement ON public.artist_label_contracts;
CREATE TRIGGER enforce_label_contract_termination_settlement
BEFORE UPDATE OF status ON public.artist_label_contracts
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.guard_label_contract_termination();
