# Phase 4 PR 07 — Leader Rehearsal Attendance Finalisation MVP

## Recommendation source

This PR implements the manager-owned rehearsal finalisation slice from `docs/social/ATTENDANCE_AND_LINEUP_RULES.md`, preserving the beta states `invited`, `confirmed`, `declined`, `attended`, and `missed` without adding penalties, XP, chemistry, rewards, disputes, or correction requests.

## Previous attendance lifecycle

Before this PR, players could confirm or decline their own rehearsal row before the RSVP lock. Rehearsal completion still contained an automatic fallback that converted remaining `invited` rows to `attended`, which conflicted with the explicit manager-finalisation direction once attendance consequences become meaningful.

## Implemented finalisation lifecycle

Authorised managers can now submit a batch `finalise_rehearsal_attendance(rehearsal_id uuid, attendance jsonb)` call. Each payload item must reference an existing participant row for that rehearsal and choose only `attended` or `missed`. `invited` and `confirmed` rows can be finalised; `declined` rows remain declined; `attended` and `missed` are final, with same-state retries treated as idempotent and conflicting reversals denied.

## Timing/source-state rules

Finalisation uses database time. It is allowed once the rehearsal is completed or once `scheduled_end` has passed. If `scheduled_end` is absent, the fallback is after `scheduled_start`. Cancelled rehearsals are denied. This PR does not change ownership of `band_rehearsals.status`; it only removes the old automatic invited-to-attended promotion from contribution capture.

## RPC contract

`finalise_rehearsal_attendance(rehearsal_id uuid, attendance jsonb)` accepts a JSON array such as:

```json
[
  { "participant_id": "...", "status": "attended" },
  { "participant_id": "...", "status": "missed" }
]
```

The RPC returns one row per requested participant with `participant_id`, `profile_id`, `previous_status`, `participation_status`, and `changed`.

## Permission model

The RPC resolves `auth.uid()` to the actor profile and reuses `is_band_leader_or_manager`. Current active `leader`, `founder`, `co-leader`, and `manager` band members are allowed. Ordinary members, inactive/former managers, unrelated users, unauthenticated users, and managers of other bands are denied server-side.

## Contribution behaviour

Only final `attended` rows create `rehearsal_attendance` contribution events. `missed` and `declined` create no contribution. Contribution creation remains idempotent through the existing unique source identity and uses metadata declaring manager attendance finalisation.

## Notification behaviour

Participants marked `missed` receive one deduped database notification pointing to `/rehearsals`. Attended rows do not create participant notifications to avoid notification noise. Retries do not duplicate missed notifications.

## Audit behaviour

The RPC writes a rehearsal-level finalisation audit row, per-participant attended/missed rows, and denied-attempt audit rows for missing rehearsal, unauthorised actor, early attempt, cancelled rehearsal, invalid payload, wrong participant, and declined/final conflict cases. Audit metadata includes actor, band, rehearsal, participant, previous status, new status, change flag, and timestamp where applicable.

## Concurrency handling

The RPC locks the source rehearsal row and target participant rows, validates the whole payload before mutation, updates rows atomically, and creates contribution/notification records in the same transaction. Same-state retries are safe. Conflicting final-state changes are denied.

## Files changed

- `supabase/migrations/20260711100000_rehearsal_attendance_finalisation.sql`
- `src/components/social/ParticipantStatusList.tsx`
- `src/pages/Rehearsals.tsx`
- `supabase/tests/rehearsal_gig_participants_harness.sql`
- `docs/social/ATTENDANCE_AND_LINEUP_RULES.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`
- `docs/social/implementation/PHASE_4_PR_07.md`

## Database changes

Adds the guarded finalisation RPC, an eligibility helper, audit enum values, target enum values for rehearsal audit targets, a missed-notification dedupe index, and replaces `capture_contributions_for_rehearsal` so it contributes only already-attended participant rows.

## Tests

Validation covered SQL parsing through repository checks and adds PR 07 coverage markers to the participant DB harness. Full database integration requires a running Supabase test database.

## Known limitations

This PR intentionally does not add correction windows, disputes, absence reasons, attendance percentages, penalties, rewards, XP, chemistry changes, or gig lineup management. Unauthenticated denied attempts cannot include an actor audit row because the current audit table requires `actor_profile_id`.

## Recommended Phase 4 PR 08

Implement a narrow correction/dispute request flow for final attendance mistakes, preserving append-only audit and contribution correction semantics rather than allowing direct final-state reversal.
