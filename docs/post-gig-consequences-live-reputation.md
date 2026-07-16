# Post-Gig Consequences and Live Reputation

## Architecture inspected

The implementation builds on the existing completed-gig architecture instead of rerolling performances. The inspected layers were: `gig_outcomes` as the immutable completed result, `gig_song_performances` for song-level scores, `gig_live_sessions` and segment/decision tables for live state, `gig_audience_*` utilities for attendance and participation, `gig_crew_assignments` and `gig_equipment_loadouts` for preparation, existing fan/follower columns on outcomes, band chemistry and XP utilities, equipment degradation helpers, activity/news/social systems, World News/World Pulse style feeds, scheduled database functions, RLS policies, and idempotency patterns based on unique constraints.

## Processing lifecycle

Each gig can have one `gig_post_processing` row. Valid states are `pending`, `processing`, `completed`, `partially_failed`, `retry_required`, and `skipped`. Processing may start only after the gig result is complete and final values such as attendance, finance, audience participation and outcome snapshots are available. Retries reuse the same processing row and upsert the same consequence keys.

Legacy completed gigs remain readable. They are not backfilled automatically; historical reports show `legacy_missing` until an explicit migration or admin job creates processing rows.

## Consequence snapshot

`gig_consequence_snapshots` stores one row per applied consequence with category, target, previous value, delta, new value, status, explanation, source factors and metadata. The shape supports player explanations, admin investigation, balancing, idempotent retries and future historical analytics.

## Live reputation

`band_live_reputation` stores distinct live-act reputation separate from general fame:

- overall score
- performance score
- professionalism score
- crowd connection score
- reliability score
- production score
- live momentum score
- booking demand score
- experience count
- last gig and calculation breakdown

Scoped reputation is stored in `band_live_reputation_scopes` for qualified city, region/country, venue tier, genre, festival circuit or promoter network records. Sparse records should only be created when a gig has enough contextual value to influence future bookings.

## Reputation smoothing

The TypeScript rules use:

```text
expectationAdjustedScore = weighted performance, satisfaction, crowd, sound,
production, setlist completion and attendance versus expectations, minus
incident/curfew/cancellation/ticket-value penalties.

updatedDimension = previousDimension
  + capped((dimensionTarget - previousDimension)
    * experienceWeight
    * contextMultiplier)

experienceWeight = clamp(0.24 / (1 + experienceCount / 8), 0.035, 0.24)
contextMultiplier = venue-capacity multiplier * importance multiplier
```

New bands move faster. Established bands move slowly. Per-gig deltas are capped, so one bad gig rarely destroys a career.

## Fans and followers

Fan conversion uses final attendance minus real-player attendees to avoid double counting. Positive growth is capped to a percentage of eligible audience; negative results reduce engagement more than deleting established fans. Followers have a separate cap and cannot go below zero.

## Relationships, booking demand and offers

Venue trust reacts to attendance fit, professionalism, curfew compliance and incidents. Promoter confidence reacts to demand, reputation and profitability bands without leaking private settlement details. Booking demand blends live-reputation movement, fan delta, sell-through and incident risk. Opportunities are persisted in `gig_booking_opportunities`, deduplicated per source gig/type/context and expire through `expire_gig_booking_opportunities()`.

## Press, fan reviews and comments

`gig_media_reviews` persists structured reviews with deterministic tiers: fan summary, local blog, local press, national press, festival report and industry coverage. Reviews must use stored outcome metrics and performed-song data only. NPC comments remain short, template-based and clearly in-game; real player ratings remain distinguishable from simulated sentiment.

## Media, Twaater and World Pulse

Consequences can feed existing news/social/activity systems only when significance thresholds are met: high attendance, sell-out, major incident, large reputation movement, standout audience participation or strong review eligibility. Minor gigs should not spam global feeds. Daily/weekly World Pulse aggregation should use completed timestamps and consequence keys to avoid double counting.

## Progression and wellness

Performer progression is based on actual song participation, standouts and bounded mistake penalties. Crew progression is based on accepted attendance, role, contribution, interventions and failures. Equipment wear is usage-based, capped, mitigated by quality/technicians, and skips venue-owned gear. Health consequences use fatigue/stamina/intensity and are explicitly not medical advice; severe injury remains uncommon and must match role or incident context.

## Momentum, decay and recovery

Live momentum is a rolling short-term signal distinct from permanent reputation. `decay_band_live_momentum()` lazily pulls momentum back toward neutral. Booking opportunities expire with the scheduled expiry function. Fatigue and injury recovery should continue to use existing wellness jobs.

## UI and privacy

The gig experience DTO now exposes a post-consequence section, timeline and next actions. RLS restricts private processing, snapshots, live reputation and booking opportunities to band members, while public media reviews can be visible according to review visibility. Health/employment/finance details should stay in private snapshots or metadata and must not be exposed to unauthorised viewers.

## Known limitations

This PR lays the durable schema, calculation foundation, DTO mapping and report UI. It intentionally avoids a full automated booking marketplace, AI journalism, severe medical simulation, tour-wide simulation and retroactive backfill. Server-side orchestration can now call the pure consequence calculator and persist rows through the new idempotent tables.

## Festival audience outcome integration

Audience simulation and performance outcomes now read immutable festival session evidence, generate canonical crowd/highlight records for viewers, and leave settlement pending.
