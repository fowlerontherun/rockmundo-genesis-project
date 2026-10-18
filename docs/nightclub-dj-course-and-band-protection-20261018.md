# DJ reservation compatibility: course retiming and band joins

**Deployment:** Supabase RockMundo production, 18 October 2026.
Migration ledger version: `20261018072557` /
`dj_course_timetable_and_band_join_conflicts_20261018`.

## What was added

The `dj_bookings` table remains a private, non-paying reservation
foundation with booking/cancellation RPCs limited to `service_role`.

The new database migration adds four reverse conflict triggers:

1. `university_courses`: before class start/end hours or university are
   changed, project the proposed class hours for each currently enrolled
   character and reject edits that overlap an already reserved DJ set.
2. `universities`: before moving the campus to another city, validate
   its proposed city timezone and the affected active class timetables.
3. `cities`: when a city's timezone changes, validate its enrolled
   university students' revised schedules.
4. `band_members`: before a character joins or rejoins an active band,
   or starts travelling with that band, check its scheduled/confirmed gigs,
   upcoming rehearsals and tour travel legs against the character's
   existing DJ reservations.

The timetable and band checks acquire the same per-profile advisory
transaction lock as the internal DJ booking RPC. Both functions are
server-controlled; privileged helper functions have no direct public or
authenticated EXECUTE privilege.

## Live tests

`supabase/tests/dj_course_and_band_membership_overlap_harness.sql`
passed in one rollback-only transaction using an eligible actual player
profile as a fixture. Confirmed:
- An existing morning course cannot be changed to overlap a valid reserved
  nightclub set; a different nonconflicting class time still works.
- A band member marked inactive cannot reactivate while the band's
  booked rehearsal conflicts with that DJ set; reactivation succeeds
  after moving the rehearsal away from the conflict.
- Reservation still mirrors exactly one schedule entry and does not change
  fame or cash.

The full existing `dj_internal_booking_reservation_harness.sql` was also
rerun successfully. After rollback, there are **zero DJ bookings and
zero linked DJ schedule rows**. Four new guard triggers are installed and
authenticated users cannot execute the booking, cancellation or protected
timetable helper functions.

## Remaining feature cutover blockers

- Replacement of the legacy browser `performDjSetAsync` reward logic with
  one authoritative idempotent performance settlement transaction (#4234).
- Player-facing slot discovery, selection, booking/cancellation UX and
  actual due-time lifecycle (#4246).
- Opposite-direction protection when someone schedules a *new band gig*
  after a DJ reservation (not just joins a band with an existing gig).
- Any profile-less legacy travel records still need a separate data
  provenance repair and must not be attributed to the wrong character.
- Audio rights must be revalidated when a performance begins; saved set
  drafts and booking snapshots alone do not establish perpetual consent.

Never activate paid DJ payouts merely because the calendar checks pass.
