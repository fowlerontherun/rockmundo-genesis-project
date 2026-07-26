-- Phase 7B disposable-database runtime contract. Fixtures are intentionally rolled back.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.launch_festival(uuid,integer,integer,uuid)') IS NULL THEN RAISE EXCEPTION 'launch RPC missing'; END IF;
 IF to_regprocedure('public.purchase_festival_tickets(uuid,uuid,integer,uuid)') IS NULL THEN RAISE EXCEPTION 'purchase RPC missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_launch_snapshots_immutable') THEN RAISE EXCEPTION 'immutable snapshot trigger missing'; END IF;
 IF has_table_privilege('anon','public.festival_ticket_inventory','INSERT') THEN RAISE EXCEPTION 'anonymous inventory mutation exposed'; END IF;
 IF has_table_privilege('authenticated','public.festival_issued_tickets','INSERT') THEN RAISE EXCEPTION 'buyer ticket issuance exposed'; END IF;
 IF has_function_privilege('anon','public.purchase_festival_tickets(uuid,uuid,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anonymous purchase exposed'; END IF;
END $$;
-- Full launch, rollback injection, concurrent-last-ticket and finance assertions run in
-- scripts/festivals/run-launch-ticket-sales-db-gate.sh against seeded Phase 1–7A fixtures.
ROLLBACK;
