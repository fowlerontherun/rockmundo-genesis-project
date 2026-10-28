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

## XP reward approval gate — 27 October 2026

A later reward-canary review found an hourly XP grant schedule had been enabled without the previous rollout gates being validated. It was unscheduled, all four reward policies were disabled, the payout switch was turned off, and zero claims, receipts or `city_scene_reward` ledger rows were verified.

**Additional fail-closed protection is now live:** `20261027163000_scene_reward_activation_approval_gate.sql` creates the `private.scene_reward_activation_authorizations` singleton with **no active approval**. Database triggers reject any attempt to enable a reward policy or payout flag unless a privileged operator has supplied a nonempty approver, documented reason and future expiration. This private approval record grants **no browser or service-role update permissions**. The actual XP grant function independently rechecks the approval deadline on every invocation, so a previously enabled payout switch cannot continue paying after the approval expires.

Verification completed directly against the main database: an unapproved policy enable was rejected; an unapproved payout enable was rejected; a rollback-only test temporarily enabled both under a documented approval, then expired it and confirmed the grant function returned `approval_required=true` and **0 XP**, with all state rolled back. The previous real canary remained removed. Migration history was reconciled to GitHub `main`.

**Future activation requires a separate explicit decision.** The trusted DB operator must first review the source-to-entitlement reconciliation and wallet/ledger canary, explicitly document the approver/reason/short approval window in the private authorization table, and only then enable one policy and the payout switch. Do not schedule the grant function merely because the controls can be enabled; first verify eligibility, expiration, replay locks and the two independent safeguards. When approval expires, grants automatically fail closed. No operator approval was issued as part of this implementation.

## Source provenance and deadline reconciliation — 27 October

Two additive migrations are deployed directly to main Supabase and registered with exact canonical GitHub versions.

- `20261027164500_scene_late_finalization_milestone_reconciliation.sql`: permits verified events completed before a cycle deadline to unlock milestones and complete the expired cycle during the seven-day settlement grace window. When a contribution is explicitly invalidated, milestone rows are **soft-revoked**, cycle/objective completion is recalculated and the authenticated board hides invalidated mural stages. The old milestone row remains as correction evidence. A live reconciliation returned zero unexpected changes; the existing two milestone unlocks remain valid.
- `20261027170000_scene_source_integrity_preview.sql`: a **read-only, private, service-role-only** diagnostic. `select private.scene_source_integrity_preview(100);` checks recent scored gigs, recordings and rehearsals against their canonical event and XP evidence, and returns bounded suspected mismatches for operator investigation. Initial production result: **3 contributions inspected, 0 suspected**. This is not an automatic player-credit revocation process; archived source statuses and later admin corrections must be evaluated carefully before invalidating a historical contribution.

The isolated PostgreSQL late-event test passed in GitHub CI. Focused assertion follow-up is tracked in PR #4605. Separate provenance diagnostics/replay integration is tracked in PR #4606. No reward policies or XP payouts were enabled by these updates.

## Bounded late-event recovery — live 28 October 2026

[PR #4659](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4659) has merged and both dedicated City Scene verification workflows passed, including PostgreSQL migrations/integration, scoped feature tests and TypeScript checks. General repository CI separately remains a broader gate.

The guarded `20261028121000_scene_late_source_replay.sql` migration was applied directly to main Supabase, and migration history aligned with the exact filename. It created per-source bounded lookback cursors, secure replay controls and three completion-time indexes. Only the existing 15-minute verified-action worker calls the replay function. No new cron or XP grant route was installed.

After verifying that controls were initially OFF, source permission gates were service-only, recent candidate volume was bounded (3 gigs, 3 recordings, 5 rehearsals), the provenance audit was clean and all XP reward switches remained OFF, the replay feature was deliberately enabled in production.

The **first live replay** at **12:17 UTC on 28 October** checked **11 authoritative music events**, recovered **0 additional contributions**, and did not change the existing 3 credited contributions or 2 mural milestones. A second immediate worker tick rechecked **0 events**, demonstrating that the replay cooldown was active. Next per-source scan was scheduled for **13:17 UTC** via the existing 15-minute worker (first eligible cron tick at or after that time). XP claims, payout receipts and granted XP remain zero.

For monitoring and the independent kill switch, see [SOURCE_REPLAY_RUNBOOK.md](SOURCE_REPLAY_RUNBOOK.md). Disabling `scene_source_replay_controls.enabled` stops the bounded lookback without suspending normal verified-action scoring.

## Independent scheduled replay and health monitor — 28 October 2026

The new operator-only, read-only `private.scene_replay_health_snapshot(30)` function was installed on the main Supabase database from `20261028133000_scene_replay_health_snapshot.sql`; its migration-history version was reconciled with GitHub `main`. It reports per-source `next_scan_at`, sweep totals, recovered contributions and overdue-scan warnings, without exposing player identifiers. The database access is service-role only. A rollback-only production test simulated an overdue gig replay cursor and returned `status='stalled'`, `sources_stale=1`, and `needs_attention=true` without persisting changes. [PR #4669](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4669) adds dedicated isolated PostgreSQL coverage of healthy/late/disabled states.

**Observed automatic 13:30 UTC worker run:** `rockmundo-city-scene-verified-v1` job #157 succeeded in **393 ms** and performed the first independent scheduled replay after initial activation. Cumulative source counts became **6 gig events, 7 studio recordings and 10 rehearsals** checked (**23 total**; an increase of 12 over the first sweep). Cumulative **recovered contributions remained 0**. All three cursors advanced to `next_scan_at=14:30 UTC`; monitor status was `healthy` with no stale/pending sources. Player state remained **3 valid contributions**, **2 mural milestones**, **0 suspected source mismatches**. Reward policies, payout switch and XP receipts remained **OFF/0**.

The operator procedure and kill switch are in [SOURCE_REPLAY_RUNBOOK.md](SOURCE_REPLAY_RUNBOOK.md). This is a point-in-time health report, not an automatic alerting service. Operators should periodically check cron history and the private health snapshot rather than interpreting a due-but-not-yet-stale cursor as an outage.

## UTC deadline refresh TypeScript regression — 28 October 2026

City Scene frontend verification uncovered `TS2322` in `src/pages/CitySceneChallenges.tsx`: mixed Node/DOM types made both `ReturnType<typeof setTimeout>` and `ReturnType<typeof window.setTimeout>` resolve to the Node `Timeout` type, but the actual `window.setTimeout` call returns a numeric browser timer ID. The state variable now explicitly uses `number | undefined`, and the effect still clears the timer on unmount.

The fix was committed directly on GitHub `main`. [PR #4671](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4671) merged the dedicated regression test after **City Scene Vitest and full TypeScript verification passed**. No scoring, database, economy or payout settings were changed. The latest production verification at 14:11 UTC found the 14:00 cron succeeded, replay healthy, 3 valid contributions, 2 mural milestones, 0 source mismatches and 0 XP grants.

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
