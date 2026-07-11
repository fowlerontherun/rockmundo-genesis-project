# RockMundo Live Gig Experience Implementation Roadmap

## Purpose

This document converts the Phase 5 live-gig audit and review findings into an implementation roadmap for rebuilding the RockMundo live gig viewer and gig outcome report.

The programme is intended to make gigs:

- engaging enough that players want to watch;
- understandable enough that the result feels fair;
- lightweight enough to run well on mobile and desktop;
- deterministic, replayable, reconnectable, and safe across multiple browser tabs;
- server-authoritative so viewing, skipping, pausing, or closing the page never changes rewards;
- useful as a management feedback loop rather than a one-time statistics screen.

The target visual style is a lightweight Football Manager-inspired 2D viewer using simple venue geometry, moving crowd dots, performer counters, concise commentary, and a structured post-gig report.

This plan does **not** propose a full rewrite of the gig system. It preserves the existing gig, outcome, setlist, performer, venue, reward, and progression foundations and improves them through small, dependency-aware pull requests.

---

# 1. Product Vision

## 1.1 Target player journey

```text
Gig preparation
↓
Venue opens
↓
Fans enter and fill the room
↓
Band walks on stage
↓
Set begins
↓
Songs play in setlist order
↓
Crowd energy changes
↓
Important moments occur
↓
Encore or finale
↓
Immediate headline result
↓
Performance story
↓
Detailed analysis
↓
Lessons for the next gig
↓
Replay, share, or continue
```

## 1.2 What the new experience must achieve

The viewer should answer:

- What is happening right now?
- Which song is playing?
- Is the crowd enjoying it?
- Which performer is having an impact?
- Did the gig build momentum or lose it?
- What was the turning point?
- Was there an encore?
- Did the gig succeed?
- What should the player improve next time?

## 1.3 Core principles

1. **Server authority first** — the browser presents the gig but does not decide the outcome.
2. **Story before statistics** — players should understand what happened before seeing technical modifiers.
3. **Simple visuals, strong meaning** — circles, movement, density, labels, and lighting can communicate enough without 3D.
4. **Immediate result access** — once the authoritative result exists, the player can view it immediately.
5. **Watching is optional, never punitive** — skipping must not reduce rewards or progression.
6. **Replay must be deterministic** — the same completed gig should replay the same story.
7. **Unknown is not zero** — missing legacy data must not be displayed as a confirmed zero.
8. **Accessible equivalent required** — the Canvas view must have a synchronized textual event log.
9. **No unnecessary rewrite** — reuse existing gig tables, outcome calculations, report cards, routes, and hooks where safe.
10. **Incremental delivery** — each PR should leave the game in a stable, releasable state.

---

# 2. Current Problems to Solve

## 2.1 Live viewer problems

The current viewer:

- is mainly a commentary feed rather than a spatial 2D performance;
- includes random ambient comments that can describe unsupported events;
- lacks proper pause, fast-forward, skip-song, highlights, and replay controls;
- partly relies on a mounted browser hook for song advancement;
- may receive duplicate advancement attempts from multiple browser tabs;
- does not restore an exact viewer phase after reconnect;
- does not provide a canonical replay timeline;
- offers a “Skip to Outcome” action that can still leave the player waiting;
- duplicates work through polling and realtime subscriptions;
- risks stale timers and commentary after unmount.

## 2.2 Outcome report problems

The current report:

- gives too many cards equal visual importance;
- duplicates the same information across multiple sections;
- mixes 0–25, percentage, and 0–100 scales;
- silently converts missing values into zero;
- mixes flat database columns with compatibility JSON;
- includes client-derived or fallback values without clearly labelling them;
- loads some sections through additional child queries;
- does not quickly explain whether the gig went well;
- does not clearly identify the turning point;
- does not give the player useful next actions.

## 2.3 Architecture problems

The current flow lacks:

- one canonical outcome DTO;
- one canonical viewer event contract;
- strict event payload typing;
- explicit viewer and event schema versioning;
- a dedicated replay payload boundary;
- a formal viewer-duration compression algorithm;
- an authoritative result-ready timestamp;
- a server-owned event-generation process;
- a reliable distinction between missing, processing, not applicable, and actual zero.

---

# 3. Final Experience Structure

## 3.1 Level 1 — Immediate Result

Displayed as soon as the authoritative outcome is ready.

It should include:

- performance grade;
- one-sentence verdict;
- attendance versus capacity;
- net profit;
- fame gained;
- fans gained;
- best-performing song;
- biggest positive or negative moment;
- Continue button;
- View Performance Story button;
- View Full Analysis button;
- Replay Gig button when available.

This screen should be understandable within five seconds.

## 3.2 Level 2 — Performance Story

This should explain the narrative of the gig:

- venue opening;
- crowd arrival;
- band entrance;
- setlist timeline;
- song-by-song scores;
- crowd energy curve;
- major highlights;
- performer moments;
- turning point;
- encore decision;
- finale;
- final crowd verdict.

## 3.3 Level 3 — Detailed Analysis

Optional collapsed sections:

- ticket revenue;
- merchandise revenue;
- crew costs;
- equipment wear;
- other costs;
- net profit;
- rehearsal contribution;
- equipment contribution;
- crew contribution;
- chemistry contribution;
- member-skill contribution;
- venue relationship;
- fan conversion;
- XP and member rewards;
- technical modifiers;
- legacy or unavailable-data warnings.

## 3.4 Lessons for Next Time

Add a concise evidence-based section with:

### What worked

Examples:

- Strong final two songs.
- High rehearsal familiarity.
- Venue size matched current demand.
- Good equipment reliability.
- High chemistry supported consistency.

### What held the band back

Examples:

- Low attendance percentage.
- Poorly rehearsed song.
- Weak opening.
- Equipment issue.
- Setlist lost momentum.
- Venue too large.
- Crew quality below expected standard.

### Recommended actions

Examples:

- Rehearse a named song.
- Book a smaller venue.
- Improve equipment.
- Add crew.
- Change setlist order.
- Build local fame before returning.
- Improve chemistry before a major show.

Recommendations must be derived from authoritative or clearly labelled analytical data.

---

# 4. Canonical Outcome Read Model

## 4.1 Goal

Create one canonical read model that powers:

- the immediate result;
- the detailed report;
- the viewer timeline;
- gig history;
- replay;
- social sharing;
- future spectator mode.

The page and child cards should not each reconstruct the outcome independently.

## 4.2 Suggested DTO

```ts
export interface GigExperienceDTO {
  gig: {
    id: string;
    bandId: string;
    bandName: string;
    venueId: string;
    venueName: string;
    venueType: string | null;
    capacity: number;
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    resultReadyAt: string | null;
    status: string;
  };

  headline: {
    rating: ReportMetric<number>;
    grade: ReportMetric<string>;
    verdictKey: string;
    verdictParams: Record<string, string | number>;
    attendance: ReportMetric<number>;
    attendancePercentage: ReportMetric<number>;
    netProfit: ReportMetric<number>;
    fansGained: ReportMetric<number>;
    fameGained: ReportMetric<number>;
    bestSongId: string | null;
    bestSongTitle: string | null;
    biggestMomentId: string | null;
  };

  songs: GigSongResult[];
  performers: GigPerformerResult[];
  finances: GigFinancialSummary;
  progression: GigProgressionSummary;
  analysis: GigTechnicalAnalysis;
  lessons: GigLesson[];
  viewer: GigViewerReplayDescriptor | null;
}
```

## 4.3 Missing-data semantics

```ts
export type ReportMetric<T> =
  | { status: 'available'; value: T }
  | { status: 'not_applicable' }
  | { status: 'legacy_missing' }
  | { status: 'processing' };
```

Rules:

- An actual zero is `{ status: 'available', value: 0 }`.
- Missing old data is `legacy_missing`.
- A result still being calculated is `processing`.
- A metric irrelevant to the gig is `not_applicable`.
- Do not convert missing data to zero.

## 4.4 Query rules

The DTO service should:

- use narrow selects;
- avoid N+1 profile and song queries;
- load songs, performers, venue, and outcome in predictable batches;
- avoid child components issuing independent outcome queries;
- avoid recalculating authoritative rewards in the browser;
- expose legacy compatibility mapping in one place only;
- validate unexpected values;
- return safe fallbacks without hiding missing data.

---

# 5. Server-Authoritative Gig Progression

## 5.1 Required behaviour

The gig must progress even when:

- no player watches;
- the viewer page is closed;
- the network disconnects;
- multiple tabs are open;
- the browser is suspended;
- the player skips directly to the result.

## 5.2 Server responsibilities

The server should own:

- gig start;
- current authoritative song position;
- song processing;
- song-performance insertion;
- gig completion;
- attendance;
- outcome generation;
- rewards;
- fan and fame changes;
- chemistry changes;
- significant moments;
- canonical event generation;
- `result_ready_at`.

## 5.3 Idempotency

Required guarantees:

- each song is processed at most once;
- one `gig_song_performances` row per canonical song position;
- repeated completion calls return the existing outcome;
- multiple tabs cannot duplicate progression;
- retries do not duplicate rewards;
- viewer playback never writes progression state;
- replay never triggers completion or rewards.

## 5.4 Result availability

Remove the fixed ten-minute client gate.

New rule:

```text
If result_ready_at exists and the outcome is readable,
the result is available immediately.
```

The viewer may continue cosmetically, but:

- Skip to Result should work immediately;
- closing the viewer should not delay the result;
- other routes should use the same availability rule;
- notifications should link directly to a valid result route.

---

# 6. Canonical Viewer Event Model

## 6.1 Required characteristics

The event sequence must be:

- generated once;
- deterministic;
- versioned;
- reconnectable;
- seekable;
- replayable;
- independent of frame rate;
- safe across multiple tabs;
- server-authored;
- independent of reward logic.

## 6.2 Event envelope

```ts
export interface GigViewerEventBase {
  id: string;
  gigId: string;
  sequence: number;
  phase: GigViewerPhase;
  scheduledOffsetMs: number;
  durationMs: number;
  importance: 'ambient' | 'normal' | 'important' | 'critical';
  songId?: string | null;
  performerProfileId?: string | null;
  crowdEnergyBefore?: number | null;
  crowdEnergyAfter?: number | null;
  messageKey: string;
  messageParams: Record<string, string | number>;
}
```

## 6.3 Typed visual payload

Do not use an unrestricted `Record<string, unknown>`.

```ts
export type GigVisualPayload =
  | {
      type: 'venue_open';
      entranceIds: string[];
      lightLevel: number;
    }
  | {
      type: 'crowd_fill';
      targetDensity: number;
      zoneIds: string[];
      enteringCount: number;
    }
  | {
      type: 'performer_move';
      performerId: string;
      targetPosition: StagePosition;
      movementStyle: 'walk' | 'rush' | 'step_forward';
    }
  | {
      type: 'crowd_reaction';
      reaction: 'still' | 'bounce' | 'jump' | 'wave' | 'disperse';
      intensity: number;
      zoneIds?: string[];
    }
  | {
      type: 'spotlight';
      performerId?: string;
      stageZone?: string;
      intensity: number;
    }
  | {
      type: 'moment_effect';
      effect: 'pulse' | 'ring' | 'trail' | 'confetti';
      targetId?: string;
      intensity: number;
    };
```

## 6.4 Versioning

Every replay should include:

- `viewer_version`;
- `event_schema_version`;
- `simulation_seed`;
- `generated_at`;
- `duration_ms`;
- optional checksum;
- event payload.

Unknown event versions must fail gracefully into:

- text-only replay;
- report-only fallback;
- no crash.

## 6.5 Localisation

Store:

- `message_key`;
- `message_params`.

Do not permanently store one English sentence as the only canonical representation.

---

# 7. Replay Data Boundary

## 7.1 Recommended model

Keep core outcome and replay payload separate.

```text
gig_outcomes
  authoritative totals and final values

gig_report_summaries
  canonical report DTO or structured summary

gig_viewer_replays
  gig_id
  viewer_version
  event_schema_version
  simulation_seed
  duration_ms
  event_payload
  generated_at
```

## 7.2 Why separate replay storage

This prevents:

- normal report queries downloading large event payloads;
- large JSON rewrites for unrelated outcome updates;
- replay data complicating ordinary gig-history queries;
- future viewer versions overwriting old replays;
- report loading being blocked by viewer payload size.

## 7.3 Replay rules

- Completed gigs can be replayed by authorised users.
- Replay never recalculates anything.
- Replay uses stored canonical events.
- Old incompatible replay versions fall back to text/report mode.
- Replay analytics do not alter rewards.
- Public replay remains deferred until privacy rules are agreed.

---

# 8. Viewer Timing and Compression

## 8.1 Target duration

Safe default:

- normal: approximately 3 minutes;
- fast: approximately 1 minute;
- skip: immediate result when available.

## 8.2 Compression algorithm

Do not assign fixed 15–35 second durations to every song.

Example:

```text
Target viewer duration: 180 seconds
Fixed phase budget: 50 seconds
Remaining song budget: 130 seconds
```

Suggested rules:

- 2–5 songs: 18–25 seconds each;
- 6–10 songs: 12–18 seconds each;
- 11–20 songs: 7–12 seconds each;
- over 20 songs: combine low-importance songs into montage events.

Give extra time to:

- opening song;
- best song;
- worst song;
- major turning point;
- final song;
- encore.

Fast mode should compress the same event sequence rather than generate a different story.

---

# 9. 2D Viewer Design

## 9.1 Rendering approach

Recommended:

- Canvas for moving entities;
- React DOM for controls, headings, timeline, event log, and result overlays;
- no 3D library;
- no physics engine;
- no heavy particle framework.

## 9.2 Venue presets

Initial presets:

- small;
- medium;
- large.

Future expansion:

- tiny club;
- theatre;
- arena;
- stadium;
- festival stage.

Each preset should define:

- stage bounds;
- backstage entrance;
- audience zones;
- entry doors;
- barriers;
- seating or standing areas;
- camera bounds;
- performer slots;
- crowd movement zones.

## 9.3 Fan entities

Fans should:

- enter through venue entrances;
- move towards free crowd positions;
- idle subtly;
- react according to crowd state;
- become more active during strong songs;
- become still or disperse during poor moments;
- leave at the end.

Do not render one dot per attendee.

## 9.4 Crowd aggregation

Recommended visual caps:

| Mode | Fan cap |
|---|---:|
| Reduced motion | 0–50 static dots or blocks |
| Mobile low performance | 60–80 |
| Mobile default | 100–150 |
| Desktop default | 200–300 |
| Desktop high | 400–500 |

Use weighted entities rather than simple ceiling division.

The displayed attendance number must always remain authoritative.

## 9.5 Crowd zones

Possible zones:

- front row;
- main floor;
- rear floor;
- seating;
- VIP;
- bar;
- merchandise area.

## 9.6 Band entities

Use larger circles with:

- initials;
- instrument icon;
- role label;
- selected outline;
- simple movement trail;
- highlight pulse.

Expected stage behaviour:

- vocalist moves most;
- lead guitarist steps forward for solos;
- rhythm guitarist and bassist roam within defined zones;
- drummer stays near rear centre;
- keyboard and DJ remain mostly fixed;
- backing vocalists move minimally;
- unknown roles use safe fallback slots.

Large bands must not overlap or break the layout.

## 9.7 Visual effects

Allowed:

- pulse;
- scale;
- ring;
- short trail;
- spotlight;
- colour intensity;
- crowd wave;
- floating label;
- limited confetti for exceptional finales.

Avoid:

- flashing;
- heavy particles;
- shaders;
- physics;
- expensive blur;
- constant full-screen animation.

---

# 10. Crowd State Model

Suggested states:

- arriving;
- waiting;
- attentive;
- warming;
- engaged;
- energetic;
- ecstatic;
- disappointed;
- leaving.

Inputs may include:

- current song score;
- previous momentum;
- attendance density;
- band fame;
- venue fit;
- chemistry;
- authoritative equipment issue;
- canonical highlight moment.

The crowd animation must represent the outcome. It must not calculate or alter the outcome.

---

# 11. Commentary and Storytelling

Commentary must be:

- derived from canonical facts;
- concise;
- non-repetitive;
- localisable;
- prioritised by importance;
- available in the text event log;
- safe for screen readers.

Examples:

- The room begins to fill.
- The band walks onto the stage.
- The opening song gets a cautious response.
- The front rows recognise the chorus.
- A strong solo lifts the crowd.
- An equipment issue interrupts the momentum.
- The band recovers quickly.
- The final two songs push the audience into an encore.
- The crowd begins to leave before the final song.

Do not claim pyrotechnics, crowd surfing, proposals, screens, camera crews, or sell-outs unless supported by canonical data.

---

# 12. Controls

Required:

- Play/Pause;
- 1× speed;
- 2× speed;
- Fast mode;
- Skip to Next Song;
- Skip to Highlights;
- Skip to Result;
- Replay;
- Reduced Motion;
- Mute future audio cues.

Rules:

- controls never alter the outcome;
- skipping never reduces rewards;
- result is available once the server marks it ready;
- paused playback does not pause server progression;
- reconnect restores viewer offset from canonical event timing.

---

# 13. Accessibility

Canvas must never contain the only meaningful information.

Required accessible equivalent:

- current phase heading;
- current song;
- crowd-state text;
- performer-event text;
- synchronized event log;
- keyboard controls;
- reduced-motion mode;
- static visual fallback;
- screen-reader status updates;
- colour-independent status;
- no flashing;
- no required audio;
- immediate access to the result.

The text event log is a first-class product surface, not a secondary debug panel.

---

# 14. Performance Requirements

Targets:

- 60fps desktop where practical;
- 30fps mobile acceptable;
- no animation when tab is hidden;
- clean cancellation of `requestAnimationFrame`;
- clean timer cleanup;
- clean audio cleanup;
- no updates after unmount;
- bounded event log;
- bounded entity count;
- no N+1 profile queries;
- low-performance mode;
- reduced-motion mode;
- mobile entity cap;
- graceful fallback when Canvas is unavailable.

---

# 15. Analytics

Use the existing analytics infrastructure only.

Track:

- `gig_viewer_opened`;
- `gig_viewer_started`;
- `viewer_speed_changed`;
- `song_skipped`;
- `highlights_skipped`;
- `result_skipped_to`;
- `viewer_completed`;
- `viewer_abandoned`;
- `viewer_replayed`;
- `report_opened`;
- `report_section_opened`;
- `lessons_viewed`;
- `share_recap_opened`.

Measure:

- viewer open rate;
- percentage watching at least one song;
- median watch time;
- skip-to-result rate;
- replay rate;
- report completion;
- lessons viewed;
- return to gig history;
- mobile abandonment;
- viewer error rate.

---

# 16. Expansion Opportunities

## 16.1 Pre-gig atmosphere

Later additions:

- visible queue;
- merchandise activity;
- support act preparation;
- backstage countdown;
- lighting test;
- crowd shirts reflecting band popularity.

## 16.2 Encore system

Encore should depend on authoritative factors such as:

- final crowd energy;
- overall rating;
- attendance percentage;
- fame relative to venue;
- final-song momentum.

The report should explain why an encore happened or did not happen.

## 16.3 Tour comparison

Future report additions:

- compare to previous gig;
- tour attendance trend;
- tour profit trend;
- best song across tour;
- crowd-energy trend;
- venue relationship history.

## 16.4 Shareable recap

Allow players to share a compact recap to Twaater or band feed.

## 16.5 Spectator mode

Deferred post-beta:

- friends watching;
- public replay;
- spectator reactions;
- public attendance and rating;
- no hidden member skills or private finances;
- reactions do not affect the result.

---

# 17. Delivery Plan

## Phase 5 PR 02 — Canonical Outcome DTO and Summary Service

**Status: Complete in Phase 5 PR 02.**

### Objective
Create one typed, authoritative read model for the gig result.

### Scope

- define `GigExperienceDTO`;
- define `ReportMetric<T>`;
- map current and legacy outcome fields;
- load outcome, venue, songs, performers, and rewards;
- remove new page-level compatibility mapping;
- provide headline result data without child queries.

### Acceptance criteria

- immediate result can render from one DTO;
- missing data is not silently converted to zero;
- no client reward recalculation;
- no N+1 queries;
- legacy outcomes produce controlled states;
- tests cover current, legacy, missing-song, zero-attendance, and sold-out gigs.

### Risk
Medium.

---

## Phase 5 PR 03 — Outcome Report Information Architecture Rebuild

**Status: Complete in Phase 5 PR 03.**

### Objective
Replace the card wall with a clear three-level report.

### Scope

- immediate result;
- performance story;
- collapsed detailed analysis;
- lessons for next time;
- preserve old report behind a temporary fallback if required.

### Acceptance criteria

- player understands success in five seconds;
- key result appears immediately;
- technical details are optional;
- duplicate cards removed or merged;
- mobile layout works;
- missing data displays correctly;
- no extra child report queries.

### Risk
Medium.

---

## Phase 5 PR 04 — Server-Authoritative Gig Timeline and Completion Hardening

### Objective
Remove browser ownership of gig progression.

### Scope

- server-owned song advancement;
- exactly-once song processing;
- idempotent completion;
- `result_ready_at`;
- multiple-tab safety;
- viewer becomes read-only;
- direct client advancement retired or guarded.

### Acceptance criteria

- gig completes with no viewer open;
- multiple tabs cannot duplicate songs;
- closing the page does not affect rewards;
- result becomes available immediately when ready;
- skip does not alter progression;
- reconnect shows authoritative status.

### Risk
High.

---

## Phase 5 PR 05 — Typed Event Schema and Replay Storage

### Objective
Create a versioned canonical viewer replay contract.

### Scope

- typed event union;
- message keys and parameters;
- viewer version;
- event schema version;
- simulation seed;
- replay descriptor;
- replay storage;
- unknown-version fallback.

### Acceptance criteria

- same gig produces one canonical event sequence;
- replay loads without recalculation;
- unknown event type fails safely;
- report query does not download replay payload by default;
- strict payload validation exists.

### Risk
Medium-high.

---

## Phase 5 PR 06 — Canvas Viewer Shell and Venue Engine

### Objective
Create the lightweight 2D rendering foundation.

### Scope

- Canvas shell;
- DOM controls;
- venue presets;
- deterministic random;
- entity manager;
- animation loop;
- resize handling;
- mobile caps;
- reduced-motion fallback.

### Acceptance criteria

- small, medium, and large venues render;
- same seed produces same layout;
- animation cleans up on unmount;
- hidden tabs stop animation work;
- Canvas failure falls back safely;
- no gameplay mutation.

### Risk
Medium-high.

---

## Phase 5 PR 07 — Crowd Entry and Venue Filling

### Objective
Show fans entering and filling the venue.

### Scope

- entrances;
- crowd zones;
- weighted fan entities;
- density scaling;
- arrival movement;
- waiting state;
- attendance milestones.

### Acceptance criteria

- 50, 500, and 50,000 attendees feel different;
- visual cap is respected;
- attendance never appears overstated;
- sold-out and low-attendance gigs look distinct;
- mobile performance remains acceptable.

### Risk
Medium.

---

## Phase 5 PR 08 — Band Entrance, Stage Positioning and Performer Movement

### Objective
Render the band entering and performing.

### Scope

- `gig_performers` mapping;
- role-based positions;
- fallback slots;
- movement zones;
- performer highlights;
- stage entrance and exit.

### Acceptance criteria

- singer, drummer, guitarists, bass, keyboard, DJ, backing vocals, and unknown roles render safely;
- large bands do not overlap;
- missing profile or role does not break the viewer;
- performer visibility respects existing access rules.

### Risk
Medium.

---

## Phase 5 PR 09 — Song Timeline, Crowd Energy, Commentary, Highlights and Finale

### Objective
Tell the story of the performance.

### Scope

- compressed timeline;
- song phases;
- crowd-state transitions;
- factual commentary;
- performer highlights;
- equipment issues;
- recovery;
- turning point;
- encore;
- finale.

### Acceptance criteria

- timeline follows canonical setlist order;
- normal playback is approximately three minutes;
- fast playback uses the same events;
- commentary is factual and localisable;
- best/worst/turning-point songs receive appropriate emphasis;
- missing song data produces a controlled fallback.

### Risk
High.

---

## Phase 5 PR 10 — Controls, Reconnect, Replay, Accessibility and Analytics

### Objective
Complete the viewer experience and close Phase 5.

### Scope

- pause;
- speed;
- skip-song;
- skip-highlights;
- skip-result;
- reconnect;
- replay;
- reduced motion;
- keyboard controls;
- analytics;
- performance profiling;
- phase review.

### Acceptance criteria

- skipping never changes rewards;
- reconnect restores the correct event offset;
- replay is deterministic;
- accessible event log mirrors important Canvas events;
- mobile and reduced-motion modes work;
- analytics capture engagement;
- no memory or timer leaks;
- Phase 5 review documents remaining gaps.

### Risk
Medium-high.

---

# 18. Testing Strategy

## 18.1 DTO and report tests

Cover:

- current outcome;
- legacy outcome;
- missing values;
- actual zero values;
- not-applicable values;
- result still processing;
- zero attendance;
- sold-out venue;
- missing songs;
- missing performers;
- missing reward data;
- negative profit;
- missing merchandise stock evidence.

## 18.2 Progression tests

Cover:

- no viewer open;
- one viewer;
- multiple tabs;
- network disconnect;
- duplicate server invocation;
- delayed job;
- incomplete song rows;
- completion retry;
- reward deduplication;
- result-ready timing;
- direct client advancement denial.

## 18.3 Event tests

Cover:

- deterministic generation;
- event ordering;
- event duration;
- schema validation;
- unknown payload;
- unknown viewer version;
- replay checksum if used;
- missing performer;
- missing song;
- cancelled gig;
- poor gig;
- excellent gig;
- encore and no encore.

## 18.4 Viewer tests

Cover:

- venue presets;
- stage bounds;
- crowd caps;
- weighted fan representation;
- large attendance;
- low attendance;
- zero attendance;
- large band;
- unknown roles;
- resize;
- mobile cap;
- reduced motion;
- hidden-tab pause;
- cleanup;
- Canvas unavailable fallback.

## 18.5 Accessibility tests

Cover:

- keyboard controls;
- screen-reader phase;
- event announcements;
- no colour-only meaning;
- reduced motion;
- no flashing;
- text-only result access;
- focus handling;
- skip-to-result access.

---

# 19. Security and Integrity

The viewer must not be able to:

- set gig status;
- advance song position;
- create song performance rows;
- create or alter the outcome;
- change attendance;
- change rewards;
- change fans or fame;
- change chemistry;
- change member progression;
- modify canonical events;
- regenerate a replay.

Review:

- RLS;
- RPC grants;
- Edge Function authentication;
- service-role usage;
- multiple-tab races;
- idempotency keys;
- unique song-position constraints;
- replay visibility;
- public spectator privacy;
- notification routes.

---

# 20. Product Decisions

## Required before implementation

- Confirm Canvas as the default renderer.
- Confirm normal viewer target of approximately three minutes.
- Confirm Fast mode target of approximately one minute.
- Confirm immediate Skip to Result once the outcome exists.
- Confirm whether setlist songs are visible before performance.
- Confirm replay availability for band members.

## Safe defaults

- Play/Pause supported.
- 1×, 2×, and Fast supported.
- No required audio.
- Text commentary always available.
- Mobile entity cap lower than desktop.
- Result never depends on watching.
- Replay uses stored events.
- Three venue presets initially.
- No public spectator mode during beta.

## Deferred

- Public spectators.
- Non-member replay.
- Audio and music synchronization.
- Custom venue art.
- Crowd clothing detail.
- Support acts.
- Session-player close-ups.
- Tour-wide replay comparisons.
- Public reactions.
- Shareable external video export.

---

# 21. Definition of Done for Live Gig Experience 1.0

The phase is complete when:

- gigs progress and complete server-side without a viewer;
- no browser can duplicate progression;
- outcome becomes available immediately when authoritative calculation finishes;
- the report uses one canonical DTO;
- missing values are represented accurately;
- the report has headline, story, analysis, and lessons sections;
- a basic 2D viewer shows venue, fans, band entrance, song progression, crowd movement, and finale;
- replay is deterministic;
- skip and speed controls work;
- reduced-motion and text-only modes work;
- mobile performance is acceptable;
- analytics measure engagement;
- players can replay completed gigs;
- no rewards depend on watching;
- no major memory, timer, or subscription leaks remain;
- test coverage exists for progression, DTOs, events, viewer, report, and accessibility.

---

# 22. Recommended Immediate Next PR

The next implementation PR should be:

> **Phase 5 PR 03 — Outcome Report Information Architecture Rebuild**

Phase 5 PR 03 is complete; the next step is to harden server-authoritative timeline/completion semantics before adding viewer rendering work.

The new 2D viewer will only be trustworthy if it is driven by a stable, typed, authoritative gig outcome model.
