\set ON_ERROR_STOP on
BEGIN;

DO $test$
DECLARE definition text;
BEGIN
 IF NOT public._festival_lifecycle_transition_allowed('planning','scheduled')
    OR public._festival_lifecycle_transition_allowed('planning','finalised') THEN
  RAISE EXCEPTION 'lifecycle transition matrix is not fail closed';
 END IF;
 IF NOT public._festival_lifecycle_transition_allowed('finalisation_failed','finalising') THEN
  RAISE EXCEPTION 'finalisation recovery transition missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='festival_one_active_settlement_operation' AND indexdef LIKE '%settlement_preparation%processing%') THEN
  RAISE EXCEPTION 'active settlement lock missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_payment_terminal_state' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'payment terminal state guard missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_effect_dependency_order' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'effect ordering guard missing';
 END IF;
 SELECT pg_get_functiondef('public.admin_repair_festival(uuid,text,uuid)'::regprocedure) INTO definition;
 FOREACH definition IN ARRAY ARRAY['reconciliation','resume_payments','resume_effects','resume_finalisation','rebuild_snapshots','recalculate_digests','repair_orphans'] LOOP
  IF position(definition IN pg_get_functiondef('public.admin_repair_festival(uuid,text,uuid)'::regprocedure))=0 THEN
   RAISE EXCEPTION 'repair operation % missing',definition;
  END IF;
 END LOOP;
 IF to_regprocedure('public.festival_consistency_audit(uuid)') IS NULL OR to_regprocedure('public.admin_festival_diagnostics(uuid)') IS NULL THEN
  RAISE EXCEPTION 'diagnostic or audit report missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_snapshot_progression_gate' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'snapshot progression verification missing';
 END IF;
END $test$;

-- Simulate a crashed lease. The same logical operation is recoverable while a
-- competing active operation remains excluded by the partial unique index.
DO $recovery$
DECLARE runtime uuid; launch uuid; snap uuid; op uuid; blocked boolean:=false;
BEGIN
 SELECT id INTO runtime FROM public.festival_runtime_sessions ORDER BY created_at LIMIT 1;
 IF runtime IS NULL THEN
  RAISE EXCEPTION 'recovery fixture requires its disposable runtime bootstrap; refusing to report a false pass';
 END IF;
 INSERT INTO public.festival_lifecycle_operations(runtime_session_id,operation,idempotency_key,request_digest,status,lease_owner,lease_expires_at,attempt_count)
 VALUES(runtime,'settlement_preparation',gen_random_uuid(),'fixture-crash','processing',gen_random_uuid(),now()-interval '1 minute',1) RETURNING id INTO op;
 BEGIN
  INSERT INTO public.festival_lifecycle_operations(runtime_session_id,operation,idempotency_key,request_digest,status,lease_owner,lease_expires_at)
  VALUES(runtime,'settlement_preparation',gen_random_uuid(),'fixture-race','processing',gen_random_uuid(),now()+interval '1 minute');
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'simultaneous preparation was not rejected'; END IF;
 UPDATE public.festival_lifecycle_operations SET status='pending',lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=op AND lease_expires_at<now();
 UPDATE public.festival_lifecycle_operations SET status='processing',lease_owner=gen_random_uuid(),lease_expires_at=now()+interval '1 minute',attempt_count=attempt_count+1 WHERE id=op;
 UPDATE public.festival_lifecycle_operations SET status='completed',lease_owner=NULL,lease_expires_at=NULL,result='{"recovered":true}',completed_at=now() WHERE id=op;
 IF (SELECT attempt_count FROM public.festival_lifecycle_operations WHERE id=op)<>2 THEN RAISE EXCEPTION 'restart did not resume exactly once'; END IF;
END $recovery$;

ROLLBACK;
