-- Historical Phase 4 PR 03 migration retained for migration-ledger compatibility.
--
-- This July 2025 timestamp is premature in the clean migration sequence: it runs
-- before public.band_rehearsals, public.gigs, public.bands, and public.profiles
-- exist. The dependency-safe canonical copy is
-- 20260711030000_rehearsal_attendance_gig_lineups_bootstrap.sql, which creates
-- the same rehearsal participant / gig performer foundations after their base
-- dependencies are available and before later RSVP/finalisation migrations.
--
-- Keep this filename as an explicit no-op so existing environments that may
-- already have it in their migration ledger remain compatible, while clean
-- rebuilds defer the schema to the canonical 2026 bootstrap.

DO $$
BEGIN
  RAISE NOTICE 'Deferred duplicate rehearsal attendance and gig lineup foundations to canonical 20260711030000 migration';
END
$$;
