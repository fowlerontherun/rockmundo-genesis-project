# City Scene November 2026 readiness and rollover UX

**Review date:** 28 October 2026 UTC  
**Scope:** RockMundo's four-city live Scene Challenges pilot; no changes to reward policies or source scoring.

## Verified production readiness

- First monthly cycle configured to begin **1 November 2026** (`scene_rollout_controls.monthly_first_start`).
- The monthly `monthly-scene-revival` template is enabled. The shared `scene:verified_community` source and gig, recording, rehearsal source switches are enabled; the jam source remains disabled due to missing finalised participant evidence.
- Both cycle generation and verified scoring are enabled. The existing `rockmundo-city-scene-verified-v1` cron runs **every 15 minutes** and calls `private.scene_run_verified_tick(50)`.
- At this audit: **4 active daily cycles, 4 weekly cycles, 0 monthly**, **3 valid contribution credits**, **zero XP grant receipts**. XP payout switch remains **off**.
- The worker's `private.reconcile_city_scene_cycles` builds one monthly objective on UTC days 1–3, only for cities with a recently active account and an enabled monthly template. It avoids creating a partial October campaign.
- Verified gig, studio and rehearsal ingest paths permit monthly `scene:verified_community` objectives only while their own specific source and the shared monthly source are enabled.

## User-facing readiness

- Provide a UTC countdown for the selected active cadence, alongside its absolute UTC closing time.
- Re-fetch the city board once at the earliest displayed cycle end, then let the periodic worker create the new cycle. Do not repeatedly poll/refetch stale cycles or infer that an expired cycle is still earning points.
- Show a precise pre-November monthly preview rather than incorrectly claiming that no scene points of any cadence are available.
- Once a real monthly cycle is live, offer links to the three verified pathways (gig booking, recording studios, band rehearsals). Only finalised, source-verified game activities count; clicks/bookings never score.
- Do not enable XP rewards to make the visual experience look complete.

## Operational watchpoints

- The first monthly creation is expected during the first available 15-minute worker tick after **00:00 UTC on 1 November**, depending on eligible-city population. It is **not guaranteed** at exactly midnight.
- Reconciliation is idempotent on city/cadence/UTC-start. Observe one monthly objective per eligible city and no duplicates on subsequent ticks.
- Verify campaign target and source-health snapshot after launch. If an eligible city is missing a monthly cycle by UTC day 2, inspect the cron logs, template/source controls, recent activity eligibility and function errors before changing any rollout switches.
- The first monthly campaign finishes at **00:00 UTC on 1 December 2026**. Only ended monthly cycles appear in the Poster Wall, with authoritative non-revoked milestones.
- XP payouts must remain disabled until the separate operator approval, staging reward-canary validation and monitoring gates are explicitly satisfied.

## QA

- `SceneCycleCountdown.test.tsx` verifies exact UTC boundary formatting and handled-cycle rollover deduplication.
- `SceneMonthlyActions.test.tsx` verifies the three actual game routes and truth-in-advertising copy.
- Existing City Scene PostgreSQL integration, privacy contract and TypeScript workflows remain release gates.
