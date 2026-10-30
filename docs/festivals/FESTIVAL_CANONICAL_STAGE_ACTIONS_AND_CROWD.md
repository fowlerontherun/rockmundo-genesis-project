# Canonical festival stage actions and crowd evidence

Status: review-only foundation for GitHub issue #4696; not deployed.

## Verified live gap, 30 October 2026

The authoritative annual-edition tables are festival_editions_v2, festival_edition_runtimes and festival_runtime_evidence. Both current edition runtimes are completed; their evidence ledger contains only two completion rows. The older festival_performance_sessions and festival_stage_crowd_snapshots belong to legacy festival_editions and cannot be treated as sources for annual-edition V2.

The existing canonical_edition_stage_evidence_ledger.sql validates ordered stage transitions from immutable runtime evidence. The new canonical_edition_stage_runtime_actions.sql adds a runtime-locked, owner-authorised and idempotent action source. The stage action must be explicitly confirmed by the owner; a published slot never becomes live from its start clock. Actor identity, runtime, published stage, schedule slot, artist booking reference and local festival day are checked before writing the existing evidence ledger.

The new canonical_edition_stage_crowd_evidence_ledger.sql is a service-evidence consumer. Only stage_audience_allocation emitted by a real canonical stage allocation engine can create observations. Crowd headcounts are private and bounded by actual stage capacity and site attendance; mood is null unless measured. An empty evidence source produces empty observations, never synthetic density.

## Remaining release gates

1. Install the three SQL files in dependency order on a disposable database; exercise valid and invalid stage transitions, concurrent retries, replay conflicts, wrong runtime/stage/booking/day, cancelled and paused runtime, privileges and rollback.
2. Wire the verified owner stage action into the real canonical owner control room with explicit confirmation and prevent double submission.
3. Extend the canonical runtime tick/admission engine to emit stage_audience_allocation from actual stage-specific allocations. There is no production stage-allocation evidence today; do not copy festival-wide attendance into every stage.
4. Add privacy-reviewed public aggregate projections (confirmed current-day status, fresh density band and measured mood only) and visitor contract tests. No exact headcounts, queues, medical/security or backstage information.
5. Verify a live multi-stage annual-edition fixture, midnight and DST days, retries, restart, cancellations and mobile. Leave the public RPC's empty performance/crowd arrays unchanged until these proofs pass.
6. Create a forward-only timestamped migration only after staging tests pass. Do not bulk-apply future-dated launch-scoped migrations or rewrite completed historical evidence.

Issue #4696 remains open until actual emission, crowd allocations and public visitor projection are verified.
## 30 October 2026 implementation update

New owner-only canonical stage control RPC and owner UI now support explicit stage confirmations. Official stage events are source-backed and immutable; stage overlap and booking mismatches are rejected. The public projection only shows recent current-day events with matching runtime/stage/edition IDs. A newly added SQL harness checks anonymous vs authenticated privileges, absent data, unknown festival slugs and redaction.

**Release gate:** The existing one-click `run_simplified_festival_edition` completes and settles an edition immediately, so it does NOT drive a staged live runtime; two existing production runtimes are completed. No stage-specific allocation emitter is deployed. This package contains an allocation *capture* pipeline, not a fabricated audience distribution. Actual canonical live tick, gate admissions and per-stage audience allocations still need integration before showing a crowd density band or declaring the festival experience fully live.

The public projection deliberately returns `scheduledStart` and `scheduledEnd` as null for observed events whose generated schedule contains no trustworthy UTC timetable, and `mood` as null when not measured. The visitor UI now handles these states honestly.

All SQL scripts passed a transaction-scoped `BEGIN ... ROLLBACK` schema compilation and grant preflight against RockMundo on 30 October 2026, with unknown slug returning no data. **No schema changes or event fixtures were persisted.** Before deployment, exercise the staged live fixture and permissions on a disposable DB and validate settlement invariants.
