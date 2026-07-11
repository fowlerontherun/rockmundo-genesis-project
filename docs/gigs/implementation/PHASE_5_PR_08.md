# Phase 5 PR 08 — Band Entrance, Stage Positions and Performer Movement

## Recommendation source

This implements the Phase 5 PR 07 follow-up: animate authoritative replay performers as a presentation-only layer on top of the stored read-only Canvas viewer. It uses existing `gig_performers` service data and canonical `performer_enter`, `performer_move`, and `band_exit` replay payloads without changing outcomes, rewards, progression, or database migrations.

## Previous static performer model

PR 06/07 rendered performer counters as static stage dots from role string matching inside `EntityLayout`. The layout had no performer lifecycle, backstage staging, entrance path, exit state, idle movement, movement-event override, or accessible performer companion list.

## Performer lifecycle

The viewer now reconstructs `waiting_backstage`, `entering`, `taking_position`, `performing`, `exiting`, and `hidden` states from replay offset. These values are presentation-only and are never stored in the database.

## Role normalization

`PerformerLifecycle` centralizes role normalization into canonical presentation roles including vocalist, lead/rhythm guitar, bass, drums, keyboard, piano, DJ, electronic, backing vocals, strings, brass, percussion, other, and unknown. Aliases and capitalization differences such as `Lead Guitarist`, `lead_guitar`, and `Guitar - Lead` map safely to one role.

## Stage-slot model

Stage slots are deterministic, scaled by venue preset, and clamped to stage bounds. Solo performers are centred, vocalists prefer front centre, drummers stay rear centre, side instruments balance across front/mid sides, duplicate roles alternate, and unknown/large-band fallbacks distribute performers in bounded rows.

## Backstage staging

Performers start at deterministic backstage queue points outside the audience and away from the active stage when possible. Missing or compact backstage geometry falls back to a safe behind-stage queue derived from the scaled venue preset.

## Entrance paths and timing

The path is backstage → stage entrance → assigned slot. Existing per-performer enter events are honoured; otherwise the band-entrance phase start provides deterministic staggered offsets. The default presentation order is drummer/percussion, keyboard/DJ/electronic, bass/rhythm, guitar/lead guitar, backing/section roles, and vocalist/frontperson. This is only display timing and does not create gameplay facts.

## Movement zones

Each slot receives a bounded movement zone. Vocalists get the largest front-zone roam, guitars get medium front-side roam, bass gets medium-low roam, drums/keys/DJ are minimal, backing vocals stay near microphones, and unknown roles use conservative local zones.

## Idle movement

During performance, counters use subtle deterministic lateral/forward motion from replay time and stored simulation seed. Reduced motion disables idle movement; low-performance mode can reduce the amplitude through the pure reconstruction API.

## Event overrides

Canonical `performer_move` events temporarily override idle movement for valid performer IDs and supported styles (`walk`, `rush`, `step_forward`, `return_to_position`, and `hold`). Targets are clamped inside the stage, unsupported styles are ignored safely, and performers return to their base slot after the event window.

## Exit behaviour

`band_exit` triggers deterministic reverse-order movement from slot → entrance → backstage/hidden. Direct seeks after exit reconstruct hidden performers, and seeking backward restores prior backstage/entrance/performance states.

## Seeking/reconstruction

Performer state is reconstructed from replay, offset, viewport size, venue preset, seed, and reduced/low-performance flags. It has no frame-history dependency, so pause, speed changes, restart, resize, forward seek, and backward seek produce stable positions without duplicate entities.

## Reduced-motion behaviour

Reduced motion switches performers instantly between backstage, stage slot, and hidden at event boundaries. It disables walking interpolation and idle roaming while keeping counters and the accessible performer list visible.

## Accessibility

`GigPerformerPanel` adds a semantic performer list showing display name, role/instrument, current lifecycle status, stage-position description, and current focus when available. Idle movement is not announced, preventing announcement spam.

## Performance approach

Layout and plans are computed on relevant input/resize changes. Per-frame Canvas drawing consumes pure reconstruction output and does not call React setState per performer per frame. There is no physics, collision solver, 3D, audio, trails, or extra performer profile query.

## Files changed

- `src/features/gig-experience/viewer/engine/PerformerLifecycle.ts`
- `src/features/gig-experience/viewer/engine/CanvasRenderer.ts`
- `src/features/gig-experience/viewer/GigPerformerPanel.tsx`
- `src/features/gig-experience/viewer/GigViewerShell.tsx`
- `src/features/gig-experience/events/types.ts`
- `src/features/gig-experience/events/schema.ts`
- `src/features/gig-experience/viewer/tests/performerLifecycle.test.ts`
- `docs/gigs/LIVE_GIG_IMPLEMENTATION_ROADMAP.md`
- `docs/gigs/LIVE_GIG_EXPERIENCE_PLAN.md`
- `docs/gigs/LIVE_GIG_SYSTEM_AUDIT.md`

## Tests

Added viewer-engine tests for role normalization, solo/large/unknown/duplicate-role stage placement, bounded/deterministic slots, entrance lifecycle, movement override, exit hiding, repeated seek determinism, reduced-motion boundary behavior, and movement-zone/idle behavior.

## Known limitations

Movement remains simple and non-choreographed. No song-specific solos, bows, encores, crowd interaction, public spectator mode, audio, 3D, physics, or detailed highlight choreography is included.

## Recommended Phase 5 PR 09

Add factual song timeline/commentary/highlight presentation using canonical events, keeping detailed performer highlights and song-specific choreography separate from this baseline lifecycle layer.
