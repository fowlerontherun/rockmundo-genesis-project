# Phase 4 PR 05 — Attendance and Lineup Product Rules Design

## Recommendation source

This PR follows Phase 4 PR 04's recommendation to settle leader attendance, lineup adjustment, absence handling, privacy, and dispute rules before adding mutation RPCs. The canonical product rules are documented in [`../ATTENDANCE_AND_LINEUP_RULES.md`](../ATTENDANCE_AND_LINEUP_RULES.md).

## Repository findings

- `band_rehearsals` exists with scheduling, completion, cancellation, cost, chemistry, and XP fields, while current booking code inserts future scheduled rehearsals and creates schedule blocks for real non-touring band members.
- `band_rehearsal_participants` now exists with `invited`, `attended`, and `missed`, active-band-member SELECT RLS, automatic seeding, and contribution capture from `attended` rows only.
- `gigs` and `gig_outcomes` exist for scheduled performances and final outcome capture; completion currently updates gig status and existing gig rewards/progression outside this design PR.
- `gig_performers` now exists with `selected`, `performed`, and `missed`, active-band-member SELECT RLS, automatic non-touring player seeding, and contribution capture from `performed` rows only.
- `player_scheduled_activities` is the current schedule-blocking source, with linked rehearsal/gig ids and overlap conflict checks against scheduled/in-progress activities.
- Current band scheduling helpers exclude touring/NPC-like members for schedule blocking, but rehearsal participant seeding currently includes active members with profiles and does not explicitly exclude touring members.
- Current read-only UI can show rehearsal participant and gig performer rows; no RSVP, lineup editor, substitution, correction, or dispute UI/RPC exists.
- Existing social safety work provides block/privacy/audit patterns, but attendance/lineup-specific permission denial logs, private absence fields, correction records, and dispute records are missing.

## Rules recommended

- Keep rehearsal default inclusion for active player members during beta, but add self RSVP before manager finalisation.
- Add minimal beta rehearsal statuses: `invited`, `confirmed`, `declined`, `attended`, `missed`; cancellation remains source-level.
- Move gigs toward manager-selected lineups with minimal statuses: `selected`, `confirmed`, `declined`, `performed`, `missed`.
- Treat substitution as auditable removal plus eligible replacement selection before a lineup lock, not as a complex beta state machine.
- Create contribution only for final `attended` rehearsal rows and final `performed` gig rows.
- Keep missed/declined statuses separate from punishment, XP, chemistry, and reputation.
- Use product-configurable timing defaults: one-hour rehearsal RSVP deadline, several-hour gig lineup lock, 24-hour correction window, and 48-hour dispute window.

## Rules deferred

- Rewards, penalties, contribution scores, XP changes, chemistry changes, and automatic reputation effects.
- Session-player marketplace integration and public performer lineups.
- Required-role lineup balancing and hard gig-completion blocking.
- Detailed absence analytics and reliability reputation.
- Full arbitration/moderation case management.

## Product decisions

Required before implementation:

- RSVP and lineup lock default values.
- Whether touring members should ever be included in rehearsals or lineups during beta.
- Officer role names that may mutate attendance/lineups.
- Whether decline immediately releases schedule blocks.
- Whether finalisation auto-attends confirmed/no-response rows.
- Absence reason storage, retention, and visibility.
- Correction/dispute windows and contribution correction model.

Safe defaults are listed in the canonical rules document; automated penalties and public lineup visibility are post-beta decisions.

## Proposed RPCs

- `respond_to_rehearsal_invitation`: participant-owned `confirmed`/`declined` response before RSVP deadline.
- `set_rehearsal_attendance`: manager-owned provisional/final attendance status update after event start/end.
- `finalise_rehearsal_attendance`: manager/system finalisation that creates contribution only for `attended`.
- `update_gig_lineup`: manager-owned add/remove/replace performer mutation before lock with conflict checks.
- `respond_to_gig_selection`: selected performer confirmation/decline before self-withdrawal deadline.
- `finalise_gig_performance`: manager/system finalisation that creates contribution only for `performed`.
- `request_participation_correction`: affected participant or manager request within correction/dispute window.
- `resolve_participation_correction`: non-conflicted manager or admin resolution with auditable contribution correction.

No RPCs are implemented in this PR.

## Permission model

- Current active band members can continue to view operational participant/lineup lists.
- Players can mutate only their own RSVP/selection response.
- Leaders, founders, and explicitly authorised officers can manage attendance and lineups.
- Former members can view only their own historical/correction-relevant rows if a future read model is added.
- Admin/support can correct records under support policy.
- Every mutation must validate actor identity, active membership, role permission, source state, timing window, target eligibility, schedule conflicts, idempotency, audit logging, and notification dedupe server-side.

## Privacy model

- Absence reasons, if implemented, should be optional and private to the player, authorised managers, and support.
- Private free text must not appear in contribution feeds, notification bodies, public profiles, public gig pages, or general audit metadata.
- Operational statuses may be visible to current active band members because rehearsals and lineups are band operations.
- Dispute evidence should use source rows, schedule records, notifications, and audit records, not private message scraping.

## Anti-abuse model

- Missed statuses create no automatic penalty in beta.
- Final status changes are time-limited and auditable.
- Declines and removals should release active schedule blocking where possible.
- Notification dedupe/batching is required to avoid manager or participant spam.
- Denied permission attempts should be logged for support review.
- Repeated false missed marks, revenge removals, farming patterns, late churn, and abusive correction requests should be detectable through audit records.

## Delivery sequence

1. **Phase 4 PR 06:** Rehearsal self-response MVP.
2. **Phase 4 PR 07:** Leader rehearsal finalisation MVP.
3. **Phase 4 PR 08:** Gig lineup management MVP.
4. **Phase 4 PR 09:** Performer confirmation and lineup lock MVP.
5. **Phase 4 PR 10:** Correction/dispute MVP and Phase 4 review.

## Recommended Phase 4 PR 06

Implement rehearsal self-response only:

- Add the minimum schema support for `confirmed` and `declined` rehearsal responses.
- Add `respond_to_rehearsal_invitation` as an own-row RPC with deadline, membership, idempotency, audit, and notification checks.
- Add a compact RSVP control and deadline display to existing rehearsal UI.
- Do not add manager finalisation, rewards, penalties, XP, chemistry changes, contribution scores, gig lineup mutations, or disputes in PR 06.
