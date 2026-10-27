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

## Follow-up gates

1. Keep monitoring `cron.job_run_details` for worker failures and review the real activity scoring rate by city.
2. Verify that new recording and rehearsal completions produce points across their daily and weekly objectives.
3. Confirm UI progress, responsive challenge posters and activity CTA navigation in the deployed game.
4. Only after economy review, enable participation reward policies and independently authorise atomic XP payouts. No grant scheduler is installed.
5. Review privacy-safe scene news/announcements and the first full November monthly campaign.

See [deployment record](LIVE_SCHEMA_DEPLOYMENT_20261027.md) and [processor runbook](PROCESSOR_RUNBOOK.md).
