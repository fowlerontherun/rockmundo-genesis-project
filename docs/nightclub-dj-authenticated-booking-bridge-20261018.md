# Nightclub DJ Phase 6 — verified player bridge, no-show and gated UI

Deployed to RockMundo production Supabase, 18 October 2026.

## Live migrations

- `20261018081201_dj_verified_action_dispatch_and_missed_lifecycle_20261018.sql`:
  `dj_verified_player_action_service` provides a **service-role-only** dispatch
  to reserve, cancel, start, settle and mark-missed RPCs. A caller's account is
  verified by Supabase Auth in the Edge Function, **not** provided by browser
  JSON. The dispatcher temporarily binds the verified account as the
  transaction-local auth subject, allowing existing service-only booking
  procedures to resolve ownership and use the correct multi-character profile.
  The verified account claim is restored before returning.
- `20261018081810_dj_missed_booking_cron_reconciler_20261018.sql`:
  trusted `dj_process_missed_at` reconciles never-started `booked` and
  `ready` slots once their end + 10 minute grace passes. A scheduled
  `pg_cron` job named `dj-mark-missed-sets` runs every 15 minutes and
  processes at most 50 records per run under row locks. The SQL cron command
  embeds **no API keys, JWTs or bearer secrets**. A missed set updates the
  character's canonical Schedule entry, charges **zero energy**, and produces
  **no payout, fame, fans or XP**. A live or completed set is not marked missed.

Both migration files are committed with their actual production ledger versions.

## Live Edge API

`supabase/functions/dj-booking-action/index.ts` is deployed as the active
`dj-booking-action` Supabase Edge Function with `verify_jwt=true`.
It verifies each supplied bearer token through Supabase Auth, takes the
actor's user ID only from the verified Auth response and forwards requests
to the private service-role dispatch RPC.

**Feature OFF by default**: unless the Edge environment variable
`DJ_SCHEDULED_BOOKINGS_ENABLED=true` is explicitly set, reserve/start/
settle/missed actions receive 503. Cancel remains available so a previously
reserved booking can still be cancelled after the feature is paused.
The UI also requires `VITE_DJ_SCHEDULED_BOOKINGS_ENABLED=true`.

There are no known live bookings and neither flag was enabled as part of
this change. Do **not** switch the flags on yet; see blockers below.

## Player interface implementation

`DjBookingPanel.tsx` is integrated into NightClubDetail behind the
client release switch. When eventually enabled, it lists owned saved DJ
sets and the club's owner-readable bookings, allows a selected local
datetime to be submitted to the server, surfaces server-side eligibility/
conflict errors, and allows cancellation of upcoming reservations. The
server converts input to UTC and validates the nightclub's own local
timezone and all calendar conflict protections. The UI is intentionally
hidden for existing players until the complete game loop is ready.

Existing `Queue for DJ Slot` instant-play rewards remain unchanged for
compatibility; this code does **not** make those legacy browser writes atomic.
The legacy path must be retired at full cutover to #4234.

## Live testing

Six rollback-only SQL suites **passed** on production Supabase:
`dj_verified_player_bridge_missed_harness.sql`,
`dj_atomic_booked_settlement_harness.sql`,
`dj_internal_booking_reservation_harness.sql`,
`dj_course_and_band_membership_overlap_harness.sql`,
`dj_new_band_gig_conflict_harness.sql`,
`dj_booking_club_hours_harness.sql`.

The bridge harness verifies genuine service_role dispatch, an actor from
another account being refused, idempotent booking retries and JWT claim
cleanup. The missed-set tests validate pre-grace denial, the bulk worker
marking a slot exactly once, Schedule's missed state, and no debit/reward.
Direct privileged cron-worker invocation without fixtures returned **0**.

Post-test production: 0 DJ reservations, 0 performance sessions, 0
settlements and 0 linked DJ calendar rows; authenticated accounts do not
have direct EXECUTE on the service dispatcher or sweeper. Supabase confirms
an active 15-minute cron schedule, and the Edge endpoint is active with
JWT verification.

## Hard release blockers

1. Server-authoritative player-facing **due-time** performance experience:
   DJ Mixing Studio must actually track the set performed, distinguish
   rehearsing from an eligible live gig and emit non-forgeable completion
   evidence. The present server-only settlement uses booked time, not
   genuine deck performance telemetry.
2. Actual clock model: RockMundo's simulated game calendar and venue
   local-time booking semantics must be reconciled before offering real
   reservations to players.
3. Verified nightclub owner approvals and policy for fixed vs free slots,
   cancellation fee policy, and 3D stage/club scenes.
4. Reliable end-to-end web/mobile tests, nightly missed-set worker logs,
   browser authentication, sound permissions and release monitoring.
5. Replace the old `useDjPerformance` instant browser payout code,
   handle equipment/crowd feedback and fan-conversion pipeline before
   enabling any public paid scheduled DJ bookings.

**Do not set either release flag to true solely because the SQL tests pass.**

Related issues #4246, #4234 and epic #4258.
