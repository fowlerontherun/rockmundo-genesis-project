# City Scene Challenges — Live pilot activation

**Date:** 27 October 2026 (UTC)  
**Target:** RockMundo main Supabase project (`yztogmdixmchsmimtent`)  
**Repository:** `fowlerontherun/rockmundo-genesis-project`, branch `main`  
**Status:** **Daily and weekly pilot live; XP payouts OFF**

## Activated scope

- **Four recently active cities:** London, New York, Philadelphia and Tokyo.
- **Eight cycles:** four daily and four weekly, with three goals per cycle (24 objectives).
- **Verified action sources:** completed gig performances, finished studio recordings and completed band rehearsals. The old jam-scoring adapter remains installed but unused because existing jam data lacks separately finalised participants.
- **Monthly campaign:** will first be generated from **1 November 2026**, so it receives a full month.
- Source gates and objective snapshots are enabled only for the supported action types. The source batch ingestion functions remain service-only and deduplicate each player/source event.
- Community target scaling reflects participation: **daily 3 × ceil(active accounts / 20)**; **weekly 3 × ceil(active accounts / 8)**; **monthly 3 × ceil(active accounts / 4)**, each with a minimum multiplier of 1.

## Verified live processing

The first manually invoked source batch scanned 3 gig outcomes, 4 recording sessions and 5 rehearsals within the bounded seven-day source lookback. **Three verified gig contribution rows** were credited. Recent recordings and rehearsals were not eligible within the current weekly period (this is expected and not an ingestion error).

The guarded periodic database worker `private.scene_run_verified_tick(50)` was invoked successfully, finding no duplicate/new events, creating no extra cycles and recording **two earned city-mural milestones**.

Registered one named pg_cron task:

| Property | Value |
|---|---|
| Name | `rockmundo-city-scene-verified-v1` |
| Job ID | `157` |
| Schedule | Every 15 minutes, UTC |
| Command | `select private.scene_run_verified_tick(50);` |
| Last observed run | 27 October 2026, 13:00 UTC — **succeeded** |

Scheduler SQL is committed separately under `supabase/ops/city_scene_verified_scheduler.sql`; it is intentionally not included in the portable migration series.

The `scene-challenges-processor` Edge Function was also updated to **version 2** with rehearsal previews and processing support. Normal recurring production processing uses the guarded database cron rather than Edge secrets.

## Economy and privacy gates

- All **four XP reward policies disabled**.
- `scene_reward_payout_controls.payouts_enabled=false`.
- **Zero** player XP payout receipts and **zero** City Scene reward claims.
- No fame, cash or cosmetic awards have been enabled.
- A permissions audit confirmed ordinary users cannot invoke the private periodic worker, service-only scoring RPCs or XP grant RPC, and cannot update rollout controls. All new `scene_*` tables have RLS.

## Immediate kill switch

To stop future cycle creation and automatic scoring, a database operator can run:

```sql
update public.scene_rollout_controls
set cycle_generation_enabled=false,
    scoring_enabled=false,
    updated_at=now()
where singleton is true;
```

To also suspend the schedule:

```sql
select cron.unschedule('rockmundo-city-scene-verified-v1');
```

The first action makes the periodic worker return without writing; the second removes the cron job. Before re-enabling the pilot, review source snapshots and any pending backlog. Do **not** delete contribution or XP receipt rows to roll back a credit.

## Verification and performance follow-up

- The new `20261027144500_scene_verified_rehearsal_source.sql`, `20261027150000_scene_rollout_controls_and_balanced_targets.sql`, `20261027153000_scene_periodic_worker.sql` and `20261027154000_scene_foreign_key_indexes.sql` were applied to the main DB, and their history versions reconciled to the exact repo filenames.
- Four additional foreign-key indexes were installed after review of Supabase performance advisors.
- The isolated PostgreSQL migration, ACL, cycle balancing, actual rehearsal event/deduplication, mural and XP rollback harness all **passed**. The scoped City Scene Vitest and TypeScript workflows also **passed**.
- PR [#4599](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4599) (rehearsal integration tests) was squash-merged.
- Latest main DB check: **8 cycles, 24 objectives, 3 verified contribution rows, 2 mural milestones, 0 XP receipts**, and cron job 157 still active. First recorded cron execution succeeded.
- RLS is active across all `scene_*` tables. Ordinary authenticated players cannot invoke the worker, contribution ingesters or the XP grant procedure; reward policies and payout controls remain disabled.
- Only complete, XP-bearing band rehearsals belonging to the validated paying band member are credited. Confirmed invitations without durable attendance are never credited.

## XP reward canary safety intervention — 27 October, 14:54 UTC

A live audit at 14:53 UTC found reward settings had changed since the initial pilot deployment: `scene_reward_payout_controls.payouts_enabled=true`, the `daily_participation_xp` policy enabled at 20 XP, and an additional hourly scheduled payout job (`rockmundo-city-scene-xp-canary-v1`, job #158) calling `private.grant_scene_earned_xp(10)`. A 14:35 UTC invocation had succeeded, but **zero** City Scene reward claims, receipts and `city_scene_reward` XP ledger rows existed.

As a fail-safe pending independent economy/rollout validation, the payout switch was returned to **false**, the participation policy returned to **disabled**, and job #158 was **unscheduled**. Re-check confirmed zero enabled reward policies, zero claims/receipts/XP ledger rows and no XP canary job. The regular verified-action scoring job #157 remains active.

Two further migrations were visible on main: `20261027160000_scene_balanced_reward_policies.sql` and `20261027161500_scene_immediate_source_kill_switches.sql`. The policy migration defines candidate XP amounts but itself sets no payout flags. Source kill-switch functions were separately reviewed. Do not reactivate the canary without explicit payout approval, a reproducible staging grant test, a scoped reward-policy rollout plan and monitoring. Be alert to concurrent agent changes in the same production environment.

## Follow-up gates

1. Keep monitoring `cron.job_run_details` for worker failures and review the real activity scoring rate by city.
2. Verify that new recording and rehearsal completions produce points across their daily and weekly objectives.
3. Confirm UI progress, responsive challenge posters and activity CTA navigation in the deployed game.
4. Only after economy review, enable participation reward policies and independently authorise atomic XP payouts. No grant scheduler is installed.
5. Review privacy-safe scene news/announcements and the first full November monthly campaign.

See [deployment record](LIVE_SCHEMA_DEPLOYMENT_20261027.md) and [processor runbook](PROCESSOR_RUNBOOK.md).

## Post-pilot economy review and independent source switch hardening

After four successful scheduled processing runs (13:00, 13:15, 13:30 and 13:45 UTC), the XP economy was compared with live experience-ledger entries. Median recent awards included **13 XP for work shifts, 8 XP for recording completions, around 142 XP for university attendance and 260 XP for mentorship**. The original provisional City Scene rates (100 daily, 350 weekly and 1,000 monthly XP) and high participation thresholds were revised:

| Policy | Minimum personal points | Proposed XP |
|---|---:|---:|
| Daily participation | 1 | 20 |
| Daily city-completion bonus | 1 plus city success | 20 |
| Weekly participation | 2 | 75 |
| Monthly participation | 3 | 250 |

A fully eligible player could earn no more than **1,865 XP** from City Scene in a 31-day month with five weekly award periods. The policies remain **disabled** and are not a promise of a payout. There are zero grant receipts and no payout schedule.

The additive migration `20261027161500_scene_immediate_source_kill_switches.sql` now makes the per-source controls effective *immediately* in each protected ingester, cursor-processing batch and read-only preview. Disabling any one of `gig:verified_performance`, `recording:completed` or `rehearsal:completed` prevents that source's events from being consumed while preserving the cursor. Monthly scoring also requires the separate `scene:verified_community` gate. A rollback-only test against the live database confirmed disabled queues report `disabled=true`, previews report `source_ready=false` and none of the three cursors advanced. The pilot flags were restored by the rollback.

Individual source shutdown (an example for recordings):

```sql
update public.scene_source_controls
set enabled=false,updated_at=now()
where action_type='recording:completed';
```

This switch does not affect gig or rehearsal sources. Resume only after investigating the underlying adapter or data issue. All source function grants remain service-only.
