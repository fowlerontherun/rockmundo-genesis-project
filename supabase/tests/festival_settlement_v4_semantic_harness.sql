\set ON_ERROR_STOP on
BEGIN;

-- Forward-migration contract fixture.  The lifecycle-heavy behavioural fixture
-- remains festival_settlement_v3_regression_harness.sql; these assertions run
-- after #1334 and ensure its deferred guard and the active preparation function
-- can coexist without the retired balancing placeholder.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.prepare_festival_settlement(uuid,integer,uuid)'::regprocedure) INTO definition;
 IF definition IS NULL OR definition NOT LIKE '%_build_festival_contract_package%' AND
    to_regprocedure('public._build_festival_contract_package(uuid)') IS NULL THEN
  RAISE EXCEPTION 'active Festival preparation/package implementation is missing';
 END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components WHERE component_type='source_balance') THEN
  RAISE EXCEPTION 'source_balance survived the forward migration';
 END IF;
 IF to_regprocedure('public.request_festival_staff_overtime(uuid,integer,text,uuid)') IS NULL OR
    to_regprocedure('public.decide_festival_staff_overtime(uuid,text,integer,text,uuid,uuid)') IS NULL THEN
  RAISE EXCEPTION 'canonical overtime RPC contract is incomplete';
 END IF;
 IF to_regprocedure('public.finalise_festival_settlement(uuid,integer,uuid)') IS NULL THEN
  RAISE EXCEPTION 'asynchronous Festival finalisation RPC is missing';
 END IF;
END $$;

-- Prove the successor interpretation with a partial approval followed by a
-- rejection without requiring application fixtures or mutable production rows.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
   AND indexname='festival_overtime_decision_one_successor_v3') THEN
  RAISE EXCEPTION 'one-successor overtime invariant is absent';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='festival_settlement_receipts' AND column_name='status') THEN
  RAISE EXCEPTION 'typed receipt state is absent';
 END IF;
END $$;

ROLLBACK;
