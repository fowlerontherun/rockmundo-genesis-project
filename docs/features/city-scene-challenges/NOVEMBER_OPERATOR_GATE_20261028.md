# November City Scene activation — read-only operator gate

**Prepared:** 28 October 2026 UTC  
**Scope:** Four-city live pilot, first monthly campaign from **1 November 2026 at 00:00 UTC**.  
**Database:** RockMundo Supabase, with the new service-only, read-only function `private.scene_november_city_readiness()`, applied directly on 30 October 2026 and tracked by migration `20261030101132_scene_november_city_readiness.sql`. No changes to scoring, payouts or cron.

## One query for all three launch phases

Open the Supabase SQL editor with operator-only access. Run the complete **read-only** query at:

`supabase/ops/city_scene_november_launch_gate.sql`

It returns one row with `launch_gate`, `launch_phase`, `checked_utc` and an `evidence` object. This is a diagnostic, not a scheduler or migration. Never copy its privileged SQL into a client bundle.

- **READY / PRE_LAUNCH:** Existing daily and weekly processing is healthy; the first monthly campaign is configured for November. **Zero monthly cycles is expected now.**
- **READY / ACTIVATION_WINDOW:** The monthly start date has arrived, but the first verified worker tick may not yet have produced eligible-city cycles. Check evidence rather than assuming a failure or inventing a monthly board.
- **READY / POST_START_REVIEW:** Per-city readiness confirms there are no currently eligible cities with missing monthly cycles after the activation grace window. `city_readiness` lists all eligible and already-created November cities; still verify gameplay manually.
- **WATCH:** Latest worker result is stale/unsuccessful, recent cron failures, or **any currently eligible city** still missing its November monthly cycle after **00:00 UTC on 2 November** (even when another city has already launched). Investigate before changing controls.
- **BLOCKED:** Source or template misconfiguration (including an unexpectedly enabled jam source), missing/incorrect cron schedule, duplicate November cycles, a monthly cycle without exactly one objective, a missing private reward approval record, or an XP authorization/payout/receipt unexpectedly active. Do not bypass these controls to force launch.

Eligible cities are calculated from distinct accounts with an active, non-deleted profile, in that city, logged in during the last 14 days. The projected target is `3 × max(1, ceil(accounts / 4))`; the final snapshot is determined when the worker creates the monthly cycle. A city with no recently active account may correctly have no monthly campaign. The report includes created November cities even if their activity later falls to zero. No player identities appear in the operator report.

To inspect individual city states without rerunning the entire gate, execute `select * from private.scene_november_city_readiness();` with the privileged SQL editor. Anonymous and authenticated roles cannot execute this function; only service-role access was granted.

## Check cadence

1. **28–31 October:** Save a PRE_LAUNCH output as evidence. Expect 0 monthly cycles, a successful worker tick in the last 45 minutes, zero reward receipts, payouts OFF and no active reward approval.
2. **1 November after first expected worker tick:** Re-run. Inspect `eligible_cities_now`, `monthly_created_cities`, `monthly_missing_cities`, `city_readiness`, `november_monthly_cycles`, `duplicate_monthly_groups` and `monthly_cycles_with_wrong_objective_count`, verify the monthly template is enabled, and check live Scene boards. The worker runs every 15 minutes, not necessarily at midnight.
3. **2 November:** Re-run. Investigate WATCH if **any** currently eligible city is missing its monthly campaign; reconcile recently active characters, source health and actual cron results.
4. **1 December:** Verify November cycles ended, historical Poster Wall reflects only persisted non-revoked stages, and reward policies remain unchanged until separately approved.

## Escalation and safety

Review `cron.job_run_details` for `rockmundo-city-scene-verified-v1` and the existing replay-health snapshot if the worker is late. Inspect the source replay runbook before attempting any replay.

No payout activation is part of this gate. **Never enable XP reward policies or re-install the XP canary** simply to clear a status. Approval, staged entitlement-canary evidence and separate economy sign-off remain mandatory.

## Live smoke check (28 October, 20:05 UTC)

The first direct execution of the gate against production returned **READY / PRE_LAUNCH**: 4 daily + 4 weekly active cycles, 0 November monthly cycles, 1 enabled monthly template, 4 required source gates enabled, jam disabled, worker's last run succeeded at 20:00 UTC, 0 recent cron failures, 0 duplicate November cycles, payouts OFF, 0 enabled reward policies, 0 XP grant receipts, 0 active XP jobs and no active reward approval.

This is point-in-time evidence, not proof of the 1 November launch. Re-run the query at the times above.

## Live per-city preflight — 30 October 2026, 10:12 UTC

The new operator-only database function was applied directly to production with canonical migration version `20261030101132`. A direct read returned four current candidate cities: **London 23 accounts / projected 18 Scene Points**, **New York 1 / 3**, **Philadelphia 1 / 3**, and **Tokyo 1 / 3**. All four reported `awaiting_worker` with zero November cycles (expected before 1 November). The upgraded launch gate returned **READY / PRE_LAUNCH** with per-city evidence. Permissions were verified: `anon` and `authenticated` cannot execute the function, `service_role` can. Reward switches remain disabled and XP grant receipts remain zero. These are time-sensitive snapshots, not guaranteed counts for launch day.
