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

-- Canonical-evidence contract. The disposable lifecycle data exercised by the
-- preceding Festival harnesses reaches this gate only after a fully migrated
-- database reset; these assertions prevent an adapter or fallback from making
-- that lifecycle appear successful.
DO $canonical$
DECLARE guard_definition text; freezer_definition text; projection_definition text;
BEGIN
 SELECT pg_get_functiondef('public._festival_component_provenance_canonical()'::regprocedure) INTO guard_definition;
 SELECT pg_get_functiondef('public._freeze_festival_staff_evidence_v62(uuid)'::regprocedure) INTO freezer_definition;
 SELECT pg_get_functiondef('public.festival_settlement_review_projection_v1(uuid)'::regprocedure) INTO projection_definition;
 IF to_regprocedure('public._festival_component_provenance_v6()') IS NOT NULL THEN
  RAISE EXCEPTION 'manufactured provenance trigger function remains installed';
 END IF;
 IF guard_definition ~ 'coalesce' OR guard_definition !~ 'num_nonnulls' OR guard_definition !~ 'eligible' THEN
  RAISE EXCEPTION 'component provenance guard manufactures or fails to require semantic evidence';
 END IF;
 IF freezer_definition !~ '_resolve_festival_staff_shift_evidence'
    OR freezer_definition ~ 'festival_staff_overtime_approvals'
    OR freezer_definition !~ 'festival_staff_overtime_requests_v3'
    OR freezer_definition !~ 'festival_staff_overtime_decisions_v3'
    OR freezer_definition !~ 'supersessionChainDigest' THEN
  RAISE EXCEPTION 'staff freezer is not connected exclusively to canonical evidence';
 END IF;
 IF projection_definition ~ 'to_jsonb' OR projection_definition !~ 'schemaVersion'
    OR projection_definition !~ 'semanticComponents' OR projection_definition !~ 'bandSplits' THEN
  RAISE EXCEPTION 'review projection is not an explicit stable projection';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.festival_runtime_sessions'::regclass
   AND a.attname IN ('artist_programme_id','operations_plan_id','sponsorship_plan_id','ticket_plan_id')
   AND a.attisdropped) OR (SELECT count(*) FROM pg_attribute a
   WHERE a.attrelid='public.festival_runtime_sessions'::regclass AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname IN ('artist_programme_id','operations_plan_id','sponsorship_plan_id','ticket_plan_id'))<>4 THEN
  RAISE EXCEPTION 'runtime does not store all four exact Festival plan identities';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='festival_finalisation_request_lease_coherent'
   AND convalidated) THEN RAISE EXCEPTION 'finalisation lease constraint is not validated'; END IF;
END $canonical$;

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
