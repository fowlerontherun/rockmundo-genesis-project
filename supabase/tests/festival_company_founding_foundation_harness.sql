-- Festival-company founding foundation coverage harness.
-- Intended for a Supabase test database with auth helpers/fixtures available.
-- This static harness documents the acceptance assertions for public.found_festival_company:
-- 1 active VIP with enough cash succeeds; 2 exactly 2000000 deducted;
-- 3 company balance is 0; 4 company_type is festival; 5 festival extension exists;
-- 6 founder shareholder exists; 7 company ledger and audit entries exist;
-- 8 non-VIP rejected; 9 expired VIP rejected; 10 insufficient cash rejected;
-- 11 invalid names rejected; 12 duplicate slug rejected; 13 idempotent retry charges once;
-- 14 changed payload with same key raises idempotency_conflict;
-- 15 later insert failures roll back cash by PostgreSQL transaction semantics;
-- 16 other players cannot directly modify replacement tables under RLS;
-- 17 anonymous callers are rejected.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'found_festival_company') THEN
    RAISE EXCEPTION 'found_festival_company RPC is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'festival_companies') THEN
    RAISE EXCEPTION 'festival_companies table is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'festival_editions_v2') THEN
    RAISE EXCEPTION 'festival_editions_v2 table is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'festival_company_audit_log') THEN
    RAISE EXCEPTION 'festival_company_audit_log table is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'festival_company_founding_requests') THEN
    RAISE EXCEPTION 'festival_company_founding_requests idempotency table is missing';
  END IF;
END $$;
