# Phase 4 PR 09 — Attendance Correction Verification and Conflict-of-Interest Hardening

## Recommendation source

This implements the PR 09 hardening pass requested after PR 07 manager finalisation and PR 08 correction requests exposed a verification and original-finaliser conflict gap.

## Previous verification and conflict gap

PR 08 stored correction requests and resolver decisions, but the original per-participant finalising manager was only inferable from generic audit metadata. That was not reliable enough for server-side conflict enforcement, and the correction SQL harness did not yet repeatedly verify RPC grants, finaliser fields, privacy conventions, or contribution-correction invariants.

## Finaliser reference model

`band_rehearsal_participants` now stores `finalised_by_profile_id` and `finalised_at`. The finalisation RPC writes these values only when a provisional row changes to `attended` or `missed`. Idempotent same-state retries preserve the original finaliser because the row is not rewritten as changed. Historical nulls are not backfilled; null means unknown/legacy.

## Conflict-of-interest rule

`resolve_rehearsal_attendance_correction` identifies the participant row's original finaliser and checks current authorised resolvers using repository-backed active `band_members` roles: `leader`, `founder`, `co-leader`, and `manager`. Former/inactive members, unrelated users, ordinary members, and the affected participant are not counted as alternative resolvers. Admin/support is represented by the existing `admin` app role and may resolve under support policy.

If the resolver is the original finaliser and another eligible resolver currently exists, the database denies approval/rejection and writes a conflict-denial audit row. The frontend only mirrors this state for clarity; the RPC remains authoritative.

## Sole-resolver exception

If the original finaliser is the only eligible resolver, the RPC allows resolution and marks `sole_resolver_exception` on the correction request. It also writes a dedicated sole-resolver audit action. This avoids blocking sole-manager bands while keeping the decision auditable.

## Legacy-row behaviour

Rows with `finalised_by_profile_id IS NULL` are treated as legacy/unknown. Authorised managers or support may resolve under current rules, and the RPC writes a legacy-finaliser audit action. Legacy rows are not blocked because there is no reliable conflict key.

## Database harness coverage

`supabase/tests/rehearsal_attendance_corrections_harness.sql` adds deterministic assertions for the hardening migration: finaliser columns, eligibility RPC presence and grants, correction RPC grants, and privacy static checks that private reason/note text is not copied into audit/contribution metadata. True concurrent session testing remains documented as a limitation of this harness.

## Correction history UI

The rehearsal participant surface now shows a read-only correction summary on the participant row and a manager correction history list for pending and final requests. Authorised managers see pending controls, final history, sole-resolver markings, private reasons, and private resolution notes. A requester sees their own current status, request state, dates, and legacy/known finaliser status without exposing manager private notes to ordinary members via broad list UI.

## Privacy model

Private request reasons and resolution notes stay on `rehearsal_attendance_correction_requests` and are protected by existing RLS/read helper rules. Audit metadata and notification metadata continue to carry IDs, status, and decision metadata, not private reason text.

## Contribution verification

The resolver remains append-only/idempotent: missed-to-attended uses the existing idempotent contribution insertion path, while attended-to-missed voids one effective contribution row without deleting the original event. The harness documents these semantics and the UI does not expose contribution-feed private notes.

## Files changed

- `supabase/migrations/20260711120000_rehearsal_attendance_correction_hardening.sql`
- `supabase/tests/rehearsal_attendance_corrections_harness.sql`
- `src/hooks/useParticipationDetails.ts`
- `src/components/social/ParticipantStatusList.tsx`
- `src/components/social/ParticipantStatusList.test.tsx`
- `package.json`
- Phase 4 social documentation files

## Database changes

- Added per-row finaliser fields and index.
- Added `sole_resolver_exception` to correction requests.
- Added eligibility helpers and grants.
- Replaced finalisation/resolution RPC definitions in a new corrective migration.
- Added audit kinds for finaliser reference, conflict denial, sole-resolver exception, and legacy fallback.

## Tests

Added component coverage for conflict guidance and manager history. Added `npm run test:corrections:db` for the correction SQL harness.

## Known limitations

The SQL harness performs deterministic schema/grant/privacy checks and documents idempotency/concurrency expectations, but it does not open multiple concurrent database sessions. Full simultaneous resolver races should be verified manually or with an external integration runner.

## Recommended Phase 4 PR 10

Proceed to gig lineup management only after running the correction harness against a reset Supabase database and manually validating participant, manager, second-manager, sole-manager, former-manager, unrelated-user, and legacy-row flows on mobile and desktop.
