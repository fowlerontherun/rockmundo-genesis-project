# City Scene — 20 XP Daily Participation Canary

**Activated:** 27 October 2026 (UTC)  
**Environment:** RockMundo main Supabase (`eu-west-2`)  
**State:** One reward policy active; the other three remain OFF.

## Reward economy review

The previous policy thresholds and values were not aligned with the active City Scene challenge goals. We compared the previous 30-day real experience ledger to avoid overly generous XP: work shifts median 13 XP, recorded studio completion median 8 XP, university attendance median 141.5 XP and mentor sessions median 260 XP. The live scene policies are now:

| Reward | Personal contribution minimum | XP | Status |
|---|---:|---:|---|
| Daily participation | 1 | 20 | **Canary ON** |
| Daily community completion bonus | 1 + city success | 20 | OFF |
| Weekly participation | 2 | 75 | OFF |
| Monthly participation | 3 | 250 | OFF |

The canary is limited to **one daily participation claim per account per cycle**, and one city affiliation per account per UTC day. The reward is only created after a cycle ends and can only be paid against non-invalidated verified contributions. It expires seven days after the cycle ended.

## Activation and schedules

The activation is committed as [city_scene_daily_xp_canary_activation.sql](../../../supabase/ops/city_scene_daily_xp_canary_activation.sql) (a reviewed operations script, **not** a normal schema migration). SQL prerequisites require no existing claims, receipts, enabled reward policy or active payout switch.

- Community scoring: pg_cron **job #157**, `rockmundo-city-scene-verified-v1`, every 15 minutes.
- XP canary: pg_cron **job #158**, `rockmundo-city-scene-xp-canary-v1`, at minute 35 every hour, invokes `private.grant_scene_earned_xp(10)`.
- At the activation check: no daily cycle had ended, **zero claims and zero XP payout receipts**. An immediate grant-worker no-claim smoke returned `xp_granted=0` with no errors.

The atomic payout routine grants XP to the canonical wallet, writes the experience ledger (which updates daily XP category data through the game's existing trigger), fires the wallet's character-level synchronisation trigger, writes a unique grant receipt and marks the claim granted. It is idempotent under concurrent retries. Account/profile ownership and currently enabled matching policy are re-verified at payout time.

## Monitor after midnight UTC

At 00:00 UTC the City Scene tick should expire the previous day's cycles and generate a pending entitlement for an eligible character. The canary payout job at 00:35 UTC or the next hourly run will issue up to 10 awards, with remaining pending claims processed on later hourly runs.

To inspect safely:

```sql
select jobid, jobname, active, schedule
from cron.job
where jobname in (
  'rockmundo-city-scene-verified-v1',
  'rockmundo-city-scene-xp-canary-v1'
);

select jobid, start_time, status, left(return_message,200)
from cron.job_run_details
where jobid in (157,158)
order by start_time desc limit 20;

select status, count(*) from public.scene_reward_claims group by status;

select count(*) receipt_count, coalesce(sum(xp_amount),0) total_scene_xp
from public.scene_reward_grant_receipts;
```

**No automatic success claims are made for future runs.** Verify the first real payout, wallet increase, ledger entry, receipt and daily-statistics updates before enabling another reward policy.

## Emergency stop

Run [city_scene_daily_xp_canary_stop.sql](../../../supabase/ops/city_scene_daily_xp_canary_stop.sql). It atomically sets `payouts_enabled=false`, disables the canary policy and unschedules the reward job. It does **not** erase already-granted XP, canonical ledger entries or receipts.

The original [live pilot record](LIVE_PILOT_20261027.md) documents the earlier all-rewards-off phase. This file supersedes that portion of the pilot record.
