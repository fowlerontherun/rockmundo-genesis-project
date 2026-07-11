# Phase 5 PR 06 — Replay Viewer Shell, Canvas Foundation and Read-Only Playback

## Recommendation source

This PR implements the Phase 5 PR 05 recommendation to build the read-only viewer/reconnect path on top of the canonical replay descriptor and payload without changing stored events, outcomes, rewards, progression, or replay generation.

## Integration strategy

The selected integration surface is the completed gig card on `PerformGig`. The report stays the primary authoritative result surface, while the replay opens only after the player clicks **Replay Gig**. This preserves lazy full-payload loading through `useGigViewerReplay` and avoids blocking the report path. Current in-progress gigs continue to use the existing live `TopDownGigViewer` unless a stored replay is explicitly available later.

## Component architecture

The viewer is split under `src/features/gig-experience/viewer/` into a shell, Canvas component, controls, synchronized timeline, status panel, fallback states, and an error boundary. Engine code is isolated in `viewer/engine/` for playback, venue layout, deterministic entity layout, Canvas rendering, viewport helpers, and reduced-motion preferences. React hooks stay in `viewer/hooks/`.

## Viewer states

The shell handles loading, ready, generating, unavailable/legacy, failed, unsupported version, malformed replay, access denied, network error, cancelled gig, completed replay, and empty event sequence fallbacks. Each fallback keeps **View Report** and **Close Viewer** available, and retry is shown where refetching can help.

## Canvas architecture

`GigCanvas` owns the Canvas element and delegates drawing to `CanvasRenderer`. The renderer has no Supabase access, no mutation calls, and no React state updates per frame. It supports responsive sizing, device-pixel-ratio scaling, cleanup on unmount, simple venue/stage/audience/backstage/barrier rendering, static crowd dots, performer counters, phase/song overlays, and foundational highlight/result effects.

## Venue presets

Three normalized presets are implemented: small, medium, and large. Preset selection uses venue capacity with safe fallback to medium for missing, zero, or unusual values. Geometry is normalized in the preset definitions and scaled to the current viewport.

## Deterministic entity layout

Crowd and performer positions derive from the stored replay `simulationSeed`, selected preset, and viewport class. The layout avoids `Math.random`, keeps crowd entities inside crowd zones, keeps performers on stage, supports missing roles, and spreads large bands to avoid catastrophic overlap.

## Playback controller

The read-only playback controller uses replay event offsets, replay duration, a monotonic local clock, and fixed speeds of 1×, 2×, and Fast/4×. Play, pause, seek, previous/next event, restart, speed changes, completion, and browser clock jumps are handled without modifying canonical offsets or server state.

## Event activation

Playback derives active phase, active event, current song, crowd energy, performer focus, next event, completed events, and completion status from immutable replay events. Simultaneous offsets are ordered deterministically by stored sequence.

## Payload support

The initial Canvas foundation supports venue opening, crowd fill through static density, performer entrance/move state, song-start overlays, crowd-reaction intensity, spotlight/moment effects, band exit visibility intent, result reveal, and safe degradation for unknown future supported events via the text timeline.

## Timeline accessibility

A semantic ordered list mirrors the replay event sequence. The current item uses `aria-current`, events are keyboard-focusable buttons, selecting an event seeks playback, labels include phase/time/status/importance, and the Canvas has a DOM companion description.

## Controls

Controls include Play/Pause, Restart, Previous Event, Next Event, 1×, 2×, Fast, View Result, Close Viewer, and a reduced-motion toggle. Buttons expose pressed/selected state where applicable and remain outside the Canvas.

## Reduced motion

Reduced motion defaults from `prefers-reduced-motion` and can be overridden in local storage. The renderer disables continuous pulse/interpolation while preserving event stepping, playback controls, timeline, current-status text, and result access.

## Responsive design

The viewer uses a responsive Canvas with a two-column desktop layout and a stacked mobile layout. Entity caps reduce on smaller screens and in reduced-motion mode, and the Canvas height is derived from available width rather than a fixed 500px value.

## Performance approach

The implementation caps visual entities, keeps drawing in a single Canvas renderer, memoizes deterministic layout at renderer resize, avoids full replay loading until the viewer is opened, keeps DOM updates tied to playback state rather than database polling, pauses on hidden tabs, and cleans up resize/animation resources.

## Security and privacy

The frontend viewer only reads replay rows through the existing hook and RLS-protected service. It does not call service-role functions, mutate gigs, process songs, complete gigs, update replay rows, expose hidden skills/health/energy, or broaden replay visibility.

## Files changed

- `src/features/gig-experience/viewer/` — new replay viewer shell, Canvas, controls, timeline, status, fallback, and error boundary.
- `src/features/gig-experience/viewer/engine/` — playback, clock, venue presets, deterministic layout, viewport helpers, renderer, and reduced-motion utilities.
- `src/features/gig-experience/viewer/hooks/` — playback, Canvas sizing, and preference hooks.
- `src/pages/PerformGig.tsx` — completed gigs now lazy-open the stored replay shell and keep report access.
- `src/features/gig-experience/viewer/tests/engine.test.ts` — engine coverage for presets, deterministic layout, and playback.

## Tests

Automated coverage was added for venue preset selection and geometry, deterministic crowd/performer layout, bounded entities, unknown/large performer groups, playback activation, speed changes, restart, pause, and clock-jump handling.

## Known limitations

This PR intentionally does not implement detailed fan entry paths, roaming choreography, song-specific crowd waves, advanced lighting/particles, audio sync, public spectator mode, 3D, or a game/physics engine. Gig history entry points beyond the completed gig page remain a recommended follow-up.

## Recommended Phase 5 PR 07

Add richer read-only presentation on top of the same canonical replay: fan-entry staging, performer movement polish, song-specific crowd reactions, highlight/finale effects, gig-history replay entry points, and expanded component/accessibility smoke coverage.
