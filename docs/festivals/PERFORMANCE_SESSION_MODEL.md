# Festival Performance Session Model

This PR introduces the canonical lifecycle between an active festival booking contract and a completed festival performance. It deliberately stores settlement-pending evidence only; guarantee payment, merch settlement, ticket allocation, fame rewards, chart changes and long-term financial settlement are deferred.

## PR #1197 audit findings

Reviewed `20291208090000_complete_festival_booking_workspaces.sql`, the booking projection mappers, represented-band selection, eligibility and invitation flows, organiser contract/setlist queues, repertoire and setlist preflight services, realtime invalidation hooks and booking tests. The merged state exposes the intended PR #1197 RPC boundary (`festival_represented_bands`, `festival_application_eligibility`, `festival_booking_slots`, `festival_invitation_candidates`, `festival_contract_repertoire`, `festival_setlist_preflight`) and maps those projections into TypeScript. Player booking surfaces consume the hooks rather than issuing ad hoc table queries. No blocking booking defect had to be rewritten for performance sessions.

## Canonical tables

- `festival_performance_sessions` is the authoritative session row, keyed one-to-one by active `festival_contracts.id`.
- `festival_performance_attendance` snapshots expected band members and approved guests at readiness lock/check-in time.
- `festival_session_equipment` stores required and supplied equipment readiness, issue reasons and remediation metadata.
- `festival_session_crew` stores festival/band crew roles, skill, conflicts and readiness.
- `festival_performance_incidents` records operational issues with severity, source, impact, resolution and stored outcomes.
- `festival_performance_session_events` is an append-only audit stream for creation, arrival, soundcheck, readiness, stage call, progression, cancellation and completion.

## Lifecycle and transition graph

Valid states are `scheduled`, `arrival_open`, `checked_in`, `soundcheck_pending`, `soundcheck_complete`, `ready`, `stage_call`, `in_progress`, `completed`, `partially_completed`, `cancelled`, `no_show` and `abandoned`. The server function `festival_session_can_transition` documents and validates the graph. Terminal states cannot be advanced.

## Creation and setlist evidence

`ensure_festival_performance_session(contract_id, idempotency_key)` locks the contract and stage reservation, requires an active contract, confirmed slot and approved/locked setlist, auto-locks an approved setlist when policy permits, and stores one immutable `setlist_snapshot` preserving order, transitions, encore flags and planned duration. It does not award money or fame.

## Timing windows

`festival_session_timing` provides deterministic arrival, soundcheck, stage-call, start-tolerance and no-show windows. React components display these values but do not own the game-balance constants.

## Progression and completion

`call_festival_band_to_stage`, `start_festival_performance`, `advance_festival_performance`, `cancel_festival_performance_session` and `complete_festival_performance` are server-authoritative RPCs. Song advancement requires the caller's expected setlist position, preventing stale clients from jumping around the set. Completion writes `settlement_pending` and `no_money_or_fame_awarded` evidence only.

## Public projection

`public_festival_performance_sessions` exposes only safe festival, edition, band, stage, schedule, public status, progress counts, headline flag and coarse public incident state. It excludes private health, contract economics, staff notes, authority details, equipment ownership and attendance reasons.

## Festival audience outcome integration

Audience simulation and performance outcomes now read immutable festival session evidence, generate canonical crowd/highlight records for viewers, and leave settlement pending.
