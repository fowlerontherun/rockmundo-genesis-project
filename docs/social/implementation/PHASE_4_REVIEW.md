# Phase 4 Review

## Objective

Phase 4 was intended to make band contribution history server-authoritative and safer for beta by connecting contribution events to verified collaboration records, adding read-only rehearsal/gig participation surfaces, implementing rehearsal RSVP/finalisation/correction flows, and documenting the rules that must govern later gig-lineup mutation work. It explicitly did not add rewards, penalties, XP, chemistry, reputation, contribution scoring, generic disputes, or gig lineup editing.

## PRs Completed

- **PR 01 — Band contribution tracking:** introduced `band_contribution_events` as a server-owned, read-oriented contribution ledger.
- **PR 02 — Contribution source accuracy:** tightened recording/rehearsal/gig source attribution and contribution summaries.
- **PR 03 — Rehearsal attendance and gig lineup foundations:** added rehearsal participant and gig performer records plus seeding/capture foundations.
- **PR 04 — Participant and lineup visibility:** surfaced read-only rehearsal attendance and gig lineup status to relevant band members.
- **PR 05 — Attendance and lineup rules design:** documented status models, lock/correction concepts, notification expectations, RLS expectations, and out-of-scope progression effects.
- **PR 06 — Rehearsal self-response MVP:** added player-owned RSVP transitions for rehearsal rows before the lock deadline.
- **PR 07 — Leader rehearsal attendance finalisation MVP:** added guarded manager finalisation and aligned rehearsal contribution capture with final `attended` rows only.
- **PR 08 — Rehearsal attendance correction request MVP:** added correction request/resolve RPCs, private reasons/notes, notifications, audit rows, and contribution void/restore semantics.
- **PR 09 — Attendance correction verification and conflict hardening:** added per-row finaliser tracking, original-finaliser conflict enforcement, sole-resolver exceptions, legacy-finaliser fallback, correction history UI, and a correction SQL harness.
- **PR 10 — Attendance correction release gate and gig-lineup readiness review:** performed repository/tooling review, expanded executable harness assertions, documented validation limits, and closed Phase 4 as not complete pending database reset proof.

## Player-Facing Flows Available

Verified by repository code/document review and existing automated/component tests where available, but not by a local Supabase reset in this environment because the Supabase CLI is unavailable:

- Contribution history.
- Verified recording participation.
- Rehearsal participation records.
- Gig performer records.
- Read-only rehearsal attendance.
- Read-only gig lineups.
- Rehearsal RSVP.
- Rehearsal finalisation.
- Attendance corrections.
- Correction history.

## Database and Security Status

- **Server-authoritative event capture:** implemented for contribution events and rehearsal attendance corrections, with client access routed through RPCs rather than direct table mutation.
- **Idempotency:** documented and partially enforced through unique source identity, same-state retry handling, pending correction uniqueness, notification dedupe, and voided contribution filtering.
- **RLS:** expected on participant, correction, contribution, audit, and schedule tables; the PR 10 harness now asserts these release-gate requirements when a reset database is available.
- **RPC grants:** expected to be authenticated-only for operational RPCs and not executable by `anon`; the PR 10 harness now asserts this.
- **Current/former member access:** current managers are intended to retain operational access, ordinary/current members retain read-only visibility, and former managers/unrelated players are denied operational correction access.
- **Manager permissions:** manager/founder/leader/co-leader roles are the supported resolver/finaliser set.
- **Conflict-of-interest handling:** PR 09 added database-side original-finaliser conflict checks, sole-resolver exception handling, and legacy-null finaliser fallback.
- **Contribution correction:** missed-to-attended creates one effective event; attended-to-missed voids the effective event without deleting history; summaries should exclude `voided_at IS NOT NULL`.
- **Privacy:** request reasons and resolution notes are intended to remain only on correction requests and not leak into audit, contribution metadata, notifications, profiles, public band data, or feeds; the harness now includes static privacy assertions.

## Test Coverage

- **Unit tests:** repository has Vitest unit coverage, including participation status helpers.
- **Component tests:** correction/history/manager UI coverage exists in `ParticipantStatusList.test.tsx`; PR 10 did not add UI behaviour because no verified UI defect was proven during the release gate.
- **SQL/database tests:** participant and correction harness files exist; PR 10 expands the correction harness from documentation-only checks to executable schema/grant/RLS/privacy/fixture-capability assertions. Full lifecycle data mutation tests still require a reset Supabase database.
- **Migration reset:** not verified in this environment; `supabase` CLI is not installed. Static migration ordering review found a blocker: Phase 4 attendance/correction migrations dated `20260711...` depend on `band_rehearsal_participants`, but that table is created by `20290711030000_rehearsal_attendance_gig_lineups.sql`, which sorts later.
- **Browser/smoke coverage:** not run in a real browser in this environment.
- **True concurrency coverage:** not present; single-session SQL harnesses document retry/idempotency but do not simulate simultaneous resolvers in separate sessions.
- **Skipped or unavailable checks:** Supabase start/reset/harness execution and manual browser verification were unavailable here; they must be completed before beta sign-off.

## Remaining Phase 4 Gaps

### P0 beta blockers

- Clean Supabase reset/migration application is not proven and appears blocked by migration ordering: Phase 4 attendance/correction migrations reference participant tables before the migration that creates them is applied.
- Correction SQL harness has not been executed against a clean reset database in this environment.
- Full lifecycle database verification remains unproven until reset succeeds.

### P1 high value

- Convert the remaining participant harness documentation markers into full data-mutating tests after migration order is corrected.
- Add a true concurrent-session resolver test runner for duplicate decisions and contribution correction races.
- Expand component tests for mobile/focus/accessibility details around all correction roles.

### P2 expansion

- Gig lineup mutation.
- Performer confirmation.
- Gig finalisation correction.
- Absence reason taxonomy and retention policy.
- Rewards/progression consumers.

### Accepted limitations

- Touring-member seeding behaviour remains a documented mismatch/open decision until database reset fixtures prove the exact behaviour.
- No gig lineup mutation exists.
- No performer confirmation exists.
- No gig finalisation correction exists.
- No true concurrent-session test runner exists.
- No rewards/progression consumer exists.

## Phase Status

**Not complete.**

Evidence exists for the implemented code paths and documentation, and PR 10 expands the SQL release-gate harness. However, Phase 4 cannot be marked complete because the requested clean Supabase reset and correction harness execution were not possible in this environment, and static migration-order review found an apparent reset blocker that must be corrected and verified before beta sign-off.

## Gig-Lineup Readiness Decision

**Not ready.**

Gig lineup management should not begin until the rehearsal attendance/correction database baseline can reset cleanly and the participant/correction harnesses pass against that reset database. Starting gig-lineup mutation work before resolving the migration-order gate would compound an unverified database foundation.

## Recommended Next PR

Blocking PR instead of Phase 5:

**Phase 4 PR 11 — Migration Order Repair and Rehearsal Lifecycle Database Gate**

- **Objective:** restore clean Supabase reset and execute deterministic rehearsal lifecycle SQL harnesses.
- **Scope:** add a corrective migration strategy or approved migration reordering plan for the Phase 4 participant-table dependency; complete data-mutating SQL fixtures for RSVP/finalisation/correction/RLS flows; run reset and harnesses.
- **Dependencies:** Supabase CLI, local Docker/Supabase services, and agreement on whether historical migration timestamps may be corrected or whether a baseline/squash is required.
- **Security risks:** accidentally broadening RPC grants or RLS policies while repairing ordering; missing former-manager denials; leaking correction reason/note metadata.
- **Acceptance criteria:** clean reset succeeds; participant and correction harnesses pass; migration dependency order is documented; former/unrelated/anonymous access denials are executable; privacy checks pass.
- **Tests:** `supabase start`, `supabase db reset`, recruitment prerequisite harnesses if needed, participant harness, correction harness, typecheck, lint, build, unit/component tests, and a documented manual browser checklist.
