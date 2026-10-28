# November City Scene activation — read-only operator gate

**Prepared:** 28 October 2026 UTC  
**Scope:** Four-city live pilot, first monthly campaign from **1 November 2026 at 00:00 UTC**.  
**Database:** Existing RockMundo Supabase project. No changes to scoring, payouts, cron or migrations.

## One query for all three launch phases

Open the Supabase SQL editor with operator-only access. Run the complete **read-only** query at:

`supabase/ops/city_scene_november_launch_gate.sql`

It returns one row with `launch_gate`, `launch_phase`, `checked_utc` and an `evidence` object. This is a diagnostic, not a scheduler or migration. Never copy its privileged SQL into a client bundle.

- **READY / PRE_LAUNCH:** Existing daily and weekly processing is healthy; the first monthly campaign is configured for November. **Zero monthly cycles is expected now.**
- **READY / ACTIVATION_WINDOW:** The monthly start date has arrived, but the first verified worker tick may not yet have produced eligible-city cycles. Check evidence rather than assuming a failure or inventing a monthly board.
- **READY / POST_START_REVIEW:** At least one November cycle exists and baseline checks pass. Confirm per-city eligibility and created-objective counts separately; READY does **not** certify every city.
- **WATCH:** Latest worker result is stale/unsuccessful, recent cron failures, jam scoring unexpectedly enabled, or no November monthly cycles by **2 November UTC**. Investigate before changing controls.
- **BLOCKED:** Source or template misconfiguration, missing/incorrect cron schedule, duplicate November cycles, a monthly cycle without exactly one objective, or an XP authorization/payout/receipt unexpectedly active. Do not bypass these controls to force launch.

If the city has no recently active eligible account, the worker may correctly skip monthly generation. If monthly cycles are still missing on 2 November, inspect eligibility and cron history before changing any configuration.

## Check cadence

1. **28–31 October:** Save a PRE_LAUNCH output as evidence. Expect 0 monthly cycles, a successful worker tick in the last 45 minutes, zero reward receipts, payouts OFF and no active reward approval.
2. **1 November after first expected worker tick:** Re-run. Inspect `november_monthly_cycles`, `duplicate_monthly_groups` and `monthly_cycles_with_wrong_objective_count`, verify the monthly template is enabled, and check live Scene boards. The worker runs every 15 minutes, not necessarily at midnight.
3. **2 November:** Re-run. Investigate WATCH if no eligible monthly campaign was created; reconcile recently active characters, source health and actual cron results.
4. **1 December:** Verify November cycles ended, historical Poster Wall reflects only persisted non-revoked stages, and reward policies remain unchanged until separately approved.

## Escalation and safety

Review `cron.job_run_details` for `rockmundo-city-scene-verified-v1` and the existing replay-health snapshot if the worker is late. Inspect the source replay runbook before attempting any replay.

No payout activation is part of this gate. **Never enable XP reward policies or re-install the XP canary** simply to clear a status. Approval, staged entitlement-canary evidence and separate economy sign-off remain mandatory.

## Live smoke check (28 October, 20:05 UTC)

The first direct execution of the gate against production returned **READY / PRE_LAUNCH**: 4 daily + 4 weekly active cycles, 0 November monthly cycles, 1 enabled monthly template, 4 required source gates enabled, jam disabled, worker's last run succeeded at 20:00 UTC, 0 recent cron failures, 0 duplicate November cycles, payouts OFF, 0 enabled reward policies, 0 XP grant receipts, 0 active XP jobs and no active reward approval.

This is point-in-time evidence, not proof of the 1 November launch. Re-run the query at the times above.
