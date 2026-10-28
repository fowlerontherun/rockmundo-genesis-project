# City Scene source replay — rollout and recovery

**Status:** Review and test only. The replay feature is disabled by default; do not enable until the isolated PostgreSQL replay integration passes.

## Why this exists

The normal gig and rehearsal scoring cursors progress by `completed_at`; recording cursors progress by `updated_at`. If an authoritative game result is finalised or imported late with an earlier timestamp, a normal forward-only worker will skip it.

`20261028121000_scene_late_source_replay.sql` adds a separate, bounded replay cursor for each supported verified source: gigs, studio recordings and band rehearsals. It replays the trailing **seven days** based on the event's own completion timestamp, waiting at least **15 minutes** after completion. The replay calls the existing trusted event ingesters; it does not trust bookings, player clicks, invitations or self-reported attendance. Existing unique contribution constraints, daily city affiliation and personal cycle caps still apply.

## Safety and limits

- `scene_source_replay_controls.enabled` is seeded **false**. No new cron is registered and the production worker takes no replay action until the switch is enabled.
- Separate source controls in `scene_source_controls` must remain enabled; the global scoring switch and the challenge objective's source-health snapshot are both rechecked.
- Per-source progress is stored in `scene_source_replay_cursors`, independent of the normal forward cursor. Each worker tick rechecks at most **100 events per source**, using a caller-provided limit (default 50).
- If events remain, the next 15-minute worker tick resumes where the replay left off. At the end of a complete sweep, the cursor resets to the rolling seven-day start and waits **one hour** before the next sweep. Replaying a scored event never issues points a second time.
- The latest completion window remains protected by the 15-minute settlement delay.
- **No XP payout function is invoked.** Scene reward policies and the separate payout-approval gate remain independent.
- Private replay functions and control/cursor tables have no player-facing grant or RLS access.

## Verification before enabling

Run the dedicated City Scene PostgreSQL CI workflow, including `city_scene_source_replay_weekly_integration.sql`, on a disposable Postgres database. The fixture reproduces an older gig, recording and rehearsal after the main cursors have advanced, then confirms recovered contributions, no duplicates, source kill switches, cooldown and zero XP grants. The migration has additionally passed a rollback-only execution against the real RockMundo schema with replay disabled.

After CI passes, verify that the live three source cursors, RLS and indexes are healthy, and inspect the initial scan candidate volume. Do not change player credits manually or reset the existing forward cursors.

## Controlled activation (DB operator only)

After reviewing source volume and CI, enable the dedicated replay switch:

```sql
update public.scene_source_replay_controls
set enabled=true,updated_at=now()
where singleton=true;
```

Use the normal 15-minute `rockmundo-city-scene-verified-v1` worker. Inspect `events_rechecked` and `contributions_recovered` in `scene_source_replay_cursors` and confirm `private.scene_source_integrity_preview(100)` finds no suspected discrepancies.

## Immediate disable

```sql
update public.scene_source_replay_controls
set enabled=false,updated_at=now()
where singleton=true;
```

This stops replay while leaving normal fresh-event scoring intact. For a global emergency stop, use `scene_rollout_controls.scoring_enabled=false` and suspend the named cron. Never delete contribution or receipt history to force replay.

## Scope limitation

This feature cannot resurrect sources older than the existing seven-day event/cycle grace period, nor reconstruct evidence that the canonical gig, recording or rehearsal systems never persisted. Those require a separately reviewed historical reconciliation; they must not bypass player consent, credit caps or paid-reward safeguards.
