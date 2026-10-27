# City Scene Challenges — Direct main database deployment

**Applied:** 27 October 2026 (UTC)  
**Project:** RockMundo main Supabase, `eu-west-2`  
**Code source:** `fowlerontherun/rockmundo-genesis-project`, `main`  
**Scope:** Database schema, PostgreSQL functions, read-side RPCs, protected scoring/reward infrastructure, and guarded Edge Function deployment. No live feature activation.

## Deployment result

- All **19** committed City Scene SQL migrations applied successfully to the main database in the order of their repository filenames.
- The Supabase migration API initially assigned runtime-generated versions. Their 19 history rows were reconciled transactionally to the **exact repository filename versions** after verifying: all 19 had persisted statements, all matched intended migration names, and none of the canonical versions collided with existing history. Follow-up verification returned **19/19 matched; zero generated-version leftovers**.
- Post-deployment permission/RLS smoke SQL completed successfully; security and performance advisors were reviewed.
- 14 `public.scene_*` tables exist, all with RLS enabled.
- Seven scene templates present; **zero enabled**.
- Four provisional XP reward policies present; **zero enabled**.
- Reward payout control `payouts_enabled=false`.
- At deployment validation: **zero** scene cycles, contribution rows, reward claims and grant receipts.
- `scene-challenges-processor` Edge Function deployed directly from GitHub `main`: Supabase reports **ACTIVE, version 1**, with `verify_jwt=false` because the function authenticates the dedicated `x-cron-secret` header. The code also requires `SCENE_CHALLENGES_PROCESSOR_ENABLED=true` before any query/write execution. Neither this flag nor the dedicated secret was configured by the deployment.
- No cron job was created. No XP, fame, cash or other grants were issued.

## Safe operational previews (read-only)

The protected queue-preview RPCs executed against main:

| Source | Recent settled candidate records | Source ready? |
|---|---:|---|
| Verified jams | 0 | No |
| Completed recordings | 4 | No |
| Verified gig outcomes | 3 | No |

These are **candidate source records, not validated/credited player actions**. Seven-day cursor lookback applies. The source readiness flags are all false by design, so no events are consumed.

## Security notes

- Access checks verified no unauthenticated/personal browser writes, authenticated read-only owner-scoped totals and service-role-only protected processors.
- Three intentionally server-only support tables (processor cursors, payout controls and grant receipts) have RLS enabled but no client policies; a Supabase security adviser lists these as informational. Their tables are not accessible to `anon` or `authenticated`.
- The board aggregate `get_city_scene_board` is intentionally an authenticated, security-definer **read-only aggregate**: the caller must have a non-null `auth.uid()`, and its result exposes city totals, not private contribution IDs. Advisor warning is reviewed and should be reassessed if board fields expand.
- All non-City-Scene security/performance adviser findings remain out of scope; do not interpret this deployment as fixing older game security issues.

## What remains to go live

The City Scene feature is **not activated** merely because its schema is deployed. Separate steps remain:

1. **Deployed:** the `scene-challenges-processor` Edge Function is active. Before allowing writes, separately configure its dedicated secret and enable flag, and verify unauthenticated/disabled calls are blocked. Neither was configured by this rollout.
2. Validate activity source adapters against representative real-source records, particularly post-completion verification, travel, caps and replay.
3. Intentionally enable eligible challenge templates and source-health settings, then reconcile city cycles. Inspect targets and category balance.
4. Define and audit scheduler ownership, concurrency, backlog and failure monitoring before any recurring processing.
5. Balance and explicitly enable XP reward policies; **independently** authorise payouts and run controlled grant tests. Do not enable either based solely on a schema migration.
6. Exercise player-facing board, personal progress and rewards in production-safe testing.

**Rollback principle:** Disable the processor/source flags and `scene_reward_payout_controls.payouts_enabled` before contemplating schema reversals. Never erase canonical receipts/ledger entries to re-issue rewards.

See [PROCESSOR_RUNBOOK.md](PROCESSOR_RUNBOOK.md) and the [feature spec](01_FEATURE_SPEC.md) for detailed design and safety expectations.
