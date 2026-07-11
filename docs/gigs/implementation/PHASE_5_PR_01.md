# Phase 5 PR 01 — Live Gig Experience Audit and Canonical Event Design

## Objective

Start Phase 5 with documentation only: audit the existing live gig journey and define the canonical data, UX, and delivery plan for a future lightweight 2D gig viewer and clearer outcome report.

## Scope completed

- Audited the current gig journey from scheduled gig through preparation, start, live viewer, advancement, completion, delayed report availability, report opening, and return routes.
- Audited the current `TopDownGigViewer` and related gig-viewer components.
- Audited `GigOutcomeReport` and its child card hierarchy.
- Documented current data model relationships and naming/authority mismatches.
- Defined a three-level post-gig information hierarchy.
- Designed a lightweight 2D viewer concept based on simple shapes and deterministic playback.
- Defined a canonical phase model and draft `GigViewerEvent` contract.
- Defined authority boundaries, reconnect/replay/skip behaviour, venue scaling, crowd state, commentary, performance/accessibility budgets, analytics events, migration assessment, component architecture, tests, product decisions, and delivery plan.

## Deliverables

- [Live Gig System Audit](../LIVE_GIG_SYSTEM_AUDIT.md)
- [Live Gig Experience Plan](../LIVE_GIG_EXPERIENCE_PLAN.md)

## Key findings

### Current gig journey

- `PerformGig` is the central page for preparation, manual start, current viewer, finalisation, and report modal.
- Automatic start and completion server paths exist, but live song-by-song advancement is still partly driven by a mounted client hook.
- The ten-minute report delay is implemented in the client page by hiding an existing outcome until ten minutes after `gigs.completed_at`.
- The viewer does not itself need to last ten real minutes; it follows song durations during the gig and remains visible during the post-completion delay window.
- Closing the page can stop client advancement, but `complete-gig` and auto-complete paths can finish/backfill server-side.
- Reconnect restores coarse DB progress, not a canonical visual phase/event offset.
- Multiple tabs can duplicate advancement attempts; final completion has idempotency protections, but the future viewer should be read-only and server-authored.
- Some other report surfaces can render `GigOutcomeReport` directly from `gig_outcomes`, bypassing the `PerformGig` delay.

### Main engagement problems

- The active viewer is a text commentary feed, not a spatial performance representation.
- Random ambient commentary can claim unsupported events.
- Skip-to-outcome does not reliably show an outcome because of the separate ten-minute gate.
- There are no proper speed, pause, skip-song, highlights, or replay controls.
- The outcome report has too many equally weighted cards and no immediate headline result hierarchy.

### Existing viewer foundations

Reusable with changes:

- Supabase subscriptions and cleanup patterns;
- existing card shell and progress display;
- commentary feed as an accessible event log;
- skip control concept;
- audio control only as deferred optional enhancement.

Replace/new:

- deterministic event playback;
- venue/stage/crowd/band renderers;
- canonical commentary;
- speed/pause/replay controls;
- reconnectable phase state.

### Outcome report problems

- Duplicate metrics across Enhanced Metrics, Financial Deep Dive, Impact, Fan Growth, Member Rewards, and Setlist cards.
- Conflicting scales: 0-25 stars, percentages, 0-100 chemistry/equipment inputs.
- Missing values often become zero through `safeNumber`.
- Client compatibility transforms convert flat DB columns into nested breakdown/gear-effect objects.
- Several child cards fetch data separately after the outcome is loaded.
- Some information is technical or not immediately actionable but appears with headline-level weight.

### Data-model findings

Future work likely needs:

- `viewer_version`;
- `simulation_seed`;
- canonical event payload;
- `result_ready_at`;
- structured report summary;
- optional event sequence table later.

No migration is included in this PR.

## Recommended 2D approach

- Use Canvas plus DOM controls/event log as the safe default.
- Render venue, fans, band members, and effects as simple geometry.
- Cap visual fans and aggregate attendees.
- Use deterministic seeded movement and server-authored events.
- Keep cosmetic animation separate from outcome calculation.
- Provide reduced-motion and text-only equivalents.

## Canonical phase model

Initial phases:

1. `venue_opening`
2. `crowd_entry`
3. `pre_show`
4. `band_entrance`
5. `song_intro`
6. `song_performance`
7. `between_songs`
8. `highlight_moment`
9. `encore_decision`
10. `finale`
11. `band_exit`
12. `result_reveal`
13. `completed`

Default timing should be configurable, with a first target of 2-4 minutes at normal speed and about one minute at fast speed.

## Canonical event contract

Use a versioned `GigViewerEvent` sequence with:

- stable id and sequence;
- phase and event type;
- scheduled offset/duration;
- optional song and performer references;
- crowd energy before/after;
- importance;
- title/description;
- visual payload.

The safest storage model is hybrid: generate once server-side, store outcome summary/version/seed/event payload as JSON first, and add normalized event rows later only if needed.

## Authority boundaries

Server authoritative:

- start/completion;
- attendance;
- song scores;
- rewards/profit/fans/fame/chemistry;
- member progression;
- significant moments;
- canonical event sequence or seed.

Client presentation only:

- interpolation;
- movement;
- camera;
- visual effects;
- speed/pause;
- audio/mute;
- reduced-motion display.

## Report information hierarchy

- Level 1: immediate headline result.
- Level 2: performance story.
- Level 3: detailed analysis.

The current `GigOutcomeReport` should be rebuilt around a canonical DTO rather than continuing to patch flat/nested compatibility transforms in the page and report.

## Performance/accessibility targets

- 60fps desktop target, 30fps mobile acceptable.
- 300 default desktop fans, 150 default mobile fans, 500 hard cap initially.
- Pause animation work when hidden.
- Cleanup animation frames, timers, subscriptions, and audio.
- Reduced motion, keyboard controls, screen-reader summaries, colour-independent state, no flashing, no required audio.

## Analytics plan

Use existing analytics infrastructure only. Track viewer open/start, speed changes, song/highlight/result skips, completion, abandonment, replay, report opens, and section opens.

Success measures include viewer open rate, at-least-one-song watch rate, median viewing time, skip-to-result rate, replay rate, report completion, and return to gig history.

## Product decisions

Required soon:

- approve Canvas as first implementation default or choose SVG/DOM;
- approve expected viewer duration;
- confirm result is immediately skippable when outcome exists;
- decide setlist surprise visibility.

Safe defaults exist for speed options, pause, fan caps, textual commentary, and no required audio.

Deferred decisions include public spectators, non-member replay, venue layout publicity, and future audio.

## Delivery sequence

### Phase 5 PR 02 — Canonical outcome DTO and report-summary service

- Objective: define server/client DTO for headline result and report summary.
- Scope: map current `gig_outcomes`, `gig_song_performances`, performers, venue, and rewards into one read model; remove page-level compatibility transforms from new code path.
- Likely files: `src/features/gig-experience/services/`, shared types, tests, `GigOutcomeReport` adapter.
- Database impact: none or read-only; migration design only.
- Security impact: ensure no client reward recalculation.
- Dependencies: PR 01 decisions on immediate result fields.
- Acceptance: one DTO answers Level 1 without extra child-card queries.
- Tests: unit mapping for legacy/current outcomes, missing song data, zero attendance.
- Risk: medium.

### Phase 5 PR 03 — Outcome report information-architecture rebuild

- Objective: rebuild report into Level 1/2/3 hierarchy.
- Scope: headline card, performance story, collapsible details.
- Likely files: `src/features/gig-experience/components/`, existing gig report wrappers.
- Database impact: none.
- Security impact: none if DTO remains read-only.
- Dependencies: PR 02.
- Acceptance: immediate result is clear in seconds; detailed cards are collapsed/ordered.
- Tests: component tests for hierarchy and missing data.
- Risk: medium.

### Phase 5 PR 04 — 2D viewer shell, venue layout, deterministic entity engine

- Objective: add non-authoritative visual shell and deterministic renderer foundation.
- Scope: Canvas shell, venue presets, seeded random, entity caps, reduced-motion fallback.
- Likely files: `src/features/gig-experience/viewer/`, `simulation/`, tests.
- Database impact: none initially; use mock/derived event data.
- Security impact: renderer must not mutate outcome.
- Dependencies: Canvas/product duration decision.
- Acceptance: static/replay demo from existing outcome data.
- Tests: deterministic seed, caps, layout presets.
- Risk: medium-high.

### Phase 5 PR 05 — Crowd entrance and venue filling

- Objective: show venue opening and audience arrival.
- Scope: fan aggregation, fill zones, density scaling.
- Database impact: none.
- Security impact: none.
- Dependencies: PR 04.
- Acceptance: 50/500/50,000 attendance feels different within caps.
- Tests: low/sold-out attendance, mobile caps.
- Risk: medium.

### Phase 5 PR 06 — Band entrance, stage positions, and movement

- Objective: render performers and role-based positions.
- Scope: role mapping from `gig_performers`/band members, fallback placement, movement zones.
- Database impact: possible future role enrichment design only.
- Security impact: respect member visibility/RLS.
- Dependencies: PR 04.
- Acceptance: unknown roles and large bands do not overlap/break.
- Tests: role mapping, large bands, missing profile.
- Risk: medium.

### Phase 5 PR 07 — Song timeline, crowd-state changes, and commentary

- Objective: drive playback from setlist/song performance facts.
- Scope: song events, crowd energy states, factual commentary log.
- Database impact: design for canonical events may begin.
- Security impact: no outcome mutation.
- Dependencies: PR 02/04.
- Acceptance: story follows setlist order and score changes.
- Tests: deterministic sequence, missing song data, poor/excellent gigs.
- Risk: medium-high.

### Phase 5 PR 08 — Highlights, finale, and viewer controls

- Objective: add highlights, encore/finale, play/pause/speed/skip controls.
- Scope: controls, result skip, highlight navigation, replay entry.
- Database impact: possibly event payload fields if approved.
- Security impact: skipping must not affect rewards.
- Dependencies: PR 07.
- Acceptance: skip-to-result works once outcome exists.
- Tests: skip no reward changes, controls keyboard support.
- Risk: medium.

### Phase 5 PR 09 — Reconnect, replay, skip, and analytics

- Objective: persist/recover viewer state and measure engagement.
- Scope: event offsets, replay completed gigs, analytics events using existing infra.
- Database impact: likely `result_ready_at`, `viewer_version`, `simulation_seed`, event payload.
- Security impact: multi-tab/read-only safety.
- Dependencies: migration approval and PR 08.
- Acceptance: reconnect resumes correct phase; duplicate tabs do not duplicate completion.
- Tests: reconnect, hidden tab, duplicate tab, analytics emission.
- Risk: high.

### Phase 5 PR 10 — Performance, accessibility, testing, and Phase 5 review

- Objective: harden and close Phase 5.
- Scope: profiling, reduced motion, mobile, cleanup, docs/review.
- Database impact: none expected.
- Security impact: final RLS/read-path review.
- Dependencies: PR 04-09.
- Acceptance: budgets met and accessibility checklist passes.
- Tests: full unit/component/e2e where available, typecheck/lint/build.
- Risk: medium.

## Recommended Phase 5 PR 02

Build the canonical outcome DTO and report-summary service first. This unlocks the immediate result, removes fragile client transforms, and gives the future viewer a stable read model without touching balance or migrations.
