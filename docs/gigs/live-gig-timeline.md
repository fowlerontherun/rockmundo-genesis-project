# Live gig timeline and tactical decisions

Phase 6 adds the first server-driven live performance foundation. A scheduled gig can create one `gig_live_sessions` row, persist a deterministic `gig_live_segments` timeline, resolve songs into `gig_live_song_results`, persist incidents and tactical decisions, and finalize a result from the resolved timeline rather than rerolling a separate whole-gig simulation.

## Architecture inspected

The implementation builds on the existing gig preparation stack:

- Scheduled gigs and historical outcomes already live in `gigs`, `gig_performances`, and `gig_outcomes`.
- Setlists are stored in `gig_setlists` and ordered `gig_setlist_items` with an encore flag.
- Readiness is calculated by `calculateGigReadiness`, including setlist completeness, duration fit, song practice, rehearsal recency, chemistry, health/fatigue, and required performers.
- Crew/equipment preparation exposes `calculateCrewEffectiveness` and `calculateEquipmentReliability`.
- Stage production/soundcheck exposes production quality and `SOUNDCHECK_TYPES` sound benefits.
- Forecasting combines readiness, crew, equipment, production, venue, fan demand, revenue, and pre-show consequences.
- Pre-show incidents already use persisted sessions, incident rows, option rows, idempotent decision commits, deadline expiry, and automatic fallback decisions.
- Existing viewer/replay components establish the UI pattern for low-frequency timeline updates rather than high-frequency action rendering.

## Lifecycle

Live state is intentionally small and server-owned: `scheduled`, `preshow`, `ready_to_start`, `live`, `paused_for_decision`, `resolving`, `completed`, `cancelled`, and `failed`. A session can start only after the scheduled start time, for non-terminal gigs, with no blocking readiness issues and at least one setlist item. The database enforces one live session per gig.

## Session and segment models

`gig_live_sessions` stores current live totals: crowd energy, fan satisfaction, performance quality, band stamina, momentum, incident risk, current segment, simulation version, idempotency keys, final snapshots, and projection snapshots.

`gig_live_segments` stores the immutable generated timeline. Segment types include intro, song, transition, encore break, encore song, outro, incident, decision, and crowd interaction. Segments resolve sequentially and are guarded by `(session_id, segment_index)` uniqueness.

## Timeline generation

The first version generates:

1. Intro.
2. Each normal song from ordered setlist items.
3. Transitions between songs.
4. Encore break before the first encore item.
5. Encore song segments for encore items.
6. Outro.

The generated timeline is deterministic for a start timestamp and setlist. It is inserted only when the session has no segments, so refreshes or duplicate workers do not create a different show.

## Scheduled and catch-up progression

The schema and service helpers support two processing modes:

- Scheduled workers start eligible sessions, resolve due segments, expire decisions, and complete finished sessions.
- Lazy catch-up can safely process overdue segments in order from live page reads, gig status reads, or world tick processing.

`mark_gig_live_segment_resolved` is conditional and idempotent. Decision expiry is also idempotent through one decision per incident.

## Song-resolution formula

`resolveLiveSong` combines song quality, popularity, familiarity/rehearsal, readiness, performer skill, stage presence, band chemistry, health-derived stamina, current momentum, current crowd energy, crew effectiveness, equipment reliability, soundcheck, production, venue acoustics, genre fit, setlist position, pre-show consequences, and deterministic bounded variance. The output includes score, rating, technical score, performance score, audience response, energy/satisfaction/stamina/momentum deltas, highlights, incidents, and an explainable breakdown.

## Crowd energy, fan satisfaction, stamina, and momentum

Crowd energy is 0-100 and changes from audience response, setlist position, decay, incidents, and tactical choices. Fan satisfaction is separate and responds to quality, sound, professionalism, encore value, incidents, and final ending. Band stamina starts from health/fatigue and falls per song based on duration, difficulty, tempo/intensity, and low-intensity tags. Momentum is capped and reflects show flow from song quality, transitions, incidents, and tactical choices.

## Incidents and tactical decisions

The first incident set covers performance mistakes, equipment faults, production cue failures, flat crowd moments, and positive standout moments. Probability considers equipment reliability, crew coverage, production setup risk, stamina, momentum, and pre-show consequences. At most one incident is generated per processed segment by the helper.

Decision types include equipment response, crowd response, and performance/production recovery. Each has a server-owned deadline, a recommended automatic fallback, and capped consequences. Offline defaults prioritize continuing the gig, health, essential equipment, curfew safety, and avoiding catastrophic loss.

## Live setlist changes, encore, and curfew

Only pending song or encore-song segments can be changed. Completed or active segments are immutable. Supported changes are represented in `gig_live_setlist_changes` for skip, swap, replace, move favourite, add/remove encore, and shorten set. Encore requires valid remaining encore songs, crowd demand, satisfaction, stamina, and curfew room.

## Final result, rewards, and finances

`finalizeLiveGig` derives final quality and satisfaction from persisted song results, peak performance, final live state, positive moments, and incident penalties. It emits reward and finance idempotency keys so downstream progression and ledger systems can process exactly once.

## Realtime and UI

`LiveGigTimelineDashboard` renders the authoritative live session, progress, timeline, metrics, recent highlights, incidents, and active tactical decisions. It is compatible with existing SSE/realtime/polling patterns because reconnecting clients only need to fetch persisted session, segment, incident, decision, and result rows.

## Admin and observability

The migration adds indexed session status, due segment, incident deadline, and decision views suitable for admin diagnostics. Admin recovery should trigger overdue processing or mark specific segments resolved through service-role functions without rerolling persisted results.

## Balancing configuration

`DEFAULT_LIVE_GIG_CONFIG` centralizes initial energy/satisfaction/stamina, energy decay, momentum caps, position caps, stamina base, incident probabilities, decision windows, encore thresholds, curfew warning, and tactical modifier caps.

## Known limitations

This PR intentionally does not add a high-frequency renderer, browser-dependent progression, detailed support-act simulation, or advanced delegated permissions UI. The next PR should wire the helpers into the production scheduler and existing gig pages, add database harness tests against a seeded Supabase instance, and connect reward/finance processors to existing ledgers.
