# Phase 4 PR 10 — Attendance Correction Release Gate and Gig-Lineup Readiness Review

## Recommendation source

PR 10 follows the PR 09 recommendation to run the rehearsal attendance correction harness against a reset Supabase database, validate the complete rehearsal lifecycle, review security/privacy/notifications, and decide whether gig lineup mutation may begin.

## Environment used

- Repository path: `/workspace/rockmundo-genesis-project`.
- Date: 2026-07-11 UTC.
- Node/npm scripts inspected from `package.json`.
- Supabase CLI: unavailable in this container (`supabase: command not found`).
- `node_modules`: absent at the start of validation, so JavaScript checks that require dependencies were limited by environment setup.

## Reset/migration result

- `supabase start` was not run because the Supabase CLI is not installed.
- `supabase db reset` was not run because the Supabase CLI is not installed.
- `npm run test:corrections:db` failed before database access with exit 127 because the script requires the Supabase CLI.
- Static migration-order review found a release-gate blocker: `20260711090000_rehearsal_self_response_mvp.sql`, `20260711100000_rehearsal_attendance_finalisation.sql`, `20260711110000_rehearsal_attendance_corrections.sql`, and `20260711120000_rehearsal_attendance_correction_hardening.sql` reference `band_rehearsal_participants`, while `20290711030000_rehearsal_attendance_gig_lineups.sql` creates that table and sorts later.
- Expected database failure if migrations are applied lexicographically: the first Phase 4 attendance migration that alters `public.band_rehearsal_participants` will fail with a missing relation error before later tests can run.
- Because no clean reset could be run here, no historical migration was edited and no corrective migration was added.

## Harness result

- The correction harness was expanded from documentation/static markers into executable release-gate assertions covering required tables, columns, RPC presence, authenticated-only grants, anonymous denials, RLS enablement, voided contribution indexing, privacy static checks, and fixture-capability prerequisites.
- The harness was not executed against a reset database in this environment because the Supabase CLI is unavailable.
- `npm run test:corrections:db` result: failed with tooling unavailable (`Supabase CLI is required for correction DB tests`).

## Lifecycle cases covered

Repository/document review confirms intended coverage for:

- Participant seeding, duplicate prevention, unrelated/former member exclusion, and touring-member uncertainty.
- Self-response state transitions, deadline/cancelled/completed denial, own-row enforcement, and schedule release/restore semantics.
- Manager finalisation permissions, early/cancelled denials, final-state idempotency, original finaliser preservation, and contribution creation.
- Correction requests for attended/missed rows, duplicate pending prevention, reason validation, private reason storage, resolver permissions, conflict enforcement, sole-resolver exception, legacy-null finaliser fallback, and contribution void/restore.

Executable full lifecycle mutation verification remains blocked until a reset database is available.

## RLS/RPC findings

- Operational flows are designed to use guarded RPCs rather than direct table mutation.
- PR 10 harness assertions now require RLS on `band_rehearsal_participants`, `rehearsal_attendance_correction_requests`, `band_contribution_events`, `social_action_audit_log`, and `player_scheduled_activities`.
- PR 10 harness assertions now require `authenticated` execute grants and deny `anon` execution for correction request/resolve RPCs.
- Static review did not prove a broad authenticated policy bypass, but database execution is still required.

## Privacy findings

- Frontend affected-feature queries reviewed in `src/hooks/useParticipationDetails.ts` and `src/components/social/ParticipantStatusList.tsx` use narrow field selections for participant/correction display rather than broad correction `select('*')` reads.
- Broad `select('*')` occurrences exist elsewhere in unrelated feature areas; no affected rehearsal correction broad select was changed because no verified leak was found.
- PR 10 harness adds static assertions that request reasons/resolution notes are not copied into audit, contribution, or notification metadata by correction RPC definitions.

## Notification findings

- Existing migrations implement dedupe checks for missed attendance and correction notifications by event/request identity.
- Notifications are documented to avoid private reason/note text and to route to rehearsal surfaces.
- Former-manager notification exclusion still needs reset-database fixture execution; it is not claimed as passed here.

## Defects found

### P0 release-gate defect — migration ordering

Phase 4 attendance/correction migrations appear to depend on `band_rehearsal_participants` before the migration that creates it is applied. Impact: clean reset and all later SQL harnesses may be blocked. This is a database release-gate defect, not a UI defect. Because historical migrations must not be edited in this PR and the failing migration would occur before any new later corrective migration could run, the recommended fix is a dedicated migration-order repair PR with explicit approval for the migration strategy.

## Fixes made

- Expanded `supabase/tests/rehearsal_attendance_corrections_harness.sql` with executable release-gate assertions.
- Added this PR 10 implementation note.
- Added `PHASE_4_REVIEW.md` and updated social planning/audit/rules docs to reflect the release-gate result.

## Manual checks run/not run

Manual browser verification was **not run** in this environment. Remaining manual checklist:

- Participant: RSVP before deadline, locked after deadline, final read-only state, correction request, pending/final decision visibility, no private manager note exposure.
- Leader/original finaliser: correction visibility, disabled controls when another resolver exists, conflict guidance.
- Second manager: approve/reject controls, private reason visibility, resolved history read-only.
- Sole manager: warning, sole-resolver confirmation, decision possible.
- Ordinary member: operational status visible, another participant correction details hidden, no manager controls.
- Former manager: no current operational/correction-management access.
- Unrelated user: no operational access.
- Legacy participant row: unknown finaliser display, authorised resolution, no crash.
- Mobile viewport and desktop viewport rendering, focus handling, accessible labels, and non-colour-only status cues.

## Phase 4 status

Not complete. Implemented flows exist, but the release gate cannot pass without a clean Supabase reset and successful participant/correction harness execution.

## Gig-lineup readiness decision

Not ready. Gig lineup management should wait for the migration-order/reset blocker and executable lifecycle verification to be resolved.

## Recommended next PR

Phase 4 PR 11 — Migration Order Repair and Rehearsal Lifecycle Database Gate.
