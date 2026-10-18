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
