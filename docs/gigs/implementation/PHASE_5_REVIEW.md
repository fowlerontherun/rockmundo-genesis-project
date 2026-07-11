# Phase 5 Review

## Objective

Live Gig Experience 1.0 set out to make gigs server-authoritative, immediately reportable, replayable, deterministic, accessible, mobile-aware, and meaningful as a management feedback loop without changing balance, rewards, scores, or progression.

## PRs Completed

- PR 01 documented the target experience and existing risks.
- PR 02 introduced the canonical `GigExperienceDTO` read model.
- PR 03 rebuilt the outcome report hierarchy around immediate result, story, and details.
- PR 04 moved start/progression/completion to server-authoritative and idempotent paths with `result_ready_at`.
- PR 05 added typed versioned replay storage, deterministic generation, RLS, and read services.
- PR 06 added the read-only Canvas replay shell, controls, timeline, and reduced-motion baseline.
- PR 07 added weighted deterministic crowd entry and venue filling.
- PR 08 added performer entrance, role-based stage positions, movement, and accessible performer state.
- PR 09 added song-by-song story, crowd graph, factual commentary, highlights, turning point, encore/finale, and result reveal.
- PR 10 added release hardening: payload budgets, generation recovery, compatibility tests, audit documentation, and phase status.

## Player-Facing Experience

Immediate result access is implemented through `result_ready_at`, and the detailed report remains available independently from replay generation. The completed-gig page offers a lazy-loaded Replay Gig path when stored replay metadata is ready and report-only fallback for legacy/unavailable rows. Venue presentation, crowd entry, band entrance, song playback, crowd reactions, commentary, highlights, graph, encore, finale, result reveal, controls, mobile-responsive layout, and reduced-motion equivalents are implemented. Mobile and browser verification still need to be run in a provisioned environment.

## Architecture Status

The canonical DTO, server-authoritative progression, exactly-once song position processing, idempotent completion, result-ready semantics, replay table, deterministic event generation, version checks, read model, and viewer read-only boundary are in place. Replay schema remains version 1 because PR 10 did not add unsupported detailed event types. Replay generation is non-critical to result access and can now recover stale/failed service-role generation attempts.

## Security and Privacy

RLS protects replay reads via outcome visibility. Normal clients cannot insert, update, delete, claim generation, or regenerate replay rows. The service-role claim remains narrowly granted and uses `SECURITY DEFINER SET search_path = public, pg_temp`. Payloads avoid auth tokens, raw database rows, hidden skills, and public spectator access. Direct playback controls are local-only and do not issue mutations.

## Test Coverage

- Unit tests: schema, deterministic generation, story/viewer engine tests exist; PR 10 adds compatibility and payload-budget assertions.
- Component tests: outcome report tests exist.
- Viewer-engine tests: venue, entity layout, playback, crowd lifecycle, performer lifecycle, and story engine coverage exists.
- SQL harnesses: Phase 5 harnesses exist for replay storage/RLS/grants; a clean run was not executed here.
- Edge Function tests: static review only in this environment.
- Browser smoke tests: not run; no Playwright script is configured.
- Accessibility tests: static audit only; automated browser/a11y not run.
- Mobile tests: not run.
- Concurrency tests: SQL/function design supports idempotency; live concurrent DB run not executed.
- Checks run: `npm run typecheck` passed. Checks not completed: dependency-backed lint/build/Vitest, browser/mobile/a11y tests, and Supabase reset/harnesses because local dependency installation failed and Supabase CLI was unavailable.

## Performance Status

Entity caps are centralized for crowd/performer rendering, payload limits are now 240 events and 128 KB serialized event payload, desktop target is 60 fps where practical, mobile target is 30 fps minimum, hidden tabs pause playback, and Canvas/resources clean up on unmount. Known risks are unmeasured real-device frame time and memory growth until browser profiling is run.

## Analytics Status

No established app-level analytics capture helper was found, so no lifecycle analytics were implemented. The PR documents recommended events and metrics. Future dashboards should show open rate, watch time, skip-to-result, completion, restart, report-open, mobile abandonment, error rate, reduced-motion usage, and unavailable replay percentage.

## Remaining Gaps

### P0 beta blockers

- Run and pass clean Supabase reset/migration/SQL harnesses.
- Run and pass dependency-backed lint, production build, and unit/component/viewer tests after dependency installation succeeds; keep `npm run typecheck` green.
- Run browser smoke, mobile viewport, and automated accessibility coverage.

### P1 high-value improvements

- Add official app analytics helper or integrate with an existing approved event system.
- Add deterministic browser fixtures for replay states and lifecycle edge cases.
- Add measured performance artifacts for representative desktop/mobile cases.

### P2 expansion

- Add canonical event-source tables for mistakes, recoveries, equipment incidents, singalongs, and solos.
- Add richer venue variety and custom venue art.
- Add tour and multi-gig reporting.

### Accepted limitations

- No audio.
- No public spectator mode.
- No player reactions.
- No custom venue art.
- No bulk legacy replay backfill.
- No detailed event types where source data is absent.

## Phase Status

Complete with accepted limitations

## Beta Readiness

Ready with prerequisites

Prerequisites are: pass the unverified database, dependency-backed, browser, mobile, accessibility, and performance gates; fix any P0 defects found by those gates.

## Recommended Next Area

Gig preparation improvements should be next after release-gate verification, because preparation increases player agency before the now-readable and replayable outcome.
