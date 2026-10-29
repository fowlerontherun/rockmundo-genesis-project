# Canonical Festival V2 stage-event protocol

Status: **foundation prepared; not deployed**. Issue #4696.

## Why this is necessary

RockMundo's deployed `festival_editions_v2` / `festival_edition_runtimes`
engine is the canonical annual-edition authority. The simplified
`run_simplified_festival_edition` operation immediately completes a festival
and writes `completion` evidence. It does **not** emit per-stage live
performance transitions or crowd snapshots. Its generated timetable must
never be treated as evidence that an act performed.

Legacy `festival_performance_sessions` and `festival_stage_crowd_snapshots`
both reference the older `festival_editions` architecture and currently
contain no records. Never join them onto canonical edition IDs.

## Stage event capture (review-only)

`supabase/reconciliation/festival/canonical_edition_stage_evidence_ledger.sql`
adds a private, RLS-protected, append-only source of canonical stage events.
It reads only new, service-only-writeable `festival_runtime_evidence` rows
with an explicit evidence type:

- `stage_ready`
- `stage_starting`
- `stage_live`
- `stage_delayed`
- `stage_completed`
- `stage_cancelled`

Each event's `evidence` JSON **must** carry `stageId` and
`scheduleItemId` (both canonical UUIDs), `festivalDate` (YYYY-MM-DD)
and `observedAt` (ISO timestamp including timezone).

A trigger checks the runtime is active, verifies the real published stage
belongs to its annual edition, confirms the generated schedule item belongs
to the same runtime and festival day, enforces the festival's timezone,
rejects observations stale by more than fifteen minutes, and serializes
stage-state transitions via an advisory transaction lock. Observations
never become live merely because a timetable clock crosses their slot.

Expected transitions:

`initial -> ready | delayed | cancelled`

`ready -> starting | delayed | cancelled`

`starting -> live | delayed | cancelled`

`live -> delayed | completed | cancelled`

`delayed -> starting | live | cancelled`

`completed` and `cancelled` are terminal. Actual implementation and
regression examples also exist in
`src/features/festivals/runtime/canonicalStageEventModel.ts`.

The capture ledger lives in the `private` schema, with RLS and FORCE RLS.
No SELECT/INSERT/UPDATE/DELETE is granted to `anon`, `authenticated`
or `service_role`. Only the trusted database trigger writes to it. There
is **no public RPC** and no direct player-staff mutation endpoint.

## Safe rollout gates

1. Do not deploy this ledger before extending the canonical runtime engine
   to emit stage evidence *at the real stage transition*, inside the same
   transactional/idempotent authority pathway. Never seed fake events for
   already-completed simplified festivals.
2. On a disposable database, run the SQL, simulate the whole transition chain
   for a synthetic live annual edition and verify wrong stage/edition IDs,
   wrong item IDs, terminal reuse, old timestamps, duplicate evidence and
   concurrency all fail closed.
3. Test the existing `completion` evidence path still succeeds and is
   ignored by the stage-event trigger. Verify public role cannot access raw
   evidence or private ledger even through PostgREST.
4. After authoritative stage events exist, design a separate privacy-safe
   projection selecting only the latest **current-day** confirmed state
   with a timestamp, stage UUID and approved artist label. This requires a
   distinct security review of the existing public canonical RPC.
5. Implement a separate, independently sourced canonical stage crowd pipeline
   before showing density or mood bands. Do not derive per-stage headcounts
   by copying festival-wide attendance and do not reuse legacy snapshots.
6. Apply a reviewed forward-only migration and run the SQL fixture, typecheck,
   Vitest and visitor browser QA before merging/deploying. Keep issue #4696
   open until stage-event emission and public projection are operational.

## Verification performed

The SQL file was executed inside `BEGIN ... ROLLBACK` against the connected
RockMundo production database on 29 October 2026. The table, trigger and
permissions checks passed; no changes persisted. **No stage event fixtures
or live writes were run against production.**
