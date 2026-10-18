# DJ Phase 7 follow-up: unfinished live session reconciliation

**Production database:** RockMundo Supabase, 18 October 2026.

Applied migration **`20261018121812_dj_abandoned_live_session_reconciler_20261018.sql`**, reconciled with the production schema-migration ledger.

## Fixed

A player can start a nightclub set (which consumes 25 energy), then close the
browser without completing the live DJ performance. The earlier missed-set
worker handled only bookings that **never started**, leaving such sessions
permanently `live`, blocking later bookings and leaving stale Schedule entries.

The existing `dj-mark-missed-sets` cron runs every 15 minutes. Its underlying
worker now handles two distinct cases:

| Case | Eligible for cleanup | Booking | Session | Rewards |
| --- | --- | --- | --- | --- |
| Never started | Slot end + 10 min | `missed` | None | None; zero energy charged |
| Started but never settled | Slot end + 60 min | `missed` | `abandoned` | None; the 25 energy already spent starting remains spent |

For started sessions, `abandoned_at` records the effective time. Both the
session and Schedule update happen in the same transaction. A settlement
ledger must not exist and a settled or completed set is never abandoned.
Existing completed results and financial journals are preserved.

The worker acquires booking row locks with `SKIP LOCKED` to avoid racing
settlement. Repeated runs do not charge more energy, pay XP, fame, or cash,
or reprocess the same booking. The existing public cron wrapper remains
service-role only; neither the private helper nor its effective-time testing
entry point is executable by normal clients.

## Live validation

The rollback-only production test
`supabase/tests/dj_verified_player_bridge_missed_harness.sql` now verifies a
real authorized player can reserve/start a session, that the worker ignores
it at +59 minutes, marks it missed/abandoned after +61 minutes, marks its
canonical Schedule event missed, consumes exactly the 25 energy originally
charged by starting, grants no other rewards or DJ history, and cannot later
settle the abandoned booking. The earlier unstarted no-show, idempotent
request, actor-ownership and service-role permissions checks remain tested.

**All six** DJ SQL regression suites passed on live Supabase after this
migration, each in a single transaction ending in `ROLLBACK`.

## Activation status

Scheduled DJ booking UI still requires the two independent release flags.
No player booking feature has been enabled here. The old client-controlled
instant DJ reward path is unchanged and must not be retired without an
end-to-end tested scheduled-performance replacement.

Pending: reliable handling of temporarily disconnected clients during live
mixing, authenticated audio session telemetry, game-world time interpretation,
nightclub owner approval, mobile usability and proper player results screens.
Related issues: #4246, #4234, #4258.
