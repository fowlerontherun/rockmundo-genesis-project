# Phase 4 PR 03 — Rehearsal Attendance and Gig Lineup Foundations

## Recommendation source

Phase 4 PR 02 recommended adding explicit participant tables for rehearsal attendance and gig lineups before moving rehearsal/gig contribution capture away from broad active-band-membership inference.

## Rehearsal workflow found

`band_rehearsals` is created as a band-scoped booking with scheduled start/end, completion, cancellation, cost, XP, and chemistry columns. No existing RSVP, decline, absence reason, opt-out, or attendee table was found. Current gameplay therefore treats active band members as expected by default.

## Gig workflow found

`gigs` is band-scoped and `gig_outcomes` records completion outcomes. `gig_song_performances` is song-level rather than performer-level. Band member role data exists on `band_members.instrument_role`, with touring/NPC-like members represented by nullable users and `is_touring_member`. No existing performer confirmation or substitute workflow was found.

## Product ambiguities

- There is no explicit player RSVP UI for rehearsals.
- There is no explicit gig lineup-management UI.
- There is no reliable historical leave timestamp for inactive members, so future participant creation is restricted to currently active members and immutable historical rows are preserved.
- The schema does not distinguish non-performing managers beyond member role labels; this PR avoids automatically crediting staff unless they are in the generated performer table.

## Participant/lineup models

- `band_rehearsal_participants` stores one row per rehearsal/profile with `invited`, `attended`, or `missed` status.
- `gig_performers` stores one row per gig/profile with `selected`, `performed`, or `missed` status and a copied role/instrument label.
- Both tables enforce unique event/profile rows, band matching, current active membership at selection time, indexes, foreign keys, RLS, and server-side validation triggers.

## Default inclusion rules

Because the current game does not expose explicit selection:

- Rehearsal booking seeds invited participant rows for active band members.
- Rehearsal completion marks still-invited rows as attended, while pre-marked missed rows remain uncredited.
- Gig booking seeds selected performer rows for active non-touring player members, copying `instrument_role`/`role` as display metadata.
- Gig outcome insertion marks still-selected performers as performed, while pre-marked missed rows remain uncredited.

## Permission model

Participant and lineup data is private operational band data. Active members may read it. Direct client inserts/updates/deletes remain unavailable through RLS because no broad mutation policies are added. Mutations happen through security-definer triggers/functions and existing server completion flows.

## Schedule integration

The PR does not create duplicate schedule records. Existing rehearsal and gig records remain the schedule source. Participant/performer rows provide member-level evidence for completion and contribution capture, and can be joined by future schedule UI for per-member status.

## Contribution integration

- Rehearsal contribution now comes only from `band_rehearsal_participants.participation_status = 'attended'`.
- Gig contribution now comes only from `gig_performers.lineup_status = 'performed'`.
- Existing contribution idempotency remains the unique constraint on band/profile/type/source.
- Metadata marks new rows as `accuracy = verified_participant` with `verification_method = explicit_attendance` or `explicit_lineup`.
- Recording contribution from PR 02 remains unchanged.

## Historical-data strategy

No historical backfill is included. Existing inferred contribution events remain immutable. Future/upcoming rows are seeded by booking/completion triggers as gameplay touches those records; completed historical events are not fabricated.

## Files changed

- `supabase/migrations/20290711030000_rehearsal_attendance_gig_lineups.sql`
- `supabase/tests/rehearsal_gig_participants_harness.sql`
- `docs/social/implementation/PHASE_4_PR_03.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

Added participant/lineup tables, constraints, indexes, RLS read policies, validation triggers, seed helpers, and contribution adapters for rehearsals and gig outcomes. Existing broad membership contribution trigger functions are replaced with participant-backed implementations.

## Tests

A SQL harness note file was added for local database/integration verification. Full local DB execution depends on Supabase services being available.

## Known limitations

- No RSVP or lineup-management UI is added.
- No attendance penalties, rewards, XP, chemistry, levels, achievements, or leaderboards are added.
- Historical leave-time validation remains limited by existing membership schema.
- Session/support performers and substitutes are intentionally out of scope.

## Recommended Phase 4 PR 04

Add narrow read-only UI joins for rehearsal participant and gig lineup status, then consider explicit leader-managed missed/lineup adjustment RPCs only if product design confirms opt-out and performer-management rules.
