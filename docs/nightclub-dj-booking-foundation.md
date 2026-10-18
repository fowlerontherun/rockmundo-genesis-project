# DJ nightclub booking — Phase 4 internal reservation foundation

**Status:** Database-only backend staging; NOT enabled as a player booking or
paid performance feature. Related #4246, #4234, #4258.

## Live database receipt

Applied to RockMundo Supabase on 18 October 2026, migration:
`20261018060727_dj_internal_reservation_foundation_20261018.sql`
(ledger name: `dj_internal_reservation_foundation_20261018`).

Introduces `public.dj_bookings`, an owner-readable/private booking table
with immutable-at-insert setlist snapshots, version, club and character IDs,
scheduled UTC start/end, booking status and a per-user idempotency key.

Introduces `public.reserve_dj_booking_internal(profile, club, set, start,
request_id)`. It rechecks character ownership, current city, minimum club
fame, setlist ownership and currently playable song/club-audio rights. It
takes transaction-scoped profile and club locks, checks overlaps with other
DJ bookings, scheduled activities and active band gigs, and stores the
authorized setlist snapshot. It performs **no** money, fan, experience,
energy or reputation changes.

## Access and activation lock

Only `service_role` can execute the reservation function. Normal players
cannot insert/update/delete `dj_bookings` or call the booking function.
An owner can read their own bookings through RLS when a later approved
client/UI feature is released.

This is deliberate: the current instant DJ button in the old client still
uses client-side rewards and is **not** migrated by this PR. No new
booking controls should be exposed until the following blockers land.

## Blocks before enabling actual DJ booking

1. **Operating hours and slots.** Club `dj_slot_config.schedule` is free
   text (examples include `11pm-3am` and ambiguous `10pm-12pm`). Normalize
   business-hour windows and city timezone; do not guess or simply allow
   arbitrary UTC reservation times.
2. **Calendar projection.** Atomically create and cancel the canonical
   `player_scheduled_activities` entry, prevent edits to system-owned DJ
   entries, show bookings in Schedule and club/character pages, and include
   travel, work, practice, recording and education as authoritative conflicts.
   Existing band-gig and player schedule overlaps are only baseline checks.
3. **Booking and cancellation UX.** Server-approved slot discovery, explicit
   set duration, club fame requirements, location and double-booking feedback.
4. **Lifecycle and payouts.** At due time validate location, rights and gear
   again, persist ready/live/resolving transitions and enforce one atomic,
   idempotent server-side settlement (separate #4234). Only then replace both
   instant Queue for DJ Slot buttons.
5. **Club contracts.** Owned club approval, changes/cancellations, NPC slots
   and time-zone boundaries need tests before player release.

## Verified (production, transaction rolled back)

`supabase/tests/dj_internal_booking_reservation_harness.sql` passed on
live Supabase. It exercised idempotent retries, same-DJ/club overlap
rejection, foreign-account authorization, unique request mismatch, and
asserted unchanged cash/fame. No test booking or setlist persisted.

Direct authenticated INSERT/UPDATE/DELETE grants are false; anon and normal
authenticated EXECUTE grants on the reservation function are false. One
owner-readable RLS policy exists and production booking count was zero
after tests.

## Rollback

Do not expose booking creation while this is an internal data model.
If a later integration is blocked, keep the table inactive and the execute
grant restricted; avoid dropping historical reservations once players have
booked. Any future removal needs an explicit ledger reconciliation and
data/export plan.

## October 18 follow-up: local-hours guard (applied)

Migration `20261018061512_dj_reservations_local_club_hours_20261018.sql`
(ledger name `dj_reservations_local_club_hours_20261018`) adds
`dj_clock_minutes`, `dj_booking_inside_club_hours` and a table INSERT/
start/end/club UPDATE trigger. The trigger **rejects** any reservation that
falls outside the verified club window in its city's IANA timezone; the full
set, including its end, must fit. Overnight windows such as 10pm–4am
correctly include 1am on the following local day. This uses the existing
`cities.timezone` field, not the player's device locale.

Live data audit: 72 clubs and 24 distinct schedule strings. Standard ranges,
including midnight/noon and legitimate up-to-12-hour overnight ranges,
parse. Three configurations deliberately fail closed pending explicit owner
correction: **The Black Sheep** (`10pm-12pm`, 14-hour ambiguity), **Berghain**
(`midnight-Monday`, a weekday not an endpoint), and **The Haccienda**
(missing hours). Other ranges over 12 hours will also fail closed until a
structured schedule exception/override is approved.

Both SQL test harnesses passed against the live DB after this change:
`dj_booking_club_hours_harness.sql` tests timezone-local overnight hours,
midnight after closing, incomplete ranges and invalid inputs;
`dj_internal_booking_reservation_harness.sql` now uses a genuine eligible
club's local 10pm/11pm opening time and passes idempotency, double-booking,
foreign-account and zero-payout checks. All test inserts rolled back.

**Still not enabled:** the reservation RPC remains service-role only.
This guard does not replace an availability grid, per-weekday opening calendar,
travel validation, mirror activity schedule or the atomic gig settlement
pipeline. Do not expose a Book DJ Set button solely because basic hours
validation is now in place.

## October 18 continued: atomic player Schedule projection

Applied in production via two versioned migrations:

- `20261018063240_dj_booking_atomic_calendar_projection_20261018.sql`:
  adds the FK/unique `player_scheduled_activities.linked_dj_booking_id`,
  makes `dj_set` a first-class activity type, creates exactly one calendar
  entry per DJ booking transaction, guards both client-authenticated edits
  and overlapping newly scheduled activities, and adds a *service-role-only*
  idempotent cancellation RPC that atomically marks the calendar cancelled.
- `20261018063456_dj_booking_projection_generated_duration_fix_20261018.sql`:
  fixes the first migration's projection function to respect that the
  calendar `duration_minutes` column is **GENERATED ALWAYS**. The initial
  insertion failed and rolled back in the first live test; the corrected
  function was then deployed, and the full test passed.

A booking appears as a distinct **DJ set** in the player's existing Schedule,
with nightclub name/city, club deep link, scheduled time, duration and status.
It is system-owned, so no player can self-mark a set completed, forge or
delete the linked activity. Ordinary activities (including education/reading)
cannot newly overlap a booked DJ slot. Slot creation and calendar creation
are one database transaction: either both succeed or neither persists.

The extended `dj_internal_booking_reservation_harness.sql` ran in a
production transaction rolled back at the end. It passed booking/calendar
one-to-one projection, idempotent retries, same-night conflict, future reading
conflict, user-forged activity denials, owner direct update/delete denials,
server-only cancel, repeat cancel, rebooking after cancel, and foreign-user
isolation. Live post-test counts: zero bookings, zero linked DJ entries.
Ordinary players remain unable to execute either reservation or cancellation
RPC. DJ performance payout logic remains unchanged and must be replaced
before player-facing scheduled bookings are enabled.

**Remaining:** cross-source schedule conflict audit (travel/education generated
outside `player_scheduled_activities`), venue owner approval and structured
opening-day calendars, booking UI, and server-authoritative start/completion
and atomic rewards #4234. A cancelled appointment is still retained in
history; it is not hard-deleted.

## October 18: reject non-mirrored schedule conflicts

Applied migration `20261018064510_dj_external_schedule_source_conflict_guard_20261018.sql`
(ledger name `dj_external_schedule_source_conflict_guard_20261018`).

Existing player Schedule assembles some entries directly from their source
tables. A DJ booking that checked only `player_scheduled_activities`
could therefore overlap real commitments. The new server-side
`dj_external_schedule_conflict` function and DJ booking INSERT/UPDATE
trigger also check:

- Scheduled and active personal travel, plus band-tour travel legs.
- Recording studio sessions and active band rehearsals.
- Active shift/travel/recording/study activity-status rows.
- Enrolled university courses with daily scheduled classes, using the
  actual campus's IANA timezone and the student's enrolment date window.

Missing/invalid active university-class timezones or class hours fail closed.
The helper is not executable by `anon` or `authenticated`. This guard also
checks direct privileged booking writes, not only the reservation RPC.

**Verification:** `dj_external_schedule_conflicts_harness.sql`
passed in a production transaction subsequently rolled back. It tests a
future trip in `player_travel_history` and an active recurring university
class in its campus timezone using real fixture records. The existing full
reservation/calendar harness also passed after deploying this guard.

**Remaining concurrency caveat:** this detects authoritative commitments
present **when** a reservation is inserted or updated. Not all legacy
travel/studio/university booking writers yet acquire the matching DJ
advisory lock or check existing DJ reservations on their own writes.
Before public enablement, update those writer paths or a shared booking
service so future commitments cannot be made over an existing DJ slot.
The private booking API stays locked to `service_role`.
