# Phase 5 PR 09 — Song Timeline, Crowd Energy, Commentary, Highlights and Finale

## Recommendation source

This implements the PR 08 follow-up: connect the stored replay event stream to a factual performance story without changing authoritative calculations, rewards, progression, song scores, migrations, or replay generation.

## Audited event contract

The browser consumes canonical `song_start`, `crowd_reaction`, `spotlight`, `moment_effect`, `encore_decided`, `finale_started`, `band_exit`, and `result_reveal` events. `song_start` supplies song id/title/position/montage, `crowd_reaction` supplies reaction/intensity/zones plus stored before/after energy on the event, `moment_effect` supplies effect/target/intensity, and `result_reveal` supplies rating/attendance/profit/verdict key. Current replay facts do not yet contain deep performer solo labels, equipment-specific incident detail, or separate encore-song mutations, so PR 09 presents only supported baseline highlights.

## Song lifecycle

`StoryEngine` derives `waiting`, `intro`, `performing`, `peak`, `ending`, `between_songs`, and `completed` from canonical song-start offsets and following song/finale/result offsets. Each segment exposes title, setlist position, score from `GigExperienceDTO`, energy before/after, opener/finale/best/weakest/turning-point flags, next title once known, and seek offset.

## Current-song UI

`GigCurrentSongPanel` adds a semantic current-song panel with title fallback, song position, phase, crowd energy/mood, elapsed/remaining time, badges, latest important commentary, and next-song text that does not expose unavailable future data beyond the canonical reached segment.

## Crowd-energy mapping

`StoryEngine` centralizes the 0–100 mapping: disappointed, quiet, attentive, engaged, energetic, ecstatic. Values are clamped; missing values fall back to neutral 50; interpolation is presentation-only; reduced motion snaps to event-boundary values.

## Crowd reactions

The Canvas now maps canonical reaction events and current energy to restrained still/sway/bounce/jump/wave/cheer-pulse/disappointed-settling/disperse behaviour. Zone amplitude is deterministic: front reacts strongest, middle moderately, rear/seated-style areas lower. Attendance density alone does not create high-energy motion.

## Crowd graph

`GigCrowdMoodGraph` renders a lightweight SVG line with one point per song, current marker, best/weakest/finale/turning-point styling, keyboard/touch/click seek targets, and a textual alternative list.

## Commentary system

`StoryEngine.formatCommentary` is the centralized formatter. It uses message keys/params and event types only, avoids unsupported claims, suppresses duplicate adjacent messages, assigns announcement only to important/critical events, and keeps ambient events in the expanded event log rather than prominent feed.

## Highlight model

Highlights are created only from non-ambient canonical highlight/finale/encore events. Each highlight includes title, description, importance, related song/performer when present, crowd-energy delta, replay offset, and visual-effect label.

## Performer focus

Performer focus continues to use valid `performerProfileId` and movement events. PR 09 also lets story highlights keep the existing static focus-ring behaviour alive during highlight windows; missing performers remain general band/song highlights.

## Mistake/recovery handling

No fabricated mistake or recovery is added. If future canonical message keys/events identify mistakes, equipment issues, or recovery, the formatter and highlight model can surface them without gameplay mutation.

## Turning-point rule

The viewer identifies at most one turning point: the largest positive song-level crowd-energy delta of at least +8. If all changes are flat or below threshold, no turning point is shown.

## Encore

Encore presentation uses the stored `encore_decided` event and its message key. Requested and declined states get understandable commentary and crowd movement without deriving a new decision, adding songs, changing rewards, or mutating the setlist.

## Finale

The final phase is derived from `finale_started`. Canvas emphasis is modest; limited confetti appears only when the finale is active, reduced motion is off, and canonical presentation energy is ecstatic.

## Result reveal

`GigResultRevealOverlay` appears only after the stored result-reveal offset. It reads authoritative `GigExperienceDTO` metrics and provides View Full Report, Replay Again, and Close Viewer actions.

## Controls

Controls now include previous song, next song, next highlight, and skip to result. They seek the local replay clock only and preserve speed/reduced-motion preferences.

## Seeking

Story state is reconstructed from replay offset each render: current song/phase, crowd energy/mood/reaction, highlight, focus, encore, finale, and result visibility. Forward/backward seeking and graph/skip actions are deterministic.

## Accessibility

Current-song panel, timeline, graph, performer list, controls, commentary announcements, and result overlay are semantic DOM companions to Canvas. Reduced motion preserves all story information while disabling continuous crowd/performer motion.

## Performance

Song segments, highlights, graph data, and snapshots are memoized from replay/position. The graph and commentary do not update per crowd entity, no extra Supabase queries are added, and Canvas reactions remain bounded by the existing crowd cap.

## Files changed

- `src/features/gig-experience/viewer/engine/StoryEngine.ts`
- `src/features/gig-experience/viewer/GigViewerShell.tsx`
- `src/features/gig-experience/viewer/GigViewerControls.tsx`
- `src/features/gig-experience/viewer/GigViewerTimeline.tsx`
- `src/features/gig-experience/viewer/GigCurrentSongPanel.tsx`
- `src/features/gig-experience/viewer/GigCrowdMoodGraph.tsx`
- `src/features/gig-experience/viewer/GigResultRevealOverlay.tsx`
- `src/features/gig-experience/viewer/engine/CanvasRenderer.ts`
- `src/features/gig-experience/viewer/tests/storyEngine.test.ts`

## Tests

Added `storyEngine.test.ts` for lifecycle phases, missing/neutral energy handling, energy thresholds, interpolation, rising/falling reactions, highlights, result reveal, and no-forced-turning-point cases.

## Known limitations

Canonical replay generation still derives baseline song reactions and encore decisions server-side from existing inputs. The current stored contract does not include detailed equipment-issue, mistake, recovery, singalong, or performer-solo facts, so the viewer does not invent them. Analytics hooks were not present in this feature folder, so PR 09 does not add a new analytics system.

## Recommended Phase 5 PR 10

Add configured analytics instrumentation if/when the app-level analytics API is identified, broaden canonical replay generation to include explicit mistake/recovery/equipment/singalong event categories, and add browser smoke/a11y coverage for mobile replay controls.
