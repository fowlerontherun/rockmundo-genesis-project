# Backlog B7 — collaboration, invitations and fan voting completion

## Status

`COMPLETE`

B7 now keeps performer collaboration, rivalry objectives, fan voting, setlists, realtime refresh, and performer notifications behind canonical festival authority.

## Direct artist invitations

- Reuses `festival_artist_invitations` and the existing edition-scoped organiser invitation mutation as the write authority.
- `list_my_festival_artist_invitations(p_band_id)` exposes only invitations addressed to the authenticated player or an active band they belong to and projects `can_respond` from the existing server-side artist-authorisation helper.
- `respond_to_festival_edition_artist_invitation(...)` verifies the invitation belongs to an edition-backed artist programme and delegates to the existing idempotent response authority.
- The player Invitations tab provides explicit interested/declined actions. An interested response still cannot create a contract or reserve a slot; the organiser must convert it into a formal canonical offer.

## Guest and featured performers

- Added canonical `festival_performance_collaborations` records tied to an active festival contract.
- Band/organiser managers can invite a player as a `guest` or `featured` performer with an explicit obligations payload.
- The invited player must explicitly accept those obligations; the accepted snapshot is frozen separately from the proposed obligations.
- Accepted collaborators are added to canonical performance attendance/readiness snapshots and therefore participate in the same arrival/performance lifecycle as the contracted band.
- Setlist rows may reference an accepted collaborator through `guest_profile_id`. Database enforcement and setlist preflight reject unaccepted guests or songs outside a collaborator's accepted `song_ids` scope.

## Canonical rivalry objectives

- Added contract-to-contract festival rivalry objectives for bands booked into the same edition.
- The challenged band must explicitly accept before the objective becomes active.
- Rivalry resolution reads only final canonical `festival_performance_outcomes.overall_score` values; there is no browser-supplied rivalry score modifier.
- Resolution evidence records both canonical outcome IDs and scores so the result remains auditable and replay-safe.

## Organiser-gated fan voting

- Organisers can open a vote only for a canonical stage slot that is still open and unreserved.
- Candidates must come from canonical festival applications and are revalidated against application state, the stored canonical eligibility snapshot, existing bookings, and current slot authority when added and again when a vote is cast.
- Each authenticated profile receives one server-controlled vote with weight `1` per vote window.
- Closing a vote returns ranked advisory results only. It does not assign the slot, create a contract, or mutate booking authority; the organiser must still issue the normal canonical offer/contract.

## Repertoire-backed setlists

- The canonical setlist editor selects songs only from `festival_contract_repertoire`.
- `festival_setlist_preflight` checks repertoire, duration, duplicates, availability, and accepted guest-performer obligations before persistence.
- Accepted guest/featured performers can be attached to individual songs in the setlist editor.
- Existing authoritative save/submit/review/lock RPCs remain the mutation boundary.

## Realtime refresh and notifications

- Player and organiser festival workspaces now subscribe to canonical invitation, setlist, contract, stage-slot, collaboration, rivalry, and fan-vote changes and invalidate the festival booking query cache.
- Active-contract stage/time/status changes generate deduplicated lineup-change notifications for band members and accepted collaborators.
- A scheduled runtime processor sends deduplicated 24-hour and 2-hour performance reminders and resolves accepted rivalry objectives from final canonical performance outcomes.

## Verification coverage

- Added a B7 database contract suite covering accepted collaboration obligations, guest attendance snapshots, rivalry outcome authority, fan-vote eligibility/booking separation, RLS/direct-write restrictions, notifications, and realtime invalidation wiring.
- Confirmed against the live RockMundo schema that the implementation dependencies exist: canonical contracts, performance sessions/outcomes, direct invitations, stage-slot contract authority, notification columns, performer profile references, and `pg_cron`.

## Authority rules retained

- Browser clients do not insert or update authoritative collaboration, rivalry, or fan-vote rows directly.
- Expressing interest in a direct artist invitation cannot create a performance contract or reserve a slot.
- Fan voting never becomes booking authority.
- Rivalries consume final server outcomes rather than modifying scores from client input.
- Setlist selection comes only from the contracted band's server-projected repertoire and accepted guest obligations are revalidated in the database.
