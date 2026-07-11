# Phase 4 PR 11 — Migration Order Repair and Rehearsal Lifecycle Database Gate

## P0 defect

PR 10's release-gate finding is confirmed by static migration order review. Supabase applies migration filenames lexicographically, so `20260711090000_rehearsal_self_response_mvp.sql` runs before `20290711030000_rehearsal_attendance_gig_lineups.sql`. The earlier migration alters `public.band_rehearsal_participants`; the later migration was the first creator of that table. A clean reset would therefore stop at the first `ALTER TABLE public.band_rehearsal_participants` with a missing relation error.

## Dependency graph

- `band_contribution_events`: first created by `20260711010000_create_band_contribution_events.sql`; later constrained/indexed and helper-replaced by `20260711020000_contribution_source_adapters_bootstrap.sql` and the preserved `20290711020000_contribution_source_adapters.sql`; correction columns are added by `20260711110000_rehearsal_attendance_corrections.sql` before correction resolution can void contribution rows.
- `band_rehearsal_participants`: now first created by `20260711030000_rehearsal_attendance_gig_lineups_bootstrap.sql`; later altered by `20260711090000_rehearsal_self_response_mvp.sql`, `20260711100000_rehearsal_attendance_finalisation.sql`, `20260711110000_rehearsal_attendance_corrections.sql`, and `20260711120000_rehearsal_attendance_correction_hardening.sql`; the preserved `20290711030000_rehearsal_attendance_gig_lineups.sql` is now idempotent against the earlier table/policy definitions.
- `gig_performers`: now first created by `20260711030000_rehearsal_attendance_gig_lineups_bootstrap.sql`; later referenced by gig contribution adapter functions in the same bootstrap and the preserved `20290711030000_rehearsal_attendance_gig_lineups.sql`.
- RSVP helpers: `rehearsal_rsvp_lock_interval`, `rehearsal_rsvp_deadline`, `is_rehearsal_participant_final`, `is_rehearsal_response_open`, and `respond_to_rehearsal_invitation` are created after the participant table exists; PR 11 also adds the harness-compatible `respond_to_rehearsal_participation` wrapper after its dependency exists.
- Finalisation RPC: `finalise_rehearsal_attendance` is created after participant tables, status constraints, contribution helpers, audit enum values, and notification indexes exist.
- Correction requests/resolution: `rehearsal_attendance_correction_requests`, correction read helper, request RPC, resolution RPC, voiding columns, pending uniqueness, and RLS are created after participant/contribution/audit foundations exist.
- Finaliser fields: `finalised_by_profile_id` and `finalised_at` are added after the participant table exists and before the hardened finalisation/resolution RPC replacements read them.
- Audit enum values: rehearsal RSVP, finalisation, correction, contribution-correction, finaliser, conflict, sole-resolver, and legacy-finaliser audit values are added before their RPC definitions insert those action values.
- Notification indexes: RSVP/finalisation/correction dedupe indexes are created after `notifications` exists and before the RPCs that rely on dedupe semantics.
- RLS policies: participant and performer policies are created only after their tables exist; the preserved late creator now drops/recreates matching policies to avoid duplicate-policy reset failures.
- Helper functions: `is_band_member_at_time` is now bootstrapped before participant/performer validators and contribution adapters call it; grants are issued after function creation.

## Deployment-status evidence

Repository search found PR documentation and local harness instructions, but no Supabase migration ledger, CI reset output, production deployment record, schema snapshot, or generated-types evidence proving these affected migrations have been applied to a shared production-like Supabase environment. The affected migrations are therefore classified as **unverified** rather than definitely unreleased.

## Repair strategy selected

PR 11 uses a forward-compatible variation of Option D. It preserves the existing 2029 migration filenames for any environment whose migration ledger might already reference them, adds early bootstrap migrations that create/redefine the required base objects before the 2026 attendance chain, and makes the preserved late participant/lineup creator tolerate pre-existing policies.

## Why the strategy is safe

The repair is non-destructive. It does not drop participant, performer, contribution, correction, or audit data. The early migrations use the same intended Phase 4 table/function definitions rather than an incomplete stub schema. The preserved late migration continues to converge function/trigger definitions and now avoids duplicate policy creation on clean reset or already-bootstrapped databases.

## Files renamed/edited/created

- Created `supabase/migrations/20260711020000_contribution_source_adapters_bootstrap.sql` from the existing contribution-source adapter migration so `is_band_member_at_time` and idempotent contribution helpers exist before participant validators.
- Created `supabase/migrations/20260711030000_rehearsal_attendance_gig_lineups_bootstrap.sql` from the existing participant/lineup foundation migration so participant and performer tables exist before RSVP/finalisation/correction migrations.
- Edited `supabase/migrations/20260711090000_rehearsal_self_response_mvp.sql` to add the `respond_to_rehearsal_participation(uuid,text)` compatibility RPC expected by the release-gate harness.
- Edited `supabase/migrations/20290711030000_rehearsal_attendance_gig_lineups.sql` to drop/recreate the two select policies safely when the earlier bootstrap already created them.

## Clean reset result

Not passed in this container. `supabase` is not installed, `npx supabase --version` failed with an npm registry 403 for the `supabase` package, Docker is unavailable, and `psql` is unavailable. Because no real clean reset completed, this PR does not claim the database gate passed.

## Upgrade-path result

A live upgrade-path simulation was not possible for the same tooling reasons. Static upgrade review indicates the selected strategy preserves existing filenames, does not recreate/drop existing data tables, and uses idempotent table/index/function/trigger definitions with duplicate policy protection in the preserved late migration.

## Harness results

The contribution, participant, recruitment, and correction SQL harnesses were not executable here because the repository scripts require the Supabase CLI, a reset local database URL, and `psql`; those tools are unavailable in this container.

## RLS and RPC results

Static review confirms Phase 4 operational RPCs are `SECURITY DEFINER` with `SET search_path = public`, are granted to `authenticated` after creation, and revoke public execution where the migration defines guarded operational helpers. Static review also found the correction harness expected `respond_to_rehearsal_participation(uuid,text)` while the migration only created `respond_to_rehearsal_invitation(uuid,text)`; PR 11 adds a narrow wrapper and authenticated grant.

## Additional defects found

- **Severity:** release-gate harness defect. **Root cause:** RPC naming drift between the implemented RSVP RPC and the PR 10 correction harness requirement. **Fix:** add a wrapper RPC preserving existing implementation semantics. **Regression test:** correction harness can now find `respond_to_rehearsal_participation(uuid,text)` once a reset database is available.
- **Severity:** clean-reset duplicate-object risk after bootstrapping. **Root cause:** the preserved late participant/lineup migration used bare `CREATE POLICY` statements. **Fix:** add `DROP POLICY IF EXISTS` before recreating the two read policies.

## Corrective fixes

Only migration-order and release-gate defects were changed. No gig lineup mutation UI, rewards, penalties, XP, chemistry, reputation, scoring, rehearsal page redesign, or production-data deletion was added.

## Generated type/schema updates

Supabase TypeScript types and generated schema documentation were not regenerated because the reset database and Supabase CLI are unavailable. The migration changes are SQL-only and must be followed by type regeneration after a successful local reset in an environment with Supabase tooling.

## Application validation

Application checks were run where repository dependencies allowed. Database checks remained blocked by missing Supabase/Docker/psql tooling.

## Remaining limitations

- No real clean Supabase reset was completed in this container.
- No SQL harness was executed against a reset database in this container.
- No true concurrent-session resolver race runner exists.
- No gig lineup mutation, performer confirmation, gig finalisation correction, rewards, progression, XP, chemistry, or reputation consumer is included.
- Manual browser checks remain required.

## Phase 4 status

Not complete.

## Gig-lineup readiness

Not ready.

## Recommended next PR

Run PR 11's repaired migration chain in an environment with Supabase CLI, Docker, and `psql`; complete clean reset, migration status, contribution/participant/recruitment/correction harnesses, generated type regeneration, and application validation before starting gig-lineup mutation.
