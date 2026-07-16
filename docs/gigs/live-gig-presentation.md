# Live gig presentation and audience experience

This phase adds a presentation layer above the server-authoritative live gig timeline. It does not replace live session, segment, song-result, incident, tactical-decision, or completion calculations.

## Existing implementation inspected

- Live lifecycle is documented in `docs/gigs/live-gig-timeline.md`: sessions move through scheduled, preshow, ready, live, paused-for-decision, resolving, completed, cancelled, and failed states.
- Authoritative types and deterministic helpers live in `src/utils/gigLive.ts`.
- `LiveGigTimelineDashboard` already renders session metrics, timeline rows, highlights, incidents, and tactical decisions.
- `TopDownGigViewer` is an older client-heavy viewer with local commentary/audio behaviours; the new presentation layer avoids relying on it for authoritative live facts.
- Completed gig replay lives under `src/features/gig-experience/viewer`, with reduced-motion and canvas conventions suitable for future reuse.
- Completed gig reports use `GigOutcomeReport` and the `GigExperienceDTO` read model, with legacy fallback behaviour for older gigs.

## Architecture

`buildLiveGigPresentationState` consumes persisted live state and maps it to display state:

- current segment and scene;
- current song profile;
- crowd energy, fan satisfaction, stamina, and momentum;
- venue tier and density;
- production plan, lighting state, and active effects;
- performer roles, instruments, stamina, and incident involvement;
- tactical decision state;
- commentary derived from persisted highlights, incidents, and decision metadata.

The output is deterministic and can be rebuilt after refresh, reconnect, app backgrounding, or SSE/polling recovery without replaying old animations.

## Stage layouts and performer positioning

Initial layouts are solo, duo, three-piece, four-piece, five-piece, six-plus, festival stage, and small club. Positioning is role-based: lead vocalists at centre-front, drums rear-centre, bass/guitar near front sides, keys/DJ side or rear, and fallback performers spread across the stage. Existing explicit stage positions take precedence.

## Venue, crowd, lighting, and effects

Venue tiers are small bar, local club, theatre, music hall, large venue, arena, stadium, and festival stage. Crowd density is capped and derived from attendance/capacity, so low-attendance gigs look sparse and sell-outs are dense without one DOM node per fan.

Crowd states map from authoritative crowd energy with attendance and incident overrides. Lighting reflects segment type, song tempo/mood, package labels, crowd intensity, and production incidents. Effects only render from the supplied production plan and are filtered when disabled or when reduced-motion/data-only modes are active.

## Accessibility and performance

The React presentation component provides reduced, minimal, and data-only modes; a screen-reader summary; labelled metric bars; keyboard-accessible decision buttons; no unsafe rapid flashing; bounded crowd elements; and no continuous simulation loop.

## End-of-show and reports

This PR establishes the state mapping needed by a polished completion sequence and immediate summary. The existing completed report remains the authoritative detailed surface and older gigs continue to use existing fallbacks. Future work can persist final presentation snapshots/highlight records if product requirements demand historical share cards.

## Spectator extension points

The presentation state separates view-only display from management controls. Tactical option submission remains controlled by existing permissions and callbacks; future spectator modes can consume the same display state while omitting private crew, health, and finance details.

## Known limitations

- No new database migration is included.
- The first stage view is DOM/CSS based rather than WebGL or a game engine.
- Highlight persistence and venue/band history records are foundations only; automatic public sharing is intentionally out of scope.
- Older `TopDownGigViewer` remains available until the live route is fully migrated to the server timeline dashboard.

## Festival performance-session integration

Festival live views now consume canonical `festival_performance_sessions` state, including immutable setlist snapshots, current song position, checked-in performers, equipment readiness and safe incident state. The viewer remains a presentation layer; lifecycle mutations happen through festival session RPCs.
