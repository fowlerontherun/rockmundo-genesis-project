\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public._assert_festival_settlement_source_chain(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'source-chain assertion missing';
  END IF;
  IF position('festival_public_editions' in pg_get_functiondef('public._assert_festival_settlement_source_chain(uuid,text,uuid)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'source-chain assertion does not traverse public edition';
  END IF;
  IF position('festival_settlement_staff_checkout_missing' in pg_get_functiondef('public._assert_festival_settlement_evidence(uuid)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'missing checkout is not blocking';
  END IF;
  IF to_regprocedure('public.request_festival_overtime(uuid,integer,text,uuid)') IS NULL
     OR to_regprocedure('public.decide_festival_overtime(uuid,integer,text,uuid)') IS NULL
     OR to_regprocedure('public.supersede_festival_overtime_decision(uuid,integer,text,uuid)') IS NULL
     OR to_regprocedure('public.get_festival_overtime_history(uuid)') IS NULL THEN
    RAISE EXCEPTION 'append-only overtime API incomplete';
  END IF;
  IF to_regprocedure('public.process_festival_settlement(uuid,integer,uuid)') IS NULL
     OR to_regprocedure('public.retry_festival_settlement_liabilities(uuid,integer,uuid)') IS NULL THEN
    RAISE EXCEPTION 'settlement processing API incomplete';
  END IF;
  IF position('EXIT; -- Never jump an insolvent priority tier' in pg_get_functiondef('public.process_festival_settlement(uuid,integer,uuid)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'insolvency does not block lower priorities';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='festival_settlement_receipt_transfer_key') THEN
    RAISE EXCEPTION 'unique transfer key missing';
  END IF;
  IF EXISTS(SELECT 1 FROM public.festival_payment_priorities WHERE priority NOT BETWEEN 1 AND 9) THEN
    RAISE EXCEPTION 'invalid liability priority';
  END IF;
END $$;

-- Package construction must be deterministic and contain every required key.
DO $$ DECLARE body text:=pg_get_functiondef('public._build_festival_contract_package(uuid)'::regprocedure); k text;
BEGIN
 FOREACH k IN ARRAY ARRAY['artistBookingContracts','staffContracts','supplierContracts','sponsorContracts',
   'merchandiseContracts','ticketRefundPolicies','bandSplitAgreements','taxRules'] LOOP
   IF position(quote_literal(k) in body)=0 THEN RAISE EXCEPTION 'contract package section missing: %',k; END IF;
 END LOOP;
END $$;

ROLLBACK;
