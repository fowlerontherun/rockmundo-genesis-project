\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE preparation text; finalisation text;
BEGIN
 SELECT pg_get_functiondef('public.prepare_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO preparation;
 SELECT pg_get_functiondef('public.finalise_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO finalisation;
 IF preparation LIKE '%_prepare_festival_settlement_before_semantic_v4%' THEN
   RAISE EXCEPTION 'preparation still delegates to the semantic-v4 adapter'; END IF;
 IF preparation NOT LIKE '%artist_programme%' OR preparation NOT LIKE '%operations_plan%' OR
    preparation NOT LIKE '%sponsorship_plan%' OR preparation NOT LIKE '%ticket_plan%' THEN
   RAISE EXCEPTION 'preparation does not validate every exact plan'; END IF;
 IF finalisation LIKE '%PERFORM public._finalise_festival_settlement_v3%' THEN
   RAISE EXCEPTION 'finalisation still invokes the settled-only helper after changing state'; END IF;
 IF to_regclass('public.festival_settlement_finalisation_requests') IS NULL OR
    to_regclass('public.festival_settlement_effect_destinations') IS NULL THEN
   RAISE EXCEPTION 'durable finalisation contract is incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components
   WHERE component_type IN('source_balance','source_amount_adjustment')) THEN
   RAISE EXCEPTION 'balance plug survived native migration'; END IF;
END $$;

ROLLBACK;
