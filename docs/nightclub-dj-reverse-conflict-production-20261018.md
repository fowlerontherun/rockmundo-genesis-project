# DJ Phase 4 — reverse activity conflict protection

Deployed to production Supabase on **18 October 2026**. This work closes a
calendar race: a player reserved for a nightclub DJ set must not subsequently
travel, attend an overlapping recording, rehearse with a band, work, take an
overlapping tour leg or enrol on a conflicting daily university class.

## Applied migrations

- `20261018070842_dj_reverse_activity_booking_conflicts_20261018.sql`
  – five new source-of-truth BEFORE INSERT/UPDATE triggers: personal travel
  history, recording sessions, current work/study activity statuses, band
  rehearsals and tour travel legs. Band and tour checks include active band
  members who travel with the band. The shared helper acquires the same
  per-character advisory transaction lock as the DJ booking RPC.
- `20261018071301_dj_reverse_university_enrolment_guard_20261018.sql`
  – additional enrolment trigger that checks the daily local university class
  window, campus IANA timezone and enrolment dates against existing booked
  DJ slots. Existing DJ booking forward checks remain in force.

Both migration filenames match the live Supabase migration ledger versions.

## Verified

The existing rollback-only integration harness
`supabase/tests/dj_internal_booking_reservation_harness.sql` now uses a real
eligible character with relevant activity-source records, reserves a DJ set
inside a legitimate club window, then attempts overlapping travel, recording,
work, rehearsal and band tour changes. Each was rejected with exclusion
violation (`23P01`); the same SQL transaction tests overlapping recurring
university enrolment using a valid morning club and basic course in the
same timezone. The full harness PASSED against live Supabase.

Post-run verification: **6 reverse triggers installed, zero DJ bookings, zero
linked DJ calendar records, and authenticated users still have no EXECUTE on
reserve/cancel DJ booking RPCs**. No player cash, fame, XP or history was
persistently modified; tests ended with ROLLBACK.

## Remaining release blockers

- **Do not expose the player booking controls yet.** New DJ booking remains
  service-role-only and does not pay any rewards.
- The authoritative booking lifecycle and once-only ledger-backed DJ performance
  settlement (#4234) still need implementation before replacing the current
  instant DJ buttons.
- Existing university *course timetable edits* and subsequent band-member
  joins may change a person's commitments; those reverse paths require a
  dedicated policy and validation test before accepting player bookings.
- Travel records without a profile ID cannot be reliably reconciled to a
  specific character and are not validated by this guard. Fix provenance
  at the travel writer rather than guessing which character is affected.
- Booking UI should explain a real conflict and offer a different slot, never
  silently override an existing DJ booking.
- Three nightlife venues have invalid or unresolved DJ operating hours
  documented in `docs/nightclub-dj-booking-foundation.md`.

The safe rollback is to keep the new DJ reservation feature disabled, not
reintroduce permissive scheduling or allow client-generated gig payouts.

Tracking: #4246, #4234, #4258.
