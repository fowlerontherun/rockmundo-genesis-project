# City Scene Challenges — Processor Runbook (draft)

Date: 27 October 2026  
Status: **Code committed on PR #4587; not enabled in production**

## Purpose

The `scene-challenges-processor` Edge Function is a deliberately opt-in, service-role-only job. It can reconcile city daily/weekly/monthly cycles, ingest **verified finalised jam events**, and record the four poster milestones (25, 50, 75 and 100%). It does **not** mint money, XP or fame, and it has no cron entry.

## Required deployment gates

1. Reconcile database migration drift; confirm the live version and exact migration sequence. Do not apply the draft schema directly to production without a staging run.
2. Validate the migrations in timestamp order: `20261027070000`, `080000`, `081500`, `082000`, `083000`, `084000`, `085000`. Review SQL in full, run security/performance advisors and ensure client mutations are denied.
3. Verify `scene_reconcile_cycles`, `scene_ingest_verified_jam`, `scene_reconcile_milestones` can only be invoked with service credentials and that browser-issued RPCs fail.
4. Run the SQL and frontend contract tests and scoped migration tests. Treat unrelated lint baseline #4569 separately, but do not ignore any new issues introduced by these files.
5. Configure function secrets on the target Supabase environment: `SCENE_PROCESSOR_CRON_SECRET` (new strong random secret), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Keep `SCENE_CHALLENGES_PROCESSOR_ENABLED` unset/false in production during deployment. Turning it on permits secret-authenticated **explicit** write calls; the default call is always dry-run.
7. Enable only verified, healthy source templates and their `source_health_snapshot.scoring_enabled` flag after approved acceptance fixtures. The seed deliberately makes every template disabled.
8. Confirm real jam finalisations include at least two distinct account IDs from resolved slot participants; do not count simple bookings or client `status='completed'`.
9. Record successful dry-runs, idempotency replays, month rollover, city-travel and cap tests before scheduling.
10. Connect to an audited canonical cron *only after* verifying scheduler ownership, monitoring, retry semantics and backlog treatment.

## Invocation contract

Request: HTTPS `POST` to deployed function, with secret in `x-cron-secret`. No browser CORS, no unauthenticated access, no query string toggles.

- Empty body or `{"dryRun":true}`: read-only inspection only. Counts bounded candidates from `jam_session_finalizations` for the previous seven days, without mutating the DB.
- `{"dryRun":false,"maxEvents":50}`: **explicitly mutating** run when all flags, credentials and DB prerequisites are present. Creates missing enabled cycles, scores qualifying jam finalisations, and reconciles milestones.
- `maxEvents` range 1–100; default 50. If the result says `truncated=true`, inspect backlog and implement cursor/pagination before enabling a recurring job. A bounded, descending scan alone is not a complete production queue.
- `healthy=false`, an HTTP failure, or any nonzero `failedSessions` means investigate before proceeding. Never retry blindly if there was a permission/schema error.
- Function does not process social-activity host completions because they currently lack independently verified attendance.
- No historic backfill beyond seven days without a separately reviewed migration plan.

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
- Personal reward claims are durable schema placeholders only; no XP/fame/cash processor exists.
- No public contributor ranking or news feed is emitted, because privacy-safe public identity and block settings require separate review.
- The current verified jam source has no sample finalisations in the inspected live aggregate snapshot. A staging fixture is needed.
- Underlying gig and recording completion flows must be audited separately before being used as contribution sources.
