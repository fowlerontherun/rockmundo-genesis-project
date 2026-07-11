-- Phase 5 PR 04 verification harness notes:
-- Run against a reset local Supabase database after applying migrations.
-- This harness intentionally focuses on database-owned guarantees that protect
-- Edge Function retries and multiple browser tabs.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gigs' AND column_name = 'result_ready_at'
  ) THEN
    RAISE EXCEPTION 'gigs.result_ready_at is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gig_song_performances_outcome_position_unique'
  ) THEN
    RAISE EXCEPTION 'gig_song_performances outcome/position uniqueness is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'start_gig_authoritative'
  ) THEN
    RAISE EXCEPTION 'start_gig_authoritative RPC is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_gig_completion'
  ) THEN
    RAISE EXCEPTION 'claim_gig_completion RPC is required';
  END IF;
END $$;

ROLLBACK;
