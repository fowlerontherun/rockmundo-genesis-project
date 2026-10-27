# City Scene Challenges — Processor Runbook (draft)

Date: 27 October 2026  
Status: **Code committed on PR #4588 (continuation of merged PR #4587); not enabled in production**

## Purpose

The `scene-challenges-processor` Edge Function is a deliberately opt-in, service-role-only job. It can reconcile city daily/weekly/monthly cycles, ingest **verified finalised jam events through an atomic ordered cursor**, record the four poster milestones (25, 50, 75 and 100%), and generate *pending* XP reward entitlements from reviewed policies. It does **not** mint money, XP or fame, and it has no cron entry.

## Required deployment gates

1. Reconcile database migration drift; confirm the live version and exact migration sequence. Do not apply the draft schema directly to production without a staging run.
2. Validate the migrations in timestamp order: `20261027070000` (already merged to GitHub, NOT deployed to Supabase), `080000`, `081500`, `082000`, `083000`, `084000`, `085000`, `20261027100000`, `100500`, `101000`. Review SQL in full, run security/performance advisors and ensure client mutations are denied.
3. Verify `scene_reconcile_cycles`, `scene_ingest_verified_jam`, `scene_process_verified_jam_batch`, `scene_preview_verified_jam_batch`, `scene_reconcile_milestones`, `scene_reconcile_reward_entitlements` can only be invoked with service credentials and that browser-issued RPCs fail.
4. Run the SQL and frontend contract tests and scoped migration tests. Treat unrelated lint baseline #4569 separately, but do not ignore any new issues introduced by these files.
5. Configure function secrets on the target Supabase environment: `SCENE_PROCESSOR_CRON_SECRET` (new strong random secret), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Keep `SCENE_CHALLENGES_PROCESSOR_ENABLED` unset/false in production during deployment. Turning it on permits secret-authenticated **explicit** write calls; the default call is always dry-run.
7. Enable only verified, healthy source templates and their `source_health_snapshot.scoring_enabled` flag after approved acceptance fixtures. The seed deliberately makes every template disabled.
8. Confirm real jam finalisations include at least two distinct account IDs from resolved slot participants; do not count simple bookings or client `status='completed'`.
9. Record successful dry-runs, idempotency replays, month rollover, city-travel and cap tests before scheduling.
10. Connect to an audited canonical cron *only after* verifying scheduler ownership, monitoring, retry semantics and backlog treatment.

## Invocation contract

Request: HTTPS `POST` to deployed function, with secret in `x-cron-secret`. No browser CORS, no unauthenticated access, no query string toggles.

- Empty body or `{"dryRun":true}`: read-only **cursor-aware** preview of settled finalisations that would be processed. Reports `candidateSessions`, `backlogPending`, `scoringSourcesReady` and cursor details. Does not mutate the DB.
- `{"dryRun":false,"maxEvents":50}`: **explicitly mutating** run when all flags, credentials and DB prerequisites are present. Creates missing enabled cycles, atomically processes an oldest-first finalisation batch, reconciles milestones and writes **pending-only reward entitlements** (policies disabled by default).
- `maxEvents` range 1–100; default 50. The persistent cursor scans finalisations oldest-first and waits 15 minutes for settlement. If `backlogPending=true`, additional explicit runs are needed; checkpoint, ledger inserts and replay locks commit in one database transaction.
- `healthy=false` or an HTTP failure means investigate before proceeding. The transactional batch rolls back if any scoring event throws; it does not partially advance the cursor. Never retry blindly if there was a permission/schema error.
- Function does not process social-activity host completions because they currently lack independently verified attendance.
- A new cursor starts seven days back and advances only when a healthy scoring objective exists. No historic backfill beyond seven days without a separately reviewed migration plan. Older event timestamps or long-running uncommitted finalisations need separate reconciliation tests before automated scheduling.

## Release sequence

1. Apply migration and test on disposable/staging instance.
2. Deploy function with processor disabled. Confirm it returns `PROCESSOR_NOT_CONFIGURED` or `enabled:false` rather than running.
3. Inject credentials and enable flag in **staging**. Call dry-run; verify zeros are not interpreted as a success if no finalised source data exists.
4. Seed controlled fixtures and enable one eligible source objective; reconcile and process, then replay the event 100 times. Totals and milestones must not double-insert.
5. Load `/cities/:cityId/scene-challenges`; verify loading, empty/disabled, server aggregates, personal owner-scoped progress, responsive layout and 25/50/75/100 mural.
6. Verify reconciliation and reward readiness before any live enablement. Only an approved follow-up should turn on live scheduling or reward grants.

## Current restrictions

- The live Supabase project has **not** had these migrations applied in this work.
- The social completion adapter is forcibly non-scoring until independently verifiable attendance exists.
- A disabled-by-default set of XP policies can now create pending entitlements. No XP/fame/cash payout processor or browser claim API exists; entitlements are not player-claimable.
- No public contributor ranking or news feed is emitted, because privacy-safe public identity and block settings require separate review.
- The current verified jam source has no sample finalisations in the inspected live aggregate snapshot. A staging fixture is needed.
- Underlying gig and recording completion flows must be audited separately before being used as contribution sources.

## Staging smoke checklist (new)

- Run `supabase/tests/city_scene_challenges_staging_smoke.sql` against an isolated database after the migrations. It asserts RLS, player write denial, owner-only read RPCs, service-only processing grants and all reward templates disabled.
- Run `src/features/city-scene-challenges/sceneCursor.contract.test.ts` and `sceneRewards.contract.test.ts` alongside existing City Scene tests. CI's older `import.meta.url` fixture-path failures were fixed on this PR.
- Test a late committed event and two simultaneous processor invocations, verifying the cursor never jumps past unprocessed source events. The 15-minute safety lag is a mitigation, not proof against arbitrarily long transactions.
- Review reward sample values (100/50 daily, 350 weekly, 1000 monthly XP) against live economy before enabling any reward policy. There is **no** payout implementation.
- Existing daily challenge templates primarily require social activities whose attendance is not yet independently verified; they remain disabled. Broaden proven action adapters before presenting the feature as playable V1.
