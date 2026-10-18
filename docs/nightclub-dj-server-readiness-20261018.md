# Booked DJ set readiness — server-authoritative checklist

**Applied to production Supabase** on 18 October 2026:
`20261018141040_dj_live_mixer_owner_readiness_status_20261018.sql`.

## Why

The previous live DJ mixing screen counted some accepted events but did not
tell players whether they had satisfied the *actual* settlement requirements.
Consequently a player could attempt to finish after spending the scheduled
slot and receive a server-side rejection without clear next steps.

## Change

`public.dj_live_mix_readiness(booking_id)` is a strictly read-only
`SECURITY INVOKER` database function. It returns an owner-scoped JSON
checklist using the same criteria as the actual
`require_dj_live_mix_for_settlement` trigger:

- 6 server-accepted mixer events
- both deck A and deck B play interactions
- a tempo adjustment and a crossfade
- at least 60 seconds between first and last accepted event
- at least one event after the scheduled set midpoint
- real server time at or past the booked end for settlement

It returns the booking's current status, criteria and `can_settle`.
Unauthorized accounts, anonymous requests and missing bookings cannot
inspect other characters' performance readiness. The RPC neither records
new mixer events nor writes money, fame, XP, fans or history.

Both the live mixer and booked-set panel use one shared React Query hook
(`djReadiness.ts`). The mixer displays exactly what is missing, based on
the server response; the booked-set **Finish and verify** button stays
disabled until the server marks every requirement satisfied and the slot
has finished. Query status refreshes every 15 seconds and immediately
after accepted mixer actions. Practice mode remains reward-free.

## Production validation

All six DJ SQL harnesses were rerun on live Supabase using
`BEGIN ... ROLLBACK`, including an extended
`dj_atomic_booked_settlement_harness.sql`. That verifies empty session
readiness, the six-event valid mixer sample, owner access, foreign account
denial, and that a completed set no longer advertises further payout.
Existing idempotent cash/XP settlement, club hours, university/rehearsal,
live no-show and booking conflict tests remain passing.

Post-test production: **0 bookings, 0 accepted live mixer events,
0 settlement records and 0 linked DJ calendar entries**.
The missed-set cron remains enabled. An authenticated owner may call the
readiness RPC, but anonymous users cannot, and ordinary players still
cannot invoke the privileged mixer event writer.

## Release controls and caveats

The two separate DJ scheduled-booking flags remain **OFF**; neither
scheduled player booking nor the replacement of legacy instant browser
DJ rewards has been activated. All readiness data is derived from
server-recorded timestamps, but the browser can still simulate control
inputs; it is not cryptographic evidence of audio output. Real-browser
mobile/desktop playback, venue approval, proper simulated calendar
semantics and beatmatching gameplay remain launch gates.

Related issues: #4246, #4234, #4248 and epic #4258.
