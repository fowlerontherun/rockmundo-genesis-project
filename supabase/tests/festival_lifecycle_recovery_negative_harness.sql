\set ON_ERROR_STOP on
BEGIN;
DO $tests$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public._claim_festival_lifecycle_operation(uuid,uuid,text,uuid,text,uuid,interval)'::regprocedure);
 IF position('FOR UPDATE' IN definition)=0 OR position('pg_advisory_xact_lock' IN definition)=0 OR position('active_lease_busy' IN definition)=0 OR position('festival_lifecycle_idempotency_conflict' IN definition)=0 THEN
  RAISE EXCEPTION 'claim helper does not atomically cover busy leases and digest conflicts'; END IF;
 IF position('_festival_worker_trusted' IN definition)>0 THEN
  RAISE EXCEPTION 'private claim helper rejects authorised owner wrappers by session identity'; END IF;
 IF position($needle$o.lease_expires_at>clock_timestamp()$needle$ IN definition)=0 THEN
  RAISE EXCEPTION 'claim helper can steal an active lease when its worker UUID is reused'; END IF;
 definition:=pg_get_functiondef('public._festival_worker_trusted()'::regprocedure);
 IF position('session_user' IN definition)=0 OR position('current_user' IN definition)>0 THEN
  RAISE EXCEPTION 'SECURITY DEFINER identity can still grant worker authority'; END IF;
 definition:=pg_get_functiondef('public._festival_physical_lifecycle_state(uuid,uuid)'::regprocedure);
 IF position('festival_lifecycle_state_unknown' IN definition)=0 OR position('ELSE p_from' IN definition)>0 THEN RAISE EXCEPTION 'unknown lifecycle states do not fail closed'; END IF;
 IF has_function_privilege('authenticated','public._claim_festival_lifecycle_operation(uuid,uuid,text,uuid,text,uuid,interval)','EXECUTE') THEN RAISE EXCEPTION 'authenticated role can invoke private claim helper'; END IF;
 definition:=pg_get_triggerdef((SELECT oid FROM pg_trigger WHERE tgname='festival_payment_terminal_state' AND NOT tgisinternal));
 IF position('INSERT OR UPDATE OF status' IN definition)=0 THEN RAISE EXCEPTION 'terminal trigger does not cover inserts'; END IF;
 definition:=pg_get_functiondef('public._festival_payment_terminal_guard()'::regprocedure);
 IF position('TG_OP' IN definition)=0 OR position('expected_line_version' IN definition)=0 OR position('festival_payment_resolution_evidence_required' IN definition)=0
    OR position('festival_payment_receipt_required' IN definition)=0 OR position('financial_transactions' IN definition)=0 THEN
  RAISE EXCEPTION 'terminal trigger is unsafe or unaudited'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_terminal_resolution_immutable' AND NOT tgisinternal)
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_resolution_authorisation_immutable' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'payment resolution evidence is mutable'; END IF;
 definition:=pg_get_triggerdef((SELECT oid FROM pg_trigger WHERE tgname='festival_effect_dependency_order' AND NOT tgisinternal));
 IF position('BEFORE INSERT OR UPDATE OF status' IN definition)=0 THEN RAISE EXCEPTION 'effect insert bypass remains'; END IF;
 IF (SELECT count(*) FROM public.festival_effect_dependency_rules)<15 THEN RAISE EXCEPTION 'effect dependency graph incomplete'; END IF;
 definition:=pg_get_functiondef('public._recover_festival_payments(uuid,uuid)'::regprocedure);
 IF position('ambiguous_payment_outcome' IN definition)=0 OR position('canonical_transaction_id' IN definition)=0 THEN RAISE EXCEPTION 'payment recovery can duplicate an ambiguous payment'; END IF;
 definition:=pg_get_functiondef('public.festival_consistency_audit(uuid)'::regprocedure);
 IF position('_festival_lifecycle_authorised' IN definition)=0 THEN RAISE EXCEPTION 'consistency audit leaks by runtime UUID'; END IF;
END $tests$;
ROLLBACK;
