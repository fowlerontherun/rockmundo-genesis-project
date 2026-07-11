# Phase 5 PR 07 — Animated Crowd Entry and Venue Filling

## Recommendation source

This implements the Phase 5 PR 06 follow-up for fan-entry staging on top of the stored replay viewer. It remains read-only and uses existing `venue_open`, `crowd_fill`, and song/result events only.

## Previous static crowd model

PR 06 rendered deterministic static dots directly from attendance, capacity, preset, viewport class, and replay seed. It did not model entering, settling, waiting, milestones, or exact represented-attendee sums.

## Crowd lifecycle

The presentation-only lifecycle is `queued`, `entering`, `moving_to_zone`, `settling`, and `waiting`. `leaving` is deliberately reserved for a later PR. Entities keep client-only id, seed index, weight, entrance id, zone id, spawn offset, speed/travel duration, radius, idle phase, visibility, current position, waypoint, and target.

## Weighted-entity model

The viewer renders at most the selected cap and distributes integer represented-attendee weights so the sum equals authoritative attendance exactly. Zero attendance returns zero entities. When attendance exceeds the cap, base weights are assigned first and deterministic remainder weights are added to the final entities; this avoids ceiling-based overstatement.

## Caps

Caps are centralized in `CrowdLifecycle`: reduced motion 40, mobile-low 60, mobile-default 100, tablet 140, desktop 200, and optional high-performance desktop 300. Width, reduced motion, device pixel ratio, and attendance ratio choose the cap; large screens do not automatically choose the highest cap.

## Entrances

Entities are deterministically assigned across scaled preset entrances. Spawn points are jittered inside bounded entrance/audience limits so queues do not stack on one pixel. Missing entrance data falls back to the rear-centre audience edge. No physics or backstage pathfinding was added.

## Zones and fill order

Audience zones are split into front/middle-style centre/side sub-zones. Low attendance uses front clusters first, medium attendance opens more middle positions, and sold-out/high-ratio plans use all available preset zones. Targets are generated inside audience bounds and away from the stage rectangle.

## Spawn timing

Entry starts at the canonical `venue_open` offset and is spread through the `crowd_fill` phase, ending no later than the first `song_start` when present. Spawn offsets are deterministic and batched by entity order. Playback speed affects the replay offset through the existing clock; the crowd projection consumes offset only.

## Movement

Movement is a cheap two-segment interpolation from entrance to waypoint to target with bounded travel duration variation. Settled entities use only tiny deterministic waiting sway when reduced motion is off.

## Seeking/reconstruction

Crowd state is reconstructed from replay offset, seed, viewport size, capacity, attendance, and reduced-motion flag. No frame history is required, so forward seek, backward seek, restart, resize, and first-song jumps produce deterministic entity states without duplicates.

## Reduced-motion behaviour

Reduced motion disables walking interpolation and idle sway. Visible entities appear directly at deterministic target positions according to spawn/fill progress, while text milestones, attendance, phase, and occupied-zone summaries remain available.

## Accessibility

The status panel now includes attendance, capacity, attendance percentage, current crowd phase, fill percentage, and occupied zones. Milestone text is factual and derived from fill progress; no unsupported sold-out claim is emitted unless attendance/capacity data can support it in future copy.

## Performance approach

The renderer still owns the single Canvas draw path. Layout/plans are rebuilt on resize or replay/reduced-motion changes, not per entity per React state update. Per-frame projection is pure and bounded by the cap. Development-only diagnostics show entity, moving, settled, and frame-duration information on the Canvas.

## Files changed

- `src/features/gig-experience/viewer/engine/CrowdLifecycle.ts`
- `src/features/gig-experience/viewer/engine/CanvasRenderer.ts`
- `src/features/gig-experience/viewer/engine/EntityLayout.ts`
- `src/features/gig-experience/viewer/engine/VenueLayout.ts`
- `src/features/gig-experience/viewer/GigViewerStatus.tsx`
- `src/features/gig-experience/viewer/GigViewerShell.tsx`
- `src/features/gig-experience/viewer/tests/engine.test.ts`
- `docs/gigs/LIVE_GIG_IMPLEMENTATION_ROADMAP.md`
- `docs/gigs/LIVE_GIG_EXPERIENCE_PLAN.md`
- `docs/gigs/LIVE_GIG_SYSTEM_AUDIT.md`

## Tests

Added viewer-engine coverage for exact represented weights, zero/odd/large attendance, cap selection, deterministic entrance distribution, target bounds, low-attendance clustering, sold-out zone expansion, spawn/movement/settling reconstruction, repeated seek determinism, and reduced-motion static projection.

## Known limitations

Crowd movement uses practical waypoints rather than full walkable-area pathfinding. No collision physics, band entrance, performer roaming, song reactions, crowd waves, audio, spectator mode, or replay schema migration is included.

## Recommended Phase 5 PR 08

Implement band entrance and stage-position polish as a separate read-only presentation layer, keeping performer choreography distinct from crowd filling and preserving deterministic seek reconstruction.
