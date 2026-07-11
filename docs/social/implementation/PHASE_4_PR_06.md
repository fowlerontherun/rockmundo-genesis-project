# Phase 4 PR 06 — Rehearsal Self-Response MVP

## Recommendation source

This PR implements the rehearsal RSVP slice recommended by `docs/social/ATTENDANCE_AND_LINEUP_RULES.md`, following the beta lifecycle of `invited`, `confirmed`, `declined`, `attended`, and `missed` only.

## Previous behaviour

Rehearsal participant rows were seeded automatically and displayed read-only. Participants could not confirm or decline their own row, and contribution capture only considered final `attended` rows.

## Implemented lifecycle

- `invited` can become `confirmed` or `declined` before the RSVP deadline.
- `confirmed` and `declined` can switch before the deadline.
- Repeating the same response is idempotent and does not create duplicate schedule blocks or notifications.
- `attended` and `missed` are final for self-response and remain outside this RPC.

## Deadline rule

The beta RSVP deadline is one hour before `band_rehearsals.scheduled_start`. Database helpers and frontend helpers centralize this value; database `now()` is authoritative for mutation checks, while the UI renders the deadline with the browser's local timezone formatting.

## RPC contract

`respond_to_rehearsal_invitation(participant_id uuid, response text)` returns the updated `band_rehearsal_participants` row. The RPC resolves the acting profile from `auth.uid()`, loads the participant and rehearsal server-side, accepts only `confirmed` or `declined`, and raises controlled errors for missing, unauthorised, late, cancelled, completed, final, invalid, or conflicting responses.

## Schedule behaviour

Declining cancels only the actor's active `player_scheduled_activities` rows linked to that rehearsal. Confirming preserves an existing active schedule row, creates no duplicate if one exists, and restores a schedule row only after the existing conflict helper reports no conflict. Other members' schedule rows are unchanged.

## Permission model

Only the row owner can respond. Leaders/founders/managers cannot answer for another player through this RPC. The actor must still be an active, non-touring band member with the same `user_id` and `profile_id`. Direct participant mutation remains denied because no broad INSERT/UPDATE/DELETE RLS policies were added.

## Notification behaviour

Declines notify active band managers/leaders/founders/co-leaders only, not every band member. Notifications dedupe by manager user, rehearsal, participant, and response state. Confirmations do not notify the actor redundantly.

## Audit behaviour

Successful confirmation, decline, and changed-response events are written to `social_action_audit_log` with actor, target participant, rehearsal, band, previous status, new status, and timestamp. Denied missing/invalid/unauthorised/ineligible/late/locked attempts are also audited where the actor can be resolved.

## Files changed

- `supabase/migrations/20260711090000_rehearsal_self_response_mvp.sql`
- `src/lib/participationStatus.ts`
- `src/lib/rehearsalRsvp.ts`
- `src/hooks/useParticipationDetails.ts`
- `src/components/social/ParticipantStatusList.tsx`
- `src/pages/Rehearsals.tsx`
- `src/lib/participationStatus.test.ts`
- `src/lib/rehearsalRsvp.test.ts`
- Social planning/audit documents for factual status updates.

## Database changes

The migration extends the participant status check constraint to include `confirmed` and `declined`, adds RSVP helper functions, adds the guarded self-response RPC, creates narrow indexes for participant lookup/schedule restore/notification dedupe, and adds social audit enum values.

## Tests

Added unit coverage for `confirmed`/`declined` status metadata and shared RSVP deadline/open-state helpers. Database harness coverage is intended to run through migration validation where a Supabase test database is available.

## Known limitations

- No manager finalisation UI/RPC is included.
- Recreated schedule rows use a generic "Band Rehearsal" title because existing schedule rows do not guarantee a stable canonical title source in the RPC.
- Notification batching is simple dedupe, not digest batching.
- Rehearsal participant seeding still has the previously documented touring-member mismatch for existing/new seed helper behaviour outside this PR.

## Recommended Phase 4 PR 07

Add manager attendance finalisation for rehearsals after start/end with audited `attended`/`missed` changes, no rewards/penalties, and contribution capture still limited to final `attended` rows.
