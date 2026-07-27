\set ON_ERROR_STOP on
BEGIN;

DO $fixture$
DECLARE preparation text; finalisation text; forbidden text;
BEGIN
 SELECT pg_get_functiondef('public.prepare_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO preparation;
 SELECT pg_get_functiondef('public.finalise_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO finalisation;
 forbidden := '_prepare_festival_settlement_before_semantic_v4|_prepare_festival_settlement_native_v2|source_balance|source_amount_adjustment';
 IF preparation ~ forbidden THEN RAISE EXCEPTION 'active preparation contains an adapter or balance plug'; END IF;
 IF (SELECT count(*) FROM regexp_matches(preparation, '_assert_festival_plan_identity_ready', 'g')) <> 4 THEN
   RAISE EXCEPTION 'active preparation must validate exactly four plan identities'; END IF;
 IF preparation !~ 'festival_settlement_component_sum_mismatch' THEN
   RAISE EXCEPTION 'active preparation does not enforce semantic equality'; END IF;
 IF finalisation !~ $$status[[:space:]]*=[[:space:]]*'finalising'$$ OR finalisation !~ $$status[[:space:]]*=[[:space:]]*'finalised'$$
    OR finalisation !~ $$status[[:space:]]*=[[:space:]]*'finalisation_failed'$$ THEN
   RAISE EXCEPTION 'durable finalisation state machine is incomplete'; END IF;
 IF finalisation ~ '_finalise_festival_settlement_v3' THEN RAISE EXCEPTION 'legacy finaliser remains active'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='festival_settlement_finalisation_requests' AND column_name='expected_version' AND is_nullable='NO') THEN
   RAISE EXCEPTION 'durable finalisation request does not freeze expected version'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='festival_component_total_guard' AND tgenabled<>'D') THEN
   RAISE EXCEPTION 'component total transaction guard missing'; END IF;
 IF EXISTS (SELECT 1 FROM public.festival_settlement_effect_receipts r WHERE r.status='completed' AND NOT EXISTS (
   SELECT 1 FROM public.festival_settlement_effect_destinations d WHERE d.receipt_id=r.id
    AND d.id=r.destination_record_id AND d.evidence_digest=r.evidence_digest AND d.destination_kind=r.effect_type)) THEN
   RAISE EXCEPTION 'an unverified historical effect remains completed'; END IF;
END $fixture$;

-- The guard itself must name every prohibited placeholder; behavioural line
-- equality is exercised by the deferred constraint in the disposable transaction.
DO $guard$
DECLARE definition text; component text;
BEGIN
 SELECT pg_get_functiondef('public._festival_native_component_guard()'::regprocedure) INTO definition;
 FOREACH component IN ARRAY ARRAY['source_balance','source_amount_adjustment','minimum_adjustment',
   'royalty_rounding_adjustment','authorised_manual_adjustment'] LOOP
  IF position(component IN definition)=0 THEN RAISE EXCEPTION 'component guard omits %',component; END IF;
 END LOOP;
END $guard$;

ROLLBACK;
