# Live Gig Experience Plan

This plan defines the future lightweight Football Manager-style gig experience. It is documentation only: no viewer implementation, migration, balance change, or new dependency is introduced in Phase 5 PR 01.

## Goals

- Tell the story of a gig with simple 2D shapes, concise commentary, and a clear post-gig hierarchy.
- Keep rewards and outcomes server-authoritative.
- Make the viewer deterministic, reconnectable, seekable, replayable, and safe across tabs.
- Replace the fixed ten-minute report delay with result availability based on authoritative completion.
- Avoid 3D, game engines, heavy particles, or client-side reward recalculation.

## Post-gig information hierarchy

### Level 1 — Immediate result

Displayed as soon as the authoritative outcome is ready.

Must include:

- large grade/rating;
- one-sentence verdict;
- attendance and capacity;
- net profit;
- fans/fame gained;
- best-performing song;
- biggest positive or negative moment;
- `Continue` button;
- `View full analysis` button.

Existing cards to merge into this level:

- Overall Performance;
- the useful headline parts of Enhanced Metrics;
- net profit from Financial Deep Dive;
- fame/fans from Impact/Fan Growth/Member Rewards;
- best song from Setlist Performance;
- one canonical Moment Highlight.

### Level 2 — Performance story

Explains what happened:

- timeline by phase;
- setlist in performance order;
- song scores and crowd response changes;
- highlight moments;
- band-member moments when canonical data exists;
- encore/finale;
- turning point.

Existing cards to retain here with changes:

- Setlist Performance, simplified by default;
- Crowd Analytics, converted into momentum/story language;
- Moment Highlights, backed by canonical event data;
- selected performer/member moments when server-authored.

### Level 3 — Detailed analysis

Optional collapsible detail:

- full financial breakdown;
- equipment impact;
- crew impact;
- skill contribution;
- chemistry;
- venue relationship;
- detailed fan conversion;
- XP/rewards;
- technical modifiers;
- legacy warnings.

Existing cards to move/collapse:

- Financial Deep Dive;
- Gear Bonuses Applied;
- Band Chemistry;
- Venue Relationship;
- XP Rewards;
- Member Rewards;
- Performance Factors;
- Stage Behavior Used.

Existing cards to remove or replace:

- Impact summary as a separate card, because it duplicates fame, chemistry, and merch;
- client-derived Band Member Performance unless backed by performer outcome data;
- zero-merch warning unless inventory data proves the cause.

## Recommended 2D visual approach

Use HTML Canvas for the first full viewer implementation, with a DOM event log and controls beside or below it.

Rationale:

- Canvas handles hundreds of simple circles better than large DOM/SVG trees on mobile.
- The current app already uses React UI components for shell/controls and does not need a game engine.
- Authoritative outcome data can remain separate from cosmetic interpolation.
- Canvas can be paired with a reduced-motion DOM-only mode.

SVG/DOM remains acceptable for PR 04 if prototype profiling shows entity counts below budget, but the safe default is Canvas.

## Venue layer

Represent venues with simple geometry:

- entrance/doors;
- audience area;
- stage rectangle;
- backstage entrance;
- barriers/rail;
- optional seating zones;
- capacity-scaled dimensions;
- label overlays for venue name, attendance, and current phase.

### Venue presets

| Preset | Capacity guide | Layout |
|---|---:|---|
| Tiny club | 0-150 | Narrow room, small stage, one entrance, dense standing floor. |
| Small venue | 151-750 | Wider standing floor, stage rail, optional side bar/door. |
| Theatre | 751-2,500 | Stage plus seated blocks/aisles. |
| Arena | 2,501-20,000 | Large floor, tier rings represented as bands, multiple entrances. |
| Stadium | 20,001+ | Aggregated crowd blocks, very low entity density, large stage. |
| Festival stage | Any large outdoor venue | Wide stage, open field, multiple crowd zones. |

First implementation may ship only small, medium, and large presets. Venue type and capacity choose the preset; attendance percentage determines fill; band size adjusts stage spacing.

## Crowd aggregation rules

Do not render one entity per attendee.

Recommended caps:

| Device/performance mode | Visual fan cap |
|---|---:|
| Reduced motion | 0-50 static dots or density blocks |
| Mobile low-performance | 80 |
| Mobile default | 150 |
| Desktop default | 300 |
| Desktop high | 500 |

Each visual fan has `represents_attendees = ceil(actual_attendance / visualFanCount)`. Preserve perceived scale by changing density, crowd blocks, labels, and tier fill, not by unlimited entities.

Fan states:

- arriving;
- waiting;
- attentive;
- warming;
- engaged;
- energetic;
- ecstatic;
- disappointed;
- leaving.

Inputs may include current song score, previous momentum, attendance density, band fame, venue fit, chemistry, equipment incidents, and canonical highlights. Crowd animation never feeds back into rewards.

## Band entities and stage positions

Band members are now rendered as larger Canvas counters with initials and short role labels, backed by a presentation-only performer lifecycle. The viewer uses authoritative replay performer data and `gig_performers` experience data when available, normalizes role/instrument strings centrally, stages performers backstage, animates deterministic entrance/exit paths, applies bounded idle movement, and exposes a semantic performer companion list. It does not infer absent performers from current band membership.

Predictable positions:

| Role | Position rule | Movement |
|---|---|---|
| Vocalist/frontperson | Front centre | Largest roaming zone. |
| Lead guitar | Front left/right | Medium roaming, solos step forward. |
| Rhythm guitar | Opposite side | Medium roaming. |
| Bass | Front/mid opposite rhythm | Medium-low roaming. |
| Drums | Rear centre | Mostly fixed. |
| Keyboard | Rear/side | Low roaming. |
| DJ/electronic | Rear/centre table | Low roaming. |
| Backing vocals | Rear/side mic spots | Small zones. |
| Other/unknown | Evenly spaced fallback slots | Conservative movement. |

Large bands should use rings/rows and avoid overlap. Unknown roles should never break the layout.

## Visual effects

Keep effects simple and sparse:

- pulse;
- scale;
- ring;
- short trail;
- spotlight cone;
- colour/intensity change;
- crowd wave;
- floating commentary label;
- confetti only for exceptional finale.

Avoid heavy particles, physics, shaders, 3D, or external game engines.

## Canonical gig phase model

Default normal viewer duration should be configurable, initially 2-4 minutes. Fast mode target is about one minute. Skip-to-result should be immediate once outcome exists.

| Phase | Trigger | Default duration | Visual behaviour | Required data | Commentary | Skippable | Reconnect/accessibility |
|---|---|---:|---|---|---|---|---|
| `venue_opening` | viewer starts or replay begins | 5s | Empty room, doors/lights on | venue, capacity | Doors open | yes | Log entry with timestamp. |
| `crowd_entry` | after opening | 15-30s | Fan dots enter and fill zones | attendance, capacity | Room starts to fill | yes | Seek from offset. |
| `pre_show` | crowd settled | 5-10s | Waiting crowd, stage lights | band/venue | Anticipation line | yes | Reduced-motion static state. |
| `band_entrance` | pre-show ends | 8-12s | Band enters backstage path | performers/roles | Band walks on | yes | Text list of members. |
| `song_intro` | each song starts | 3-5s | Highlight song title, members ready | setlist song | Opening riff line | yes | Announce song. |
| `song_performance` | after intro | 15-35s per song | Movement, crowd energy | song score, response | 1-3 factual lines | skip to next | Derive exact offset from event sequence. |
| `between_songs` | song ends | 3-8s | Applause/reset | score/response | Applause/banter if supported | yes | Event log line. |
| `highlight_moment` | scheduled event | 4-8s | Ring/effect/label | canonical moment | Positive/negative highlight | yes | Important status update. |
| `encore_decision` | after main set | 5-8s | Crowd chant or quiet | rating/crowd | Encore requested/declined | yes | Text equivalent. |
| `finale` | final song/encore | 10-20s | Peak energy/end effects | final rating | Finale line | yes | No flashing. |
| `band_exit` | after finale | 5-8s | Band leaves, crowd disperses | performers | Band exits | yes | Text summary. |
| `result_reveal` | authoritative outcome exists | immediate | Headline result card | report summary | Verdict | no need | Always accessible. |
| `completed` | result acknowledged | indefinite | Replay/report options | outcome id | None | replay | Versioned replay fallback. |

## Canonical event contract

Design TypeScript shape for PR 02/04 discussion:

```ts
export type GigViewerPhase =
  | 'venue_opening'
  | 'crowd_entry'
  | 'pre_show'
  | 'band_entrance'
  | 'song_intro'
  | 'song_performance'
  | 'between_songs'
  | 'highlight_moment'
  | 'encore_decision'
  | 'finale'
  | 'band_exit'
  | 'result_reveal'
  | 'completed';

export interface GigViewerEvent {
  id: string;
  gig_id: string;
  sequence: number;
  phase: GigViewerPhase;
  event_type:
    | 'doors_open'
    | 'fans_enter'
    | 'capacity_milestone'
    | 'band_enters'
    | 'member_takes_position'
    | 'song_starts'
    | 'crowd_warms'
    | 'crowd_surges'
    | 'crowd_drops'
    | 'performer_highlight'
    | 'performer_mistake'
    | 'equipment_issue'
    | 'recovery'
    | 'singalong'
    | 'encore_requested'
    | 'encore_performed'
    | 'finale'
    | 'band_exits'
    | 'result_ready';
  scheduled_offset_ms: number;
  duration_ms: number;
  song_id?: string | null;
  performer_profile_id?: string | null;
  crowd_energy_before?: number | null;
  crowd_energy_after?: number | null;
  importance: 'ambient' | 'normal' | 'important' | 'critical';
  title: string;
  description: string;
  visual_payload: Record<string, unknown>;
  created_at: string;
}
```

### Storage recommendation

Use a hybrid model:

1. Store authoritative outcome, `viewer_version`, `simulation_seed`, `result_ready_at`, and a canonical event payload JSON on the outcome or a related summary row.
2. Later add a normalized event table only if querying individual events becomes necessary for analytics, moderation, public spectators, or very large payloads.

This is safer than deriving events differently on each client and lighter than introducing a table before the final event shape stabilizes.

Requirements:

- generated once by server/edge code;
- deterministic from outcome data plus seed;
- versioned;
- replayable after completion;
- independent of frame rate;
- seekable by `scheduled_offset_ms`;
- safe if multiple tabs are open;
- never client-authoritative for rewards.

## Authority boundaries

### Server-authoritative

- gig start;
- gig completion;
- attendance;
- song performance scores;
- rewards;
- profit;
- fans;
- fame;
- chemistry;
- member progression;
- significant moments;
- canonical event sequence or seed;
- report summary DTO.

### Client presentation

- interpolation;
- cosmetic movement;
- crowd positioning;
- animation timing;
- camera/zoom;
- visual effects;
- speed;
- pause;
- sound settings;
- reduced-motion presentation.

Watching, skipping, pausing, replaying, closing, or opening multiple tabs must never alter rewards.

## Reconnect, replay, and skipping

| Scenario | Future behaviour |
|---|---|
| Browser closes | Server continues/finishes. Return uses stored outcome/events and viewer offset. |
| Return during gig | Load current canonical phase from server time/result state; allow watch live or skip. |
| Return after gig | Show immediate result if outcome exists; allow replay. |
| Network interruption | Pause local playback, retry event/outcome fetch, resume by offset. |
| Duplicate tabs | Tabs are read-only viewers. Server idempotency prevents duplicate completion/events. |
| Late arrival | Start at current phase with option to rewind replayable events if permitted. |
| Gig already complete | Show headline result first, with replay/full analysis options. |
| Viewer version changes | Use stored `viewer_version`; if unsupported, show textual timeline and report. |

Controls:

- Play/Pause;
- 1x, 2x, 4x/Fast;
- Skip to next song;
- Skip to highlights;
- Skip to result;
- Replay completed gig;
- Mute visual/audio cues if audio is added later.

Replace the fixed ten-minute report delay with:

- result available when authoritative completion is ready;
- viewer may continue cosmetically;
- skip-to-result always available once outcome exists.

## Commentary and storytelling

Tone should be concise and factual:

- “The room starts to fill.”
- “The front rows recognise the opening riff.”
- “The crowd loses interest during the breakdown.”
- “A huge chorus pulls the room back in.”
- “The audience demands one more song.”

Rules:

- 1 ambient line per phase maximum unless player opens full log;
- 1-2 lines per song at normal importance;
- critical moments always logged;
- no unsupported claims about pyrotechnics, proposals, stockouts, camera crews, or injuries;
- duplicate prevention by event type/song/performer;
- localisation-ready message keys in future;
- textual event log is the accessibility equivalent.

## Performance and accessibility budgets

- Target 60fps desktop, acceptable 30fps mobile.
- Mobile default cap: 150 visual fans.
- Desktop default cap: 300 visual fans.
- Hard cap: 500 visual fans until profiling proves more is safe.
- Pause expensive animation when tab hidden; advance logical playback by timestamps on return.
- Cleanup `requestAnimationFrame`, timers, audio, and subscriptions on unmount.
- Low-performance mode should reduce fan count, disable trails/confetti, and lower frame work.
- Reduced-motion mode should use static positions, gentle opacity changes, and text timeline.

Accessibility:

- textual event log equivalent;
- pause controls;
- keyboard controls;
- reduced motion;
- colour-independent state labels;
- screen-reader status summaries for phase/song/result;
- no flashing effects;
- no required audio;
- result accessible without watching animation.

## Analytics and engagement measurement

Use existing analytics/event infrastructure only. Do not add a platform.

Recommended event names:

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
- `report_section_opened`.

Success measures:

- percentage opening viewer;
- percentage watching at least one song;
- median viewing time;
- skip-to-result rate;
- replay rate;
- outcome report completion;
- return to gig history.

## Data migration assessment for later PRs

| Addition | Classification | Reason |
|---|---|---|
| `viewer_version` | Required | Version renderer/event contracts. |
| `simulation_seed` | Required | Deterministic cosmetic playback. |
| canonical event payload JSON | Required | Reconnectable/replayable timeline without premature table design. |
| `result_ready_at` | Required | Replace arbitrary ten-minute delay. |
| structured report summary | Required | Stable Level 1 DTO and hierarchy. |
| event sequence table | Useful/deferred | Needed only if JSON payload becomes too large or independently queried. |
| `viewer_started_at` | Useful | Engagement analytics, not outcome authority. |
| `viewer_completed_at` | Useful | Engagement analytics, not outcome authority. |
| replay availability flag | Deferred | Product decision. |
| public spectator ACL fields | Deferred | Product decision. |
| client-written reward fields | Not recommended | Violates authority boundary. |

## Proposed component architecture

```text
src/features/gig-experience/
  components/
    GigExperienceShell.tsx
    GigTimeline.tsx
    GigControls.tsx
    GigHeadlineResult.tsx
    GigDetailedReport.tsx
  viewer/
    GigCanvas.tsx
    VenueRenderer.ts
    CrowdRenderer.ts
    PerformerRenderer.ts
    EffectRenderer.ts
    camera.ts
  simulation/
    eventTypes.ts
    eventPlayer.ts
    deterministicRandom.ts
    crowdState.ts
    stagePositions.ts
  hooks/
    useGigExperience.ts
    useGigEventPlayback.ts
  services/
    gigExperienceService.ts
  tests/
```

Use feature-folder boundaries for the rebuild and keep the existing report/viewer operational until replacement is ready.

## Testing strategy

Cover:

- deterministic event generation;
- same seed creates same sequence;
- different frame rates do not change result;
- reconnect resumes correct point;
- skip produces no reward differences;
- multiple tabs do not duplicate completion;
- crowd entity caps;
- stage placement;
- unknown roles;
- large bands;
- zero/low attendance;
- sold-out venue;
- cancelled gig;
- failed/poor performance;
- excellent performance;
- missing song data;
- missing profile/avatar;
- reduced motion;
- mobile layout;
- report hierarchy;
- result available immediately when authoritative outcome exists.

## Product decisions

| Decision | Status | Safe default |
|---|---|---|
| Canvas versus SVG/DOM | Required before PR 04 | Canvas with DOM log. |
| Expected viewer duration | Required before PR 04 | 2-4 minutes normal; ~1 minute fast. |
| Speed options | Safe default available | 1x, 2x, 4x. |
| Pause support | Safe default available | Support pause for accessibility. |
| Replay availability duration | Deferred | Members can replay indefinitely for now. |
| Venue layouts public? | Deferred | Use generic layouts only. |
| Maximum visual fan entities | Safe default available | 300 desktop, 150 mobile, 500 hard cap. |
| Outcome immediately skippable? | Required before PR 02 | Yes once outcome exists. |
| Commentary textual only? | Safe default available | Textual first; audio deferred. |
| Future audio planned? | Deferred | No required audio. |
| Public spectators for other bands? | Deferred | Not in first implementation. |
| Non-member replay of completed gigs? | Deferred | No until ACL defined. |
| Hide setlist surprises until performed? | Required before PR 04 | Preserve hidden future songs if product wants surprise; otherwise show band-owned setlist. |

## Phase 5 PR 04 implemented model update

The live viewer plan should assume that browser sessions do not advance songs or complete gigs. Viewer surfaces read canonical gig status, current song position, song-performance rows, and `result_ready_at`. “Skip” actions are presentation-only until the server exposes a ready result.


## Phase 5 PR 05 update

Implemented event contract: viewer version 1/event schema version 1 stores typed replay events in `gig_viewer_replays`, using message keys/params plus discriminated visual payloads rather than final English commentary.

## Phase 5 PR 06 implemented viewer facts

The initial 2D viewer is now a read-only HTML Canvas shell backed by stored `gig_viewer_replays`. It does not regenerate events in the browser. The completed gig page lazy-loads the full replay payload only after the player chooses Replay Gig, while the outcome report remains available independently. The Canvas uses normalized small/medium/large venue presets, deterministic seed-based crowd/performer layout, local playback controls, an accessible synchronized text timeline, and reduced-motion mode.

## Phase 5 PR 07 implemented crowd-entry facts

Crowd entry is now implemented as a read-only presentation layer. Weighted visual entities exactly sum to authoritative attendance while respecting centralized device/reduced-motion caps. Entities are deterministically assigned to venue entrances and prioritized audience sub-zones so low attendance clusters near the front and higher attendance fills more of the room. Replay offset reconstructs queued, entering, moving, settling, and waiting states without frame history; reduced motion uses static target-position updates and preserves text milestones.


## Phase 5 PR 09 implemented story-layer facts

The replay viewer now has a factual song-story layer. `StoryEngine` derives song lifecycle phases, crowd-energy mood labels, one deterministic turning point, highlights, encore/finale/result states, and commentary from canonical replay events plus `GigExperienceDTO` metrics. The UI includes a current-song panel, SVG crowd mood graph with seekable points, expanded song timeline, song/highlight/result skip controls, Canvas crowd reactions, and result reveal overlay. No browser-side outcome, reward, setlist, or replay-fact mutation was introduced.
