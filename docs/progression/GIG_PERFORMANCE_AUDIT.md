# Gig performance audit

## Scope reviewed

This audit covers the current gig path across booking, preparation, live song processing, completion, readiness utilities, audience/fan side effects and existing migrations/tests. Key implementation points are `supabase/functions/process-gig-song/index.ts`, `supabase/functions/complete-gig/index.ts`, `supabase/functions/auto-complete-gigs/index.ts`, `src/utils/gigReadiness.ts`, `src/utils/gigCrewEquipment.ts`, `src/utils/gigExecution.ts`, gig viewer replay generation, and the gig-related migrations/tests under `supabase/migrations` and `supabase/tests`.

## Current booking flow

- Gigs are stored in `gigs` and linked to a band, venue, setlist and status. Earlier migrations also create starter `gig_outcomes` rows when bookings are accepted.
- `auto-start-gigs`, `auto-complete-gigs`, `start_gig_authoritative` and `claim_gig_completion` provide a partial server authority layer for starting and completing gigs.
- Booking and ticket/attendance forecasting are scattered across UI utilities and database functions. Ticket forecasting remains out of scope for this PR.

## Current preparation flow

- Setlist/readiness preparation exists in `gig_setlists`, `gig_setlist_items`, `setlists`, `setlist_songs`, `calculateGigReadiness`, `calculateCrewEquipmentReadiness`, final forecast snapshots, production/soundcheck plans and pre-show incidents.
- Readiness is advisory and mostly produces warnings/modifiers. It does not fully drive a single authoritative outcome calculation.
- Crew/equipment preparation exists, but live song scoring still falls back to older `band_stage_equipment` and `band_crew_members` averages in some paths.

## Current setlist rules

- `calculateGigReadiness` blocks empty setlists and missing durations, warns for too-short or overlong sets, and scores duration fit.
- `auto-complete-gigs` uses setlist durations to decide when songs should be processed and when a gig should complete.
- Existing song processing calculates each setlist entry by position and uses a uniqueness constraint to avoid duplicate positions.
- Sequence quality is limited: opener/closer, tempo variety, fatigue-heavy endings and momentum are not consistently represented in the legacy score.

## Current rehearsal effects

- `song_rehearsals.rehearsal_level` is read by `process-gig-song` and contributes 20% of the legacy song base score after multiplying the stored level by 10.
- Readiness utilities also use average rehearsal level and recent rehearsal/jam days.
- Rehearsal currently improves a song score but does not comprehensively reduce variance, improve transitions or create a distinct ensemble-readiness layer.

## Current attendance rules

- Newer migrations include authoritative start/completion claims and rehearsal attendance corrections.
- The live song processor fetches all non-touring `band_members` for the band and averages them. Accepted gig attendance and absent performers are not consistently used in the legacy per-song formula.
- This means a member may contribute through band membership even when attendance/assignment state should exclude them.

## Current member-role handling

- `process-gig-song` maps display roles such as Lead Guitar, Bass, Drums and Lead Vocals to instrument skill slugs.
- The role mapping is local to the function and duplicated from client-side skill/gear logic.
- Legacy live scoring averages effective member skill across members. It does not calculate required role coverage first, pick the best accepted performer for each required role, or apply clear missing-role penalties.

## Current performance calculation

Concrete legacy song example:

1. `process-gig-song` fetches the gig, canonical outcome, setlist song, band members, equipment, crew, rehearsal, attendance and venue capacity.
2. It computes `memberSkillAverage` by role-mapping each member, reading skill progress, blending attributes, adding equipped gear and averaging members.
3. It computes `stageSkillAverage` from Stage Presence/Charisma-like attributes.
4. It calls `calculateSongPerformance` with weights: song quality 25%, rehearsal 20%, chemistry 15%, equipment 12%, crew 8%, member skills 10%, stage skills 10%.
5. It multiplies the score by venue capacity usage, random variance, random event multiplier and a quality difficulty curve, then stores a 0-25 `performance_score`.

After this PR's focused integration, the random factors in this legacy path are deterministic and bounded by a server seed, but the broader legacy formula remains documented as a migration risk until all consumers move to the shared live outcome calculator.

## Current audience response calculation

- Legacy `process-gig-song` derives `crowd_response` directly from the same song `performance_score` thresholds.
- Stage behavior changes the thresholds, but audience response is still tightly coupled to the technical score.
- Gig viewer replay reads persisted `gig_song_performances` and should not calculate authoritative gameplay outcomes.

## Current fan and reputation rewards

- `complete-gig` averages song performance scores, calculates revenue/merchandise, updates outcome columns, and applies fame/fan-style rewards through several older formulas and side-effect systems.
- Additional migrations update audience memory from `overall_rating * 4`.
- Fan conversion utilities also exist separately, so final fan/reputation causality is difficult to trace end-to-end.

## Current use of skills

- Live song processing uses instrument skill slugs and a tiered skill bonus. If no role-specific skill exists, it falls back to all instrument skills at a reduced value.
- This fallback is risky because unrelated skills can still contribute to role execution.
- Stage/crowd skills are blended into score thresholds or stage average rather than separated from instrumental accuracy.

## Current use of attributes

- Technical path blends Musical Ability, Technical Mastery and Rhythm Sense into skill level.
- Stage path separately reads Stage Presence and Charisma; Crowd Engagement is selected but not used in the normalization.
- Stage attributes can indirectly raise the same song performance score, which makes technical and stage performance less distinct.

## Current use of equipment and crew

- Legacy song scoring averages `band_stage_equipment.quality_rating` and `band_crew_members.skill_level`.
- Newer crew/equipment preparation utilities provide richer readiness, reliability, requirements and production readiness but are not the sole live scoring source.
- Missing role equipment is not consistently treated as a role-specific warning/penalty.

## Current health and wellness use

- Readiness utilities include fatigue and health when data is available.
- Legacy live song scoring does not progressively fatigue performers across the set.
- `complete-gig` applies some end-of-gig consequences, but a role-aware per-song health/energy model was not the source of truth.

## Current venue effects

- Legacy song scoring uses venue capacity utilization as a performance multiplier.
- Venue quality, acoustics, genre fit, audience type and prestige are not consistently separated into environment, expectation and response effects.

## Current randomness

- The legacy `process-gig-song` path used `Math.random()` for variance and event multipliers. That made repeated processing vulnerable to rerolls if idempotency failed before insert.
- This PR replaces those random calls with deterministic server-seeded rolls in the legacy per-song processor and adds deterministic seeded variance to the shared live outcome calculator.

## Current XP rewards

- Gig XP is handled in completion and progression utilities, with multiple paths for performance/fame/progression rewards.
- The client should not submit XP amounts. The new calculator returns role-relevant XP intents only for active performers.

## Duplicate or conflicting formulas

- `process-gig-song`, `src/utils/gigExecution.ts`, `src/utils/enhancedGigPerformance.ts`, readiness/forecast utilities, fan conversion utilities and database triggers all contain overlapping scoring or reward logic.
- Some formulas use 0-25 scales, some use 0-100 scales, and some convert by multiplying `overall_rating` by 4.
- Current final score traceability is therefore incomplete: the final visible result can depend on song processor rows, completion aggregation, triggers, fan utilities and legacy columns.

## Client-authoritative values

- The live viewer is mostly read-only, but older client utilities can still simulate or submit preparation-derived values.
- Server functions now guard canonical outcome identity and duplicate positions; the target architecture is that clients submit only identifiers and validated preparation choices.

## Known bugs and risky assumptions

- Role skill relevance is duplicated and partly inferred from strings.
- Attendance acceptance is not consistently required before contribution.
- Stage presence can affect a song's stored performance score rather than only stage/audience layers.
- Fame and venue fullness can amplify audience/commercial outcomes in ways that are not clearly separated from performance quality.
- Legacy completed gigs should not be recalculated; missing breakdown fields require safe defaults in reports.

## Follow-up commercial and touring work

- Ticket demand forecasting, dynamic pricing, transport finance, tour routing, chart/streaming effects and full merchandising economics should remain separate commercial/touring work.
