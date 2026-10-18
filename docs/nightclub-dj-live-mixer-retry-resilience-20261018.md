# Scheduled nightclub DJ: reliable live mixer event delivery

**Production:** Directly applied Supabase migration
`20261018125052_dj_live_mixer_idempotent_event_retries_20261018.sql`
on 18 October 2026.

## Problem

A mobile connection can drop immediately after the server accepts a deck or
mixing action but before the response reaches the browser. Previously a retry
would either create a second counted interaction or be rejected by the
two-second anti-spam guard. A refreshed UI could also lose its local counter.

## Deployed fix

- `dj_live_mix_events.client_event_id` is an optional UUID for legacy
  compatibility, unique *per booking* whenever present.
- New private `dj_record_mix_event_once_at` validates **real booking ownership
  first**, then replays an existing event ID only if the entire event payload
  (kind, deck, song source/ID, control value) is unchanged.
- Valid retry returns the original event's UUID even after the booking is
  completed; it does not increment event count, spend additional energy or
  replay a payout. New events after completion remain forbidden.
- A service-role-only dispatcher `dj_verified_mix_event_once_service` gets
  the account ID exclusively from the JWT-verified Edge caller; no direct
  `anon` / `authenticated` execute permission was granted. It uses
  `clock_timestamp()`, not a claimed client timestamp.
- The live `dj-booking-action` Edge Function now requires a valid event UUID
  for mix actions and dispatches to the new exactly-once RPC (deployed
  Edge version **6**, `verify_jwt=true`). Its default-off scheduled DJ
  feature switch stays unchanged.
- The React mixer gives each audio/playback or slider action a new UUID,
  sends actions serially with space for the database's two-second pacing,
  and retries transient failures with the same UUID. 4xx validation errors
  are surfaced rather than endlessly retried.
- Previously accepted events are read through owner-only RLS on reload, and
  the UI shows server-confirmed progress separately from queued actions.

This is transport **idempotency**, not proof of audible output or a solution
for events never sent from an offline browser. A genuine action that never
reaches the server cannot count toward reward eligibility; the mixer does not
cache unsent performance claims locally or backdate them.

## Testing

The updated rollback-only atomic DJ settlement harness passed directly
against production, proving a repeated event key yields the same event ID
and only one stored row, altered payloads cannot reuse the key, a different
account cannot replay it, old IDs can be acknowledged after completion and
new events still cannot be accepted after completion. Once-only payouts and
the original audio-rights checks continue to pass.

Booking bridge/no-show, reservations, course/band and new gig conflict suites
also passed in this run. The nightclub opening-hours test was blocked by
the query interface during this run; it had passed on previous iterations,
and no relevant hours parser or trigger changed in this PR.

## Release gates

Scheduled DJ bookings remain **OFF** until the game-time mapping, club owner
approvals, real-browser/mobile audio QA, city fan handling, minigame scoring,
and removal of browser-controlled legacy instant DJ payouts are resolved.

Tracking #4248 #4246 #4234 #4258.
