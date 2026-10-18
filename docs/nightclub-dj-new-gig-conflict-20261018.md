# DJ booking guard: new or rescheduled band gigs

Applied to live RockMundo Supabase on 18 October 2026.
Migration: `20261018073211_dj_reverse_new_band_gig_bookings_20261018.sql`.

New `public.gigs` BEFORE INSERT / UPDATE trigger
`aa_dj_reverse_band_gig_write` checks every active band member's character
for an already reserved DJ set, using the same advisory transaction lock as
the DJ booking and ordinary calendar path. It checks `scheduled`,
`confirmed` and `in_progress` gigs against the full effective gig interval
(`scheduled_end`, or the 2-hour existing fallback).

The trigger runs before existing gig booking side effects, reducing risk that
a rejected conflicting booking seeds tickets or stage data. Cancelled and
completed historical gigs are unaffected. Existing tour, rehearsal and
membership conflict guards stay in effect.

**Live rollback-only verification:** the test harness
`supabase/tests/dj_new_band_gig_conflict_harness.sql` created an authorized
DJ reservation against a real existing musician and tried to reschedule one
of that musician's band's gigs over the reserved slot. The conflicting gig
update was rejected (`23P01`), a nonoverlapping interval was allowed, the
private calendar mirrored the DJ booking and cash/fame stayed unchanged.
Everything was rolled back.

The booking/cancel APIs remain service-role-only. This does not activate
player booking, start the DJ lifecycle or authorize XP, fans, cash or fame.

**Remaining:** comprehensive browser and multicore concurrency testing,
club owner offer approval, performance start-time authorization, genuine
mixed-audio stage viewer, and one atomic idempotent settlement workflow
(#4234). The old immediate Queue for DJ Slot pathway still exists and must
not be replaced by a partial or browser-controlled reward flow.

Tracking: #4246, #4234, #4258.
