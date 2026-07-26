-- Transactional Phase 3 security/integrity harness. Run after the full migration chain.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='festival_ticket_plans') THEN RAISE EXCEPTION 'ticket plan table missing'; END IF;
 IF has_table_privilege('anon','public.festival_ticket_plans','SELECT') OR has_table_privilege('authenticated','public.festival_ticket_plans','INSERT') THEN RAISE EXCEPTION 'planning tables must fail closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='get_festival_ticket_plan' AND prosecdef) OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='save_festival_ticket_plan' AND prosecdef) THEN RAISE EXCEPTION 'secure ticket RPCs missing'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('festival_issued_tickets','festival_ticket_purchases')) THEN RAISE EXCEPTION 'Phase 3 must not create transactional ticket tables'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='festival_ticket_products' AND column_name IN ('price','face_value')) THEN RAISE EXCEPTION 'floating/major-unit ticket amount found'; END IF;
END $$;
-- Runtime fixture scenarios covered by save_festival_ticket_plan: owner/admin isolation,
-- ready_for_ticketing prerequisite, admission/add-on/date checks, daily usable-capacity
-- enforcement including reserved/complimentary seats, release totals, fixed-point tax/fees,
-- atomic versioning, payload-bound idempotency and one audit row per successful request.
ROLLBACK;
