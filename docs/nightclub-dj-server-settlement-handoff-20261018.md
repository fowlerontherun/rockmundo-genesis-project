# Nightclub DJ Phase 5 — authoritative server-only settlement

**Production deployment:** 18 October 2026, Supabase ledger
`20261018074417_dj_server_only_atomic_session_settlement_20261018.sql`
(ledger name `dj_server_only_atomic_session_settlement_20261018`).

## Implemented

- `dj_performance_sessions`: one live/completed performance per booked DJ set,
  with immutable-at-start server-sampled inputs, verified song list, start time,
  skill level, stage presence, charisma, club tier and promised payout.
- `dj_settlement_ledger`: one unique settlement per booking, session and
  booked performance history row, with immutable payout and XP details and
  owner-readable row-level security.
- `player_dj_performances.booking_id` unique partial index separates verified
  bookings from legacy immediate-play history. An authenticated client cannot
  forge a booked entry by supplying a booking ID.
- `start_dj_booking_internal(booking_id)`: service-role-only, uses authoritative
  server time, validates signed-in booking owner, due window, club city and fame,
  energy, canonical Schedule entry, and rechecks every game's owner/shared
  song consent or the admin track's current rights status. One start consumes
  25 energy and opens exactly one session. Replays return the original session.
- `settle_dj_booking_internal(booking_id)`: service-role-only, requires the
  set to have reached the booking's end and to have a real live session.
  Server-calculated bounded score, payout, fame and canonical DJ skill XP
  are committed in one Postgres transaction together with the dedicated
  ledger, booked history, XP audit and completion of both DJ booking and
  linked Schedule. Profile cash updates automatically flow through the
  existing financial account journal trigger (do not journal the cash twice).
  Retry returns the same history ID and never repeats rewards.
- `private.dj_start_booking_at` and `private.dj_settle_booking_at` accept an
  effective timestamp for trusted owner-only SQL fixture tests. Neither the
  private schema nor its functions is executable by the authenticated or
  anonymous client, or directly by `service_role`. Service-role public
  wrappers always use `clock_timestamp()`.

## Release constraints

This is a **server-only backend slice**, NOT a playable paid-DJ feature.
`useDjPerformance.ts` still uses the legacy client-side instantaneous
outcome and is deliberately unchanged; no new booking/start/settlement
buttons have been deployed. Client users cannot call the new payout RPCs.

The new canonical DJ payout records **zero fan conversions** until an
authoritative city/character fan model is integrated. Never claim that
`fans_gained` represents actual fan population changes. The legacy
random addiction roll is not transferred to the new lifecycle; addiction
changes need their own authoritative, tested handling.

Remaining blockers before cutover: end-to-end game-world timing semantics,
no-show/missed/cancel paths, security-reviewed server orchestration from
verified user sessions, band/club owner approval and fee configuration,
real performance inputs from mixing minigame, city fan conversion, equipment
readiness, club history/reputation, replay and failure recovery, and
browser tests with multiple characters. The old instant payout path must
be retired only when all trusted booking and settlement flows are wired.

## Production test evidence

Rollback-only SQL test
`supabase/tests/dj_atomic_booked_settlement_harness.sql` PASSED live:
valid owner booking and one-time start, early-start denial, cross-account
start/settlement denial, revoked/unplayable audio denial with no energy cost,
early settlement denial, deliberate booked-history unique-constraint failure
after attempted wallet/XP writes with complete rollback, successful payment
and one ledger/history/XP record, Schedule completion, idempotent replay,
owner RLS reads, forged booked-result denial and private schema isolation.

Post-run **0 booked DJ records; 0 active sessions; 0 settlements; 0 booked
performance history; 0 DJ XP audit rows**. Normal authenticated users cannot
call either payout RPC. Two owner-only RLS policies exist.

Do not switch on public booking or payouts until a full launch QA gate
passes; server authority prevents new exploits but does not repair the
separate legacy direct browser update pathway by itself.

Issues: #4234 #4246 #4258.
