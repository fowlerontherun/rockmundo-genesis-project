# Phase 5 PR 05 — Typed Gig Event Schema and Replay Storage

## Recommendation source

This PR builds on Phase 5 PR 04's server-authoritative lifecycle: server start/progression, exactly-once song rows, idempotent completion, and `result_ready_at` as the report availability gate.

## Generation point

Replay generation is requested by `complete-gig` immediately after the authoritative gig update writes `status = completed`, `completed_at`, and `result_ready_at`. The canonical generation implementation is the service-role Edge Function `generate-gig-viewer-replay`.

## Transaction boundary

Outcome and reward completion remain authoritative and independent. Replay generation is post-completion, synchronous from the caller's perspective, idempotent, and non-critical. A replay failure writes a controlled failure status/error code and does not roll back rewards, song scores, outcome totals, notifications, or result access.

## Event schema

The implemented schema lives in `src/features/gig-experience/events/`. Events use a strict envelope with sequence, phase, event type, offset, duration, importance, optional song/performer IDs, bounded crowd-energy values, `messageKey`, `messageParams`, and factual visual payload data.

## Visual payload union

`GigVisualPayload` is a discriminated union covering venue opening, crowd fill/reaction, performer entrance/movement, song starts, spotlights, moment effects, band exit, and result reveal. Validation rejects unknown discriminators and event-type/payload mismatches.

## Replay envelope and versioning

`GigViewerReplay` stores `viewerVersion`, `eventSchemaVersion`, `simulationSeed`, generated timestamp, duration, status, checksum, and events. Current versions are viewer `1` and event schema `1`. Unsupported versions return `unsupported_version` in the frontend service so clients can fall back to report/text-only mode.

## Storage model

A new `gig_viewer_replays` table stores the full replay payload separately from `gig_outcomes`. It includes foreign keys to `gigs` and `gig_outcomes`, status/version/duration/event-count checks, JSON shape checks, indexes, and partial unique indexes for one ready and one generating replay per gig/viewer version.

## Deterministic seed

The seed is derived from gig ID, outcome ID, completed timestamp, and viewer version. The generator provides a deterministic PRNG for cosmetic choices and never uses browser time, frame timing, client UUIDs, or `Math.random`.

## Duration allocation

The first schema targets approximately three minutes using fixed phase budgets plus weighted song budgets. Opening, final, best, and worst/turning-point songs receive emphasis. Very long setlists mark lower-emphasis songs as montage events without changing authoritative facts.

## Crowd energy model

Crowd energy uses a documented 0–100 presentation scale derived from attendance percentage, song performance score, previous momentum, and final rating. It is deterministic, bounded, follows song order, and does not alter the original outcome.

## Performer mapping

The generator reads `gig_performers` and public profile display names/usernames only. It stores profile IDs, display names, public role/instrument strings, and safe stage positions. Missing performers use a safe legacy entrance fallback; hidden stats, health, energy, auth identifiers, and private attendance data are not exposed.

## Encore representation

The current outcome model has no reward-bearing encore decision. PR 05 stores a presentation-only encore narrative derived from final rating, attendance percentage, and final crowd energy. The stored event is canonical for replay and does not alter rewards or outcome values.

## Validation

Replay validation checks versions, statuses, phases, event types, payload discriminators, event-type/payload mapping, increasing sequences, non-decreasing offsets, duration bounds, crowd-energy bounds, message params, duplicate event IDs, required result reveal, and completed-last ordering. Invalid payloads fail generation with a controlled error.

## RLS and access

Replay reads mirror existing outcome visibility by requiring the referenced `gig_outcomes` row to be visible. Direct client insert/update/delete is denied. Replay generation claim is a `SECURITY DEFINER` RPC with fixed `search_path`, revoked from anon/authenticated, and granted only to `service_role`.

## Failure and retry behaviour

The function returns existing ready rows on retry, refuses incomplete gigs, records controlled `failed` rows for validation/generation failures, and uses database uniqueness/row locking to protect concurrent claims. Result reports remain available without a replay.

## Files changed

- Event constants/types/schema/generator under `src/features/gig-experience/events/`.
- Replay frontend service and hook under `src/features/gig-experience/`.
- Edge Function `supabase/functions/generate-gig-viewer-replay/` and shared replay code.
- `complete-gig` post-completion replay generation request.
- New migration and SQL harness.

## Migration

`20260711140000_phase_5_pr_05_gig_viewer_replays.sql` creates replay storage, constraints, RLS, grants, trigger, and the guarded claim RPC.

## Tests

Vitest schema/determinism tests cover valid generation, invalid discriminators, unknown phases, duplicate sequences, invalid energy, missing reveal, completed-last enforcement, identical output/checksum, and deterministic random streams. A pgTAP-style SQL harness validates storage shape, RLS policies, and claim RPC grants when a Supabase test database is available.

## Known limitations

- No Canvas renderer, spectator mode, audio sync, or animation is implemented.
- Legacy gigs without replay show unavailable; there is no bulk backfill.
- Replay generation is invoked synchronously after completion rather than via a durable queue.
- Edge Function tests require Supabase/Deno tooling in the target environment.

## Recommended Phase 5 PR 06

Build the viewer/reconnect read path on top of the canonical replay descriptor, including a protected replay-opening UI and text/timeline fallback for unsupported versions, without changing the stored canonical events.
