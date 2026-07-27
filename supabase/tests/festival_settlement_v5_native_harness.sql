\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE preparation text; finalisation text;
BEGIN
 SELECT pg_get_functiondef('public.prepare_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO preparation;
 SELECT pg_get_functiondef('public.finalise_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO finalisation;
 IF preparation LIKE '%_prepare_festival_settlement_before_semantic_v4%' OR preparation LIKE '%_prepare_festival_settlement_native_v2%' THEN
   RAISE EXCEPTION 'preparation still delegates to the semantic-v4 adapter'; END IF;
 IF preparation NOT LIKE '%artist_programme%' OR preparation NOT LIKE '%operations_plan%' OR
    preparation NOT LIKE '%sponsorship_plan%' OR preparation NOT LIKE '%ticket_plan%' THEN
   RAISE EXCEPTION 'preparation does not validate every exact plan'; END IF;
 IF preparation LIKE '%source_balance%' OR preparation LIKE '%source_amount_adjustment%' THEN
   RAISE EXCEPTION 'preparation contains a renamed balance plug'; END IF;
 IF finalisation LIKE '%PERFORM public._finalise_festival_settlement_v3%' THEN
   RAISE EXCEPTION 'finalisation still invokes the settled-only helper after changing state'; END IF;
 IF to_regclass('public.festival_settlement_finalisation_requests') IS NULL OR
    to_regclass('public.festival_settlement_effect_destinations') IS NULL THEN
   RAISE EXCEPTION 'durable finalisation contract is incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='festival_settlement_finalisation_requests' AND column_name='lease_expires_at') THEN
   RAISE EXCEPTION 'finalisation leases are not durable'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components
   WHERE component_type IN('source_balance','source_amount_adjustment')) THEN
   RAISE EXCEPTION 'balance plug survived native migration'; END IF;
END $$;

ROLLBACK;
