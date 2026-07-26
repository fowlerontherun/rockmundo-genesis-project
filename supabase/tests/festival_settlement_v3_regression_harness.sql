\set ON_ERROR_STOP on
BEGIN;

-- SQL-precedence regression: supplier evidence belongs exclusively to an
-- operations plan.  Every plan branch deliberately owns its parentheses.
DO $$
DECLARE qualified text[];
BEGIN
 SELECT array_agg(plan_type ORDER BY plan_type) INTO qualified
 FROM (VALUES ('artist_programme'),('operations_plan'),('sponsorship_plan'),('ticket_plan')) p(plan_type)
 WHERE (p.plan_type='ticket_plan' AND false)
    OR (p.plan_type='artist_programme' AND false)
    OR (p.plan_type='operations_plan' AND (false OR true))
    OR (p.plan_type='sponsorship_plan' AND false);
 IF qualified IS DISTINCT FROM ARRAY['operations_plan']::text[] THEN
  RAISE EXCEPTION 'supplier evidence escaped the operations-plan branch: %',qualified;
 END IF;

 IF NOT EXISTS (SELECT 1 FROM pg_attribute
   WHERE attrelid='public.festival_plan_edition_backfill_audit'::regclass
     AND attname='plan_classification') THEN
  RAISE EXCEPTION 'plan usage classification missing';
 END IF;
END $$;

DO $$ DECLARE body text;
BEGIN
 body:=pg_get_functiondef('public._build_festival_contract_package(uuid)'::regprocedure);
 IF position(quote_literal('bookingStatus') in body)=0
    OR position(quote_literal('cancellationReason') in body)=0
    OR position(quote_literal('applicableClauseVersion') in body)=0 THEN
  RAISE EXCEPTION 'cancelled artist settlement evidence missing';
 END IF;
 IF position(quote_literal('shifts') in body)=0
    OR position(quote_literal('overtimeRequestId') in body)=0
    OR position(quote_literal('overtimeDecisionId') in body)=0 THEN
  RAISE EXCEPTION 'deduplicated staff shift evidence missing';
 END IF;
END $$;

ROLLBACK;
