# Live Gig System Audit

Phase 5 PR 01 documented the existing RockMundo gig journey, viewer, outcome report, and data model. Phase 5 PR 02 adds a canonical `GigExperienceDTO` and summary service without changing balance, adding migrations, redesigning the viewer, or replacing completion logic.

## Repository evidence reviewed

- `docs/realtime-gig-system.md`
- `docs/social/implementation/PHASE_4_REVIEW.md`
- `src/pages/PerformGig.tsx`
- `src/components/gig-viewer/TopDownGigViewer.tsx`
- `src/components/gig-viewer/GigAudioPlayer.tsx`
- `src/components/gig/GigOutcomeReport.tsx`
- `src/components/gig/*.tsx`
- `src/hooks/useRealtimeGigAdvancement.ts`
- `src/hooks/useManualGigStart.ts`
- gig calculation and narrative utilities under `src/utils/`
- gig edge functions under `supabase/functions/`
- gig-related migrations under `supabase/migrations/`

## Current player journey

### Routes and entry points

| Route / surface | Evidence | Current behaviour |
|---|---|---|
| `/gig-booking` | `src/App.tsx`, `src/pages/PerformGig.tsx` back links | Main schedule/booking return route. |
| `/gig/:gigId` or equivalent routed page | `PerformGig` reads `gigId` from route params | Detailed gig page for preparation, live viewing, finalisation, and report modal. |
| Band history | `src/components/band/GigHistoryTab.tsx` | Loads completed outcomes and can open the same report and replay-style viewer. |
| News/other band outcomes | `src/components/news/LastNightGigs.tsx`, `src/components/news/OtherBandsGigOutcomes.tsx` | Reuses `GigOutcomeReport`, meaning report availability can differ from the ten-minute gate in `PerformGig`. |
| Notifications/inbox | `useGameEventNotifications`, `complete-gig`, database trigger notes in version history | Gig outcome notifications point users back to gig booking rather than a dedicated report route. |

### Upcoming gig

1. `PerformGig` loads `gigs` with venue data, then checks `gig_outcomes` for an existing result.
2. It loads band setlists, setlist song counts, current setlist songs, rehearsals, stage equipment count, crew count, and band chemistry/fame/fans.
3. It shows the gig header, setlist selector/display, ticket-price adjustment when still scheduled and sales are poor, read-only performer section, and preparation checklist.
4. The live viewer appears if the gig is within ten minutes of scheduled start, currently in progress, ready for completion, or completed less than ten minutes ago.

### Preparation

Preparation is represented as information and selectors, not an interactive performance simulation:

- Setlist may be changed through `GigSetlistDisplay`; the comment in `PerformGig` says it is locked one hour before the gig.
- Ticket price adjustment appears only for scheduled gigs with at least seven days remaining, low predicted sales, and no previous adjustment.
- `GigPreparationChecklist` receives rehearsals, equipment count, crew count, chemistry, and gear effects.
- `GigPerformersSection` displays the Phase 4 read-only performer/lineup data.

### Manual and automatic start

| Start path | Verified behaviour | Risk |
|---|---|---|
| Manual start | `useManualGigStart` checks status and setlist, then updates `gigs.status='in_progress'`, `started_at=now`, and `current_song_position=0`. `PerformGig` also checks current city and scheduling conflict before calling it. | Client can issue the status update directly through Supabase if policies allow it; no RPC lock is visible in the hook. |
| Automatic start | `docs/realtime-gig-system.md` and `supabase/functions/auto-start-gigs` describe a cron/edge flow that starts due gigs. | Local UI still contains manual fallback. |

### Live viewer and realtime advancement

The current active viewer is `TopDownGigViewer`, not the older `RealtimeGigViewer` described in the realtime documentation.

- `PerformGig` enables `useRealtimeGigAdvancement(gigId, shouldShowLiveViewer && !showOutcome)`.
- `useRealtimeGigAdvancement` fetches `gigs`, setlist songs, and the outcome row; then it invokes `process-gig-song` for the current position and calls `advance_gig_song`.
- It schedules follow-up checks based on song durations, subscribes to `gigs` updates for the current gig, and cleans up the timeout and realtime channel on unmount.
- `TopDownGigViewer` separately polls gig data every eight seconds, polls song performances every five seconds, and subscribes to `gig_song_performances` inserts and `gigs` updates.

### Completion and report delay

Verified facts:

- Outcomes can exist before the report is displayable. `PerformGig` queries `gig_outcomes`, but if `gigs.completed_at` is less than ten minutes ago it discards the loaded outcome and shows processing state.
- The ten-minute delay is a client UI gate in `PerformGig`, implemented with `differenceInMinutes(now, completedAt) >= 10`, a refresh timeout for `completed_at + 10 minutes`, and a one-second countdown.
- The viewer itself does not necessarily last ten real minutes. Song advancement uses actual setlist song durations from `started_at`; completed gigs stay in the live-viewer window for ten minutes after completion.
- Closing the page can affect client-driven song-by-song progression because `useRealtimeGigAdvancement` only runs while the page is open; however `auto-complete-gigs` and `complete-gig` include server-side completion/backfill paths for unplayed songs.
- `complete-gig` processes missing songs server-side before final calculations, so outcome generation is after or at completion and can recover from incomplete client playback.
- Multiple browser tabs can call `process-gig-song`/`advance_gig_song` concurrently. There is a per-hook `completingGigsRef`, but it is tab-local. The later `complete-gig` function is documented and coded as idempotent, but song advancement still has duplicate-call risk unless database constraints/functions prevent it.
- Reconnecting restores the stored `gigs.status`, `started_at`, `current_song_position`, and existing song performance rows, but there is no canonical viewer timeline state or deterministic event offset.
- Players may see report data immediately through other routes that render `GigOutcomeReport` directly from `gig_outcomes` without the `PerformGig` ten-minute gate.

### Loading, error, and recovery states

| State | Current implementation |
|---|---|
| Initial load | Spinner card in `PerformGig`. |
| Gig not found | Message and back button. |
| Load failure | Toast and navigate to `/gig-booking`. |
| Manual start failure | Toast from `useManualGigStart`; wrong-city and schedule-conflict toasts in page. |
| Advancement failure | Toast on edge function errors; retries every ten seconds for unexpected errors. |
| Completion failure | Toast from `handleFinalizeGig` or advancement hook. |
| Recently completed | Processing card, countdown, refresh button. |
| Stuck gig | Button invokes `fix-stuck-gigs`. |
| Report open/close | Modal controlled by local `showOutcome`; no route state. |

### Skip behaviour

- `TopDownGigViewer` has a `Skip to Outcome` button.
- It pauses audio, clears ambient commentary, and calls `onComplete`.
- It does not complete the gig or unlock a delayed report by itself; `PerformGig` just reloads and will still hide the outcome inside the ten-minute window.
- Skipping therefore changes only the local viewing experience, not rewards, but the label overpromises when the outcome is not yet available.

### Mobile behaviour

- `GigOutcomeReport` uses a `95vw`, `90vh`, scrollable dialog with responsive grids and smaller text.
- `TopDownGigViewer` is card-based with a fixed `h-[500px]` scroll area and compact controls; it has no dedicated mobile performance cap because it renders text rather than a large entity field.
- No explicit reduced-motion, keyboard shortcut, or screen-reader status model was found in the viewer.

## Existing live viewer audit

### Current visual model

`TopDownGigViewer` is named like a spatial viewer but currently renders a live commentary card:

- no canvas, SVG stage, or top-down map;
- no venue geometry;
- no fan entities;
- no band-member entities;
- progress is a song-count progress bar;
- crowd mood is a label from latest `gig_song_performances.crowd_response`;
- extensive random ambient commentary is generated in the browser;
- optional song audio playback is attempted from `songs.audio_url`.

### Rendering and animation

| Area | Current approach | Category |
|---|---|---|
| Card shell/header | React + existing UI components | Reusable with changes |
| Commentary feed | DOM list in scroll area | Reusable with changes as accessibility/event-log surface |
| Progress bar | Song completion percentage | Reusable with changes |
| Audio controls | HTMLAudioElement + volume slider | Deferred / unverified for future audio |
| Random ambient comments | `Math.random`, local timers | Replace for canonical story; may keep as cosmetic only if labelled |
| Realtime subscriptions | Supabase channels | Reusable with changes; filters need tightening for song inserts |
| Polling | 8s gig reload + 5s performance reload | Replace or reduce after canonical event service |
| Stage/crowd/band visuals | Not implemented | Replace / new implementation |
| Skip button | Local callback | Reusable with semantic changes |
| Pause/speed controls | Not present | New implementation |

### Song progression and narration

- Song performance rows drive song commentary once rows exist.
- On first load, existing rows are replayed eight seconds apart even if the real gig is further along, which can misrepresent timing.
- Ambient commentary is not authoritative and can claim events that have no supporting outcome data: proposals, pyrotechnics, camera crews, LED screens, crowd surfing, and merch stock claims.
- Several `setTimeout` calls inside `processPerf` are not tracked for cleanup, creating stale-comment risk after unmount or skip.

### CPU, memory, and mobile risks

- Current viewer is lightweight compared with a canvas crowd, but it can keep adding unbounded commentary entries.
- Polling plus realtime subscriptions duplicate work.
- Untracked `setTimeout` callbacks can fire after unmount.
- Audio playback can be blocked by browser autoplay rules and is not part of an accessibility-first control model.

### Why players are likely to skip

Verified usability problems:

- The viewer does not show the promised spatial story of a performance.
- `Skip to Outcome` does not reliably reveal the outcome due to the separate ten-minute gate.
- There is no fast-forward, pause, skip-song, or highlights control.
- The commentary feed gives equal prominence to random flavour and actual performance facts.
- The fixed ten-minute post-completion delay blocks the report even when `gig_outcomes` already exists.

Assumptions requiring player telemetry:

- Players skip because they prefer immediate rewards.
- Players distrust non-authoritative commentary.
- Mobile users abandon because the scroll feed is too tall.

## Outcome report audit

### Sections rendered today

| Section | Player question | Source | Authority | Recommendation |
|---|---|---|---|---|
| Overall Performance | Was it good? | `gig_outcomes.overall_rating`, grade utility | Authoritative score, client grade label | Retain as headline, larger and simpler. |
| Stage Behavior Used | What behaviour modifiers applied? | `stage_behavior_used`, `stageBehaviors` utility | Mixed: stored behaviour key, client explanation | Move to detailed analysis/collapsed. |
| Enhanced Metrics | What are key results? | Outcome + derived `overallRating * 4`, best/worst from song rows | Mixed; some client-derived | Merge into Level 1 summary and Level 2 story. |
| Moment Highlights | What happened? | Optional prop; not loaded in `PerformGig` | Often absent | Replace with canonical event highlights. |
| Crowd Analytics | How did crowd react? | attendance, song performances, rating | Partly authoritative | Move to Level 2 with clearer momentum. |
| Financial Deep Dive | What did we earn? | flat outcome columns | Authoritative | Collapse under Level 3; headline only net profit. |
| No Merch warning | Why zero merch? | merch fields defaulting to zero | Inferred | Retain only with inventory evidence. |
| No Song Data warning | Why missing details? | song performance array | Authoritative absence | Retain as compatibility warning. |
| XP Rewards | What XP did members get? | optional `xpSummary` prop | Usually absent in current page | Needs canonical DTO; otherwise collapse/omit. |
| Fan Growth | How many fans converted? | optional prop or fallback fans | Often absent | Headline should use authoritative stored fields. |
| Venue Relationship | Did venue like us? | optional prop | Often absent | Detailed only. |
| Band Chemistry | Did chemistry change? | outcome/page props | Authoritative-ish; scale mismatch 0-100 vs 0-25 | Detailed analysis. |
| Gear Bonuses Applied | What gear helped? | props or fallback mapping from flat columns | Mixed and legacy-transformed | Collapse; fix DTO naming first. |
| Band Member Performances | Who performed well? | separate query by band | Client-derived from overall rating | Replace with canonical performer facts or label as estimate. |
| Member Rewards | Who gained fame/fans? | separate query/fallback formulas | Mixed; fallback formulas | Use server-authored reward records only. |
| Setlist Performance | Which songs worked? | `gig_song_performances` | Authoritative | Level 2, less modifier detail by default. |
| Performance Factors | Why score happened? | flat averages / breakdown JSON | Authoritative but technical | Level 3 collapsed. |
| Impact | Fame, chemistry, merch | outcome and transformed breakdown | Duplicates other cards | Merge/remove. |

### Report problems

- Too many cards receive equal visual weight.
- Financial, impact, enhanced metrics, fan growth, XP, member rewards, and setlist cards duplicate player questions.
- Rating uses a 0-25 scale while enhanced metrics converts to percentage and chemistry often uses 0-100 elsewhere.
- Historically, `safeNumber` silently turned missing values into zero, hiding absent/legacy data; Phase 5 PR 02 introduces `ReportMetric<T>` for the canonical DTO while the preserved report UI still has temporary adapter fallbacks.
- Historically, `PerformGig` converted flat columns into `breakdown_data` and `gear_effects`; Phase 5 PR 02 moves the new canonical compatibility mapping into `GigExperienceService`.
- `GigOutcomeReport` can now consume `GigExperienceDTO`, but some child cards still own legacy member/reward fetching until PR 03 removes or replaces them.
- Several values are client-derived or fallback formulas rather than explicit server-authored report facts.
- Moment highlights and fan/XP/venue relationship props are optional and usually absent from the `PerformGig` path.

## Outcome data model audit

### Core relationships

- `gigs` belongs to `bands` and `venues`, optionally references a `setlist`, and stores schedule/status/start/completion progress fields.
- `setlists` belongs to `bands`; `setlist_songs` orders songs within a setlist.
- `gig_outcomes` is unique per gig and stores flat outcome totals, ratings, progression deltas, and legacy JSON breakdowns.
- `gig_song_performances` stores one row per performed song/item and contribution components.
- `gig_performers` stores selected/performed/missed profiles for a gig, but outcome scoring is still song/band-level rather than performer-event-level.
- `band_stage_equipment` and `band_crew_members` are inputs to calculations.
- Notifications/inbox are produced after outcome insert/completion and route back toward gig surfaces.

### Important schema/UI mismatches

| Finding | Impact |
|---|---|
| Contribution column names have legacy variants (`song_quality_contribution` vs UI `song_quality_contrib`, position vs setlist_position). | Requires compatibility transforms and increases breakage risk. |
| `gig_outcomes.breakdown_data` and flat columns both represent factor breakdowns. | Duplicates source of truth. |
| Gear-effect compatibility maps fields named `band_synergy_modifier`, `social_buzz_impact`, `audience_memory_impact`, `promoter_modifier`, `venue_loyalty_bonus` into unrelated gear concepts. | Naming is misleading for future contracts. |
| `gigs.attendance` and `gig_outcomes.actual_attendance` can both exist. | Viewer/report need a canonical attendance source. |
| `completed_at` exists on gigs and was also added historically to outcomes. | Result readiness should use an explicit `result_ready_at` rather than infer from completion. |
| `gig_performers.role_or_instrument` exists, but there is no per-performer stage position, stage role, moment, or contribution row. | Future band-entity viewer lacks canonical movement/role data. |
| No deterministic simulation seed, viewer version, canonical event sequence, event timestamps, per-song crowd energy before/after, or venue layout inputs. | Reconnect/replay/seek are impossible to make exact. |

### Current authority boundaries

Server/edge/database currently own:

- final gig completion;
- missing-song processing during completion;
- outcome totals;
- song performance rows;
- band balance/fame/fans/chemistry/member progression side effects;
- notifications/inbox.

Client currently owns:

- manual start status update;
- live advancement scheduling while page is open;
- random commentary;
- report delay gate;
- report compatibility transforms;
- several report presentation fallbacks.

## Explicit answers to requested verification questions

| Question | Verified answer |
|---|---|
| Why is the outcome hidden for ten minutes after completion? | `PerformGig` discards existing outcomes until `differenceInMinutes(now, completedAt) >= 10` and shows a processing countdown. This is a client UI gate, not evidence of calculation need. |
| Does the viewer itself last ten real minutes? | Not inherently. Song advancement follows real song durations; the page continues showing live/recent viewer state for ten minutes after completion. |
| Does closing the page affect progression? | It can stop client advancement, but server auto-complete/complete-gig can complete and backfill missing song rows. |
| Does the gig continue server-side? | Yes, there are `auto-start-gigs`, `auto-complete-gigs`, scheduled activity processing, and `complete-gig` server paths, but song-by-song live progression is still partly client driven. |
| Does reconnect restore correct phase? | It restores coarse DB state and rows, not an exact canonical viewer phase. |
| Can multiple tabs cause duplicate advancement? | Yes, duplicate client advancement calls are possible. Final completion is guarded/idempotent, but per-song advancement still needs server-side idempotency guarantees for the future. |
| Can players see report immediately through another route? | Likely yes. Gig history/news components render `GigOutcomeReport` from `gig_outcomes` without the `PerformGig` ten-minute discard gate. |
| Are outcomes generated before, during, or after viewer? | An outcome row may be found during live progression; final authoritative totals are generated/updated by `complete-gig` after songs are processed or backfilled. |


## Phase 5 PR 02 implementation status

- Added `GigExperienceDTO` with `gig`, `headline`, `songs`, `performers`, `finances`, `progression`, `analysis`, `lessons`, and `viewer` sections.
- Added `ReportMetric<T>` states for `available`, `processing`, `legacy_missing`, and `not_applicable`.
- Added `GigExperienceService` as the canonical outcome summary assembler and validator.
- `PerformGig` now requests the canonical DTO with a stable React Query key and passes it to the existing report.
- `GigOutcomeReport` retains its current layout through a temporary DTO-to-legacy adapter pending PR 03.
- Remaining factual gap: member reward cards and the broader report card wall are not yet fully DTO-native.

## Phase 5 PR 03 implementation update

Phase 5 PR 03 rebuilds `GigOutcomeReport` around the canonical `GigExperienceDTO` presentation boundary. The report now prioritises a headline result, a chronological performance story, lessons for the next gig, and collapsed detailed analysis. Legacy outcome props are still supported through a DTO-shaped adapter inside the report component. No gig calculations, rewards, progression rules, replay implementation, Canvas viewer, or historical migrations were changed.

## Phase 5 PR 04 factual update

The current implementation now includes a server-authoritative gig lifecycle hardening pass. `start_gig_authoritative` owns guarded manual starts, `auto-complete-gigs` advances due setlist positions, `process-gig-song` is idempotent per outcome position, `claim_gig_completion` serializes completion, and `result_ready_at` determines report availability. The former realtime advancement hook is retained only as a compatibility alias to a read-only subscription/refetch hook.


## Phase 5 PR 05 update

Phase 5 PR 05 status: completed gigs now request an idempotent service-role canonical viewer replay after `result_ready_at`; replay payloads are stored separately from outcomes and can fail without blocking reports.

## Phase 5 PR 06 viewer/replay status

Stored replay reads now have a frontend viewer shell for completed replay-ready gigs. The shell supports controlled loading, generating, unavailable, failed, unsupported, malformed, access-denied/network, cancelled, empty, and completed states. Rendering is read-only and isolated from gig progression, rewards, song scoring, completion, and replay generation.

## Phase 5 PR 07 viewer/crowd status

The Canvas viewer now includes deterministic animated crowd entry and venue filling. The system derives presentation-only crowd entities from stored replay seed, canonical event offsets, attendance, capacity, venue preset, viewport size, and reduced-motion preference. It does not mutate replay rows, gig outcomes, rewards, progression, or historical migrations. Accessible status text reports attendance, capacity, fill percentage, crowd phase, and occupied zones.


## Phase 5 PR 08 viewer/performer status

The Canvas viewer now includes presentation-only band entrance, stage positioning, performer movement, and band exit reconstruction. Performer roles are normalized centrally; stage slots, backstage queue points, movement zones, idle offsets, direct `performer_move` overrides, and exit hiding are derived deterministically from replay data, viewport size, venue preset, and reduced-motion preference. The accessible replay UI includes a semantic performer list with names, role/instrument labels, lifecycle state, stage location, and focus state. No gig outcome, reward, progression, Supabase mutation, or historical migration changed.


## Phase 5 PR 09 viewer/story status

The Canvas replay now reconstructs the performance story from stored replay offsets. Song segments expose intro/performance/peak/ending/completed phases, score badges from authoritative DTO data, energy before/after, best/weakest/opener/finale flags, and a single positive-delta turning point when meaningful. The DOM companion UI adds current-song status, factual commentary with duplicate suppression, a crowd mood graph, grouped song timeline, local skip controls, and a result reveal overlay. Canvas crowd reactions are presentation-only and remain bounded by canonical energy/reaction events, viewport, reduced-motion preference, and existing entity caps. No Supabase writes, historical migrations, authoritative outcome calculations, reward logic, or song-score generation changed.

## Phase 5 PR 10 audit update

Current live-gig route: the gig detail page continues to use `PerformGig` and retains `TopDownGigViewer` as the safe in-progress presentation path. Current completed-gig route: the same gig detail page exposes the immediate outcome report and lazy-loads `GigViewerShell` only when the player opens Replay Gig. Replay entry points are completed gig detail and gig-history style report surfaces that can pass completed gig IDs into the replay shell; report entry points remain `GigOutcomeReport`-based and are independent of replay availability. Legacy or missing replay rows fall back to report-only states. Temporary compatibility retained: `TopDownGigViewer` for live in-progress gigs and the read-only `useRealtimeGigAdvancement` alias. Verified PR 10 fixes: replay generation can recover stale/failed service-role rows, replay validation handles malformed event arrays safely, and canonical payload size/event/message limits are enforced. Remaining P0 audit gate: clean Supabase reset, SQL harnesses, browser/mobile/a11y tests, and dependency-backed checks must be run before beta can be declared fully ready.
