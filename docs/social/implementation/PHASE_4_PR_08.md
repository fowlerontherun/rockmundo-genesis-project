# Phase 4 PR 08 — Rehearsal Attendance Correction Request MVP

## Recommendation source

Implements the rehearsal-only correction window recommended by `docs/social/ATTENDANCE_AND_LINEUP_RULES.md` after PR 06 self-response and PR 07 manager-owned final attendance.

## Previous correction gap

Final `attended` and `missed` rows were intentionally locked outside `finalise_rehearsal_attendance`, but there was no safe path for genuine mistakes. Contribution events were immutable and summaries counted every inserted rehearsal attendance event.

## Correction lifecycle

1. The affected participant requests a correction for their own final rehearsal attendance row.
2. The request remains `pending`; attendance and contribution records do not change at request time.
3. An authorised current manager or admin/support resolver approves or rejects.
4. Rejection leaves attendance and contribution unchanged.
5. Approval updates the participant row to the new authoritative final status, preserves original audit rows, and appends correction audit records.

Supported request statuses are `pending`, `approved`, `rejected`, and `cancelled`; cancellation is reserved in the data model but no cancellation RPC is exposed in this MVP.

## Correction window

Requests are accepted for 24 hours after `band_rehearsals.completed_at`, falling back to `scheduled_end`. The database helper `rehearsal_attendance_correction_window()` is the single timing constant, and `is_rehearsal_attendance_correction_open()` enforces the window with database time. Frontend deadline text is advisory.

## Request RPC contract

`request_rehearsal_attendance_correction(participant_id uuid, requested_status text, reason text default null)`:

- requires an authenticated profile;
- loads and locks the participant and rehearsal server-side;
- requires the requester to own the participant row;
- accepts only `attended -> missed` or `missed -> attended`;
- rejects provisional `invited`, `confirmed`, and `declined` rows;
- enforces the 24-hour window;
- trims optional plain text reason to 280 characters and rejects angle brackets;
- creates or returns one active pending request per participant;
- notifies current authorised resolvers without exposing reason text in notification metadata;
- writes append-only social audit metadata without private reason text.

## Resolution RPC contract

`resolve_rehearsal_attendance_correction(correction_request_id uuid, decision text, resolution_note text default null)`:

- requires an authenticated profile;
- locks the pending request, participant, and rehearsal;
- accepts `approve` or `reject`;
- requires a current leader/founder/co-leader/manager according to existing `is_band_leader_or_manager`, or an admin role;
- leaves attendance and contribution unchanged on reject;
- atomically updates request resolution fields;
- notifies the requester once;
- returns the final request row and treats already-final requests as idempotent retry reads.

## Conflict-of-interest rule

The database uses existing role support and records the resolver in full audit metadata. The beta limitation is that the schema does not yet identify the original per-row finalising manager as a resolvable conflict key, so PR 08 documents the policy but does not block that actor automatically. Admin/support may resolve under support policy.

## Attendance correction behaviour

The current participant row reflects the latest authoritative final status after approval. Original finalisation audit records are not removed or rewritten. Correction request, correction decision, attendance corrected, and contribution correction audit rows append the correction request ID, band, rehearsal, participant, previous status, requested status, decision, and resulting status.

## Contribution correction model

PR 08 uses the narrowest model compatible with current immutable events: append-only metadata plus void markers on the original event. `band_contribution_events` gains `voided_at`, `voided_by_profile_id`, and `voided_by_correction_request_id`. The original row remains auditable, but contribution queries and summaries filter `voided_at IS NULL`.

- `missed -> attended`: inserts the normal `rehearsal_attendance` event idempotently.
- `attended -> missed`: marks the effective event voided once and preserves the original row.
- No XP, money, chemistry, reputation, rewards, or penalties are changed.

## Privacy model

Request reasons and resolution notes are stored only on the private operational request table. They are not added to contribution feeds, public profiles, public pages, broad notification metadata, or general audit metadata.

## Permission model

- Requester: affected participant only.
- Resolver: current leader, founder, co-leader, manager, or admin/support role.
- Denied: ordinary members, unrelated users, inactive/former managers, unauthenticated users, and requests against another participant.

## Notification behaviour

Request notifications go only to current authorised resolvers and dedupe by correction request ID. Resolution notifications go to the requester once and include the decision, route, and IDs but no private notes or reason text.

## Audit behaviour

The migration adds audit kinds for requested, approved, rejected, corrected, denied, and contribution correction created. Audit metadata is operational and excludes private text.

## Concurrency model

The pending partial unique index permits one active pending request per participant. Request and resolution RPCs lock relevant rows. Pending-only updates make racing resolvers produce one decision; retries return the already-final request. Contribution insertion uses the existing idempotency constraint and voiding only affects unvoided rows.

## Files changed

- `supabase/migrations/20260711110000_rehearsal_attendance_corrections.sql`
- `src/components/social/ParticipantStatusList.tsx`
- `src/hooks/useParticipationDetails.ts`
- `src/hooks/useBandContributions.ts`
- `src/lib/participationStatus.ts`
- `src/lib/bandContributions.ts`
- `src/lib/participationStatus.test.ts`
- social planning/audit docs

## Database changes

Adds the correction request table, RLS, indexes, timing helpers, request/resolve RPCs, contribution void columns, audit enum values, and grants for authenticated RPC execution.

## Tests

Added status mapping unit coverage for correction statuses. Manual validation should cover request/resolve RPC paths with Supabase DB tests once a local database URL is available.

## Known limitations

- No cancellation RPC in the MVP.
- No automatic conflict-of-interest block against the original finalising manager because current audit rows do not expose a stable per-participant finaliser lookup for enforcement.
- Admin/support creation of requests is not added; support can resolve existing requests.
- UI deadline is advisory and uses scheduled end; database remains authoritative.

## Recommended Phase 4 PR 09

Add a focused database harness for correction RPC/RLS/concurrency, expose historical read-only correction decisions on the rehearsal surface, and add an explicit per-participant finaliser reference for stronger conflict-of-interest enforcement.
