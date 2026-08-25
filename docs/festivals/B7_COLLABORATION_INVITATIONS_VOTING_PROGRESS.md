# Backlog B7 — collaboration, invitations and fan voting progress

## Phase 1 started

This branch begins backlog B7 by closing two existing player-workspace gaps without introducing parallel festival authority.

### Direct artist invitations

- Reuses `festival_artist_invitations` and the existing edition-scoped organiser invitation mutation as the write authority.
- Adds `list_my_festival_artist_invitations(p_band_id)` as a narrow player projection. It exposes only invitations addressed to the authenticated player or an active band they belong to and projects `can_respond` from the existing server-side artist-authorisation helper.
- Adds `respond_to_festival_edition_artist_invitation(...)` as an edition-scoped response boundary. It verifies the invitation belongs to an edition-backed artist programme and delegates to the existing idempotent response authority.
- Adds a player Invitations tab to the canonical festival hub with explicit interested/declined actions. An interested response does not create a contract or slot; the organiser must still convert it into a formal offer through the existing canonical workflow.

### Repertoire-backed setlists

- Replaces free-text song UUID entry in the canonical setlist editor with the existing `festival_contract_repertoire` projection.
- Uses `festival_setlist_preflight` while editing so invalid, duplicate or unavailable repertoire and duration/readiness blockers are visible before save/submit.
- Keeps the existing authoritative save/submit/review/lock RPCs as the mutation boundary.

## Remaining B7 scope

B7 remains `PARTIAL`. The next phase still needs:

- explicit accepted obligations for guest/featured performers;
- canonical rivalry objectives and outcome evidence;
- fan voting for organiser-approved eligible open slots, without automatic booking authority;
- realtime invalidation for invitation, setlist and lineup changes;
- lineup-change and performance-reminder notifications;
- focused behavioural/database regression coverage and the final backlog status update.

## Authority rules retained

- Browser clients do not insert or update invitation rows directly.
- Expressing interest in an invitation cannot create a performance contract or reserve a slot.
- Setlist selection comes only from the contracted band's server-projected repertoire and is still revalidated by the canonical save/submit functions.
