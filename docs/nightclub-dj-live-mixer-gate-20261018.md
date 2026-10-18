# Phase 7 — Booked nightclub DJ mixer evidence and settlement gate

**Production deployment:** 18 October 2026, Supabase project `yztogmdixmchsmimtent`.

## Applied database migrations

- `20261018082915_dj_server_timed_mixer_evidence_settlement_gate_20261018.sql`
- `20261018083044_dj_verified_live_mix_event_service_dispatch_20261018.sql`
- `20261018083940_dj_live_mixer_trigger_permission_hardening_20261018.sql`
  (post-deploy security-advisor fix revoking explicit anon/authenticated
  EXECUTE grants on the internal trigger functions).

The new `public.dj_live_mix_events` table is an immutable, owner-readable,
**server-written** event ledger. All ordinary authenticated/anonymous accounts
are denied table INSERT/UPDATE/DELETE and direct event or dispatch RPC access.
Client events are accepted only through a JWT-verifying Edge Function and
a service-role-only dispatcher; each records a server timestamp, ordinal and
the real booking/session/character IDs.

Supported events: **deck_play** for a track belonging to the immutable booked
setlist, **tempo** from 85–115% and **crossfade** from 0–100%. Two seconds must
pass between counted interactions in the same session; there is a hard limit
of 120 per set. DJ source-song consent and admin music rights are rechecked on
every play event. Events are rejected outside the live session's booked window,
from a different account, or for a track not in the booked snapshot.

A new BEFORE INSERT trigger on the authoritative `dj_settlement_ledger`
**fails the entire payout transaction** unless the booked live session has:

1. At least **six** accepted server-timestamped mixer events.
2. Deck-play actions recorded for **both A and B**.
3. At least one tempo adjustment and one crossfader action.
4. A minimum 60-second spread between first and last accepted event.
5. At least one event after the midpoint of the scheduled set.

This check occurs after the existing settlement procedure's reward
calculations but **before its ledger insertion**, so insufficient evidence
rolls back *all* cash, fame, XP, history, financial journal, and state writes.
A completed booking's idempotent retry still returns its original outcome
without replaying payout.

These checks demonstrate server-observed timing and interaction, **not
cryptographic proof of audible audio output**. For a future advanced DJ
minigame, add server-generated beat/drop challenges and stronger telemetry
before awarding skill-based scores; the current settled score still comes
from server-owned skill, attributes and deterministic payout bounds, not a
claimed client accuracy percentage.

## Real audio mixer integration

`DjMixingStudio` accepts an optional `liveBookingId`; without it, all
music interactions remain free practice with no server event submissions.
After the **due booked performance is started**, the NightClubDetail booking
panel opens the real two-deck player in live mode and restricts choices to
the booking's saved setlist snapshot. HTML audio's real onPlay event,
tempo-slider onValueCommit, and crossfade-slider onValueCommit call the
authenticated `dj-booking-action` Edge endpoint with event metadata.
The Edge server verifies the JWT, validates controls, and binds the verified
account ID to the service-role event RPC.

A persisted, owner-read DJ event query restores the accepted event count
and deck/tempo/crossfade checklist after the user reloads or reopens the
live studio. The UI counter reports only server-accepted rows, not
unverified client attempts.

The booked-set panel also includes **Start DJ performance**, **Open live
mixing decks**, and **Finish and verify** actions. The server, rather than the
buttons, enforces actual due times, matching club city, energy, rights, paid
settlement evidence and one payout. Failed checks display a useful error;
they do not show uncommitted rewards.

The Edge Function is live **version 2, verify_jwt=true** and the booking
release flags remain **OFF** (`DJ_SCHEDULED_BOOKINGS_ENABLED` and
`VITE_DJ_SCHEDULED_BOOKINGS_ENABLED`). The old instant
`Queue for DJ Slot` client outcome has not been retired by this change.

## Direct live tests and verification

All six rollback-only DJ SQL harnesses passed after deployment, including
the updated `dj_atomic_booked_settlement_harness.sql` proving:

- Early/out-of-window or foreign account actions rejected.
- Unbooked/revoked audio and impossible control values rejected.
- Sub-two-second event spam rejected.
- Payout without mixer evidence fully rolled back with **no** rewards.
- A valid six-event A/B/tempo/crossfade performance passing the mid-set and
  wall-time checks settles **once**, journal and XP included.
- Duplicate booked history injects a failure and **rolls back all** writes.
- The owner can read six events through RLS; another account sees zero;
  authenticated accounts cannot forge event records.
- Normal booking, missed-set cron, club hours, calendar and education/band
  conflict regression suites remain passing.

After the security follow-up, the Supabase advisor stopped flagging the
new SECURITY DEFINER settlement trigger. Direct permission checks confirm
anon and authenticated accounts cannot execute either internal trigger.

After tests: 0 booked DJ sets, 0 session rows, 0 settlements, 0 mix events,
0 linked DJ calendar rows. Verified a live settlement gate trigger and denied
authenticated event INSERT/direct RPC execution. All fixture writes were
rolled back. None of the tests paid a real player's currency.

## Remaining activation and QA

Keep booking flags disabled. Outstanding: actual browser/E2E tests with
usable audio and an authorized test player, live event pacing and telemetry
retry UX, simulation clock vs real UTC slot semantics, attendance/club approval,
a real beatmatch minigame, fan conversion, mobile mixing ergonomics, and
safe retirement of the legacy client-controlled immediate DJ rewards.

Relevant #4248 (beatmatching), #4246 (nightclub scheduled gigs),
#4234 (settlement), #4258 (epic).
