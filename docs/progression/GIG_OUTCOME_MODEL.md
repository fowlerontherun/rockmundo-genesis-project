# Live gig outcome model

## Server-authoritative boundary

Clients submit identifiers and preparation choices only: gig, band, venue, participant assignments, setlist, equipment loadout, crew assignment, stage setup and balance version. The server fetches and validates ownership, booking state, membership, accepted attendance, roles, song rights, familiarity, rehearsal history, skills, attributes, wellness, equipment, crew, venue, audience, scheduling conflicts and existing outcomes. Clients never submit final performance, crowd-response, fan-gain, reputation or XP values.

The reusable implementation is `supabase/functions/_shared/gigOutcomeCalculator.ts` with balance version `gig_live_outcome_v1`.

## Outcome layers

1. **Member execution**: role-specific performance for each accepted/attending performer.
2. **Ensemble tightness**: cohesion, chemistry, rhythm/focus and rehearsal readiness.
3. **Song performance**: each setlist song receives distinct technical, stage and audience values.
4. **Setlist flow**: opener/closer quality, duration fit, pacing variety and repetition risk.
5. **Technical show quality**: musical execution, familiarity, rehearsal, equipment, crew, venue environment and cohesion.
6. **Stage performance**: stage presence, crowd engagement, charisma, frontperson impact, crew and stage setup.
7. **Audience response**: technical quality, stage quality, setlist flow, venue/genre fit, expectations, momentum and bounded variance.
8. **Crowd satisfaction**: final audience response converted into reportable states and satisfaction.
9. **Fan conversion**: audience-size-scaled local/broader fan changes with diminishing reach.
10. **Reputation change**: quality and expectation performance, bounded positive/negative result.
11. **Fatigue and health impact**: deterministic post-gig health, energy and fatigue deltas.

## Member execution formula

For each performer assigned to a role:

- 56% primary role skill.
- 12% supporting skills.
- 12% song familiarity.
- 7% rehearsal readiness.
- 7% relevant technical attributes.
- 4% condition: health, energy, stress and fatigue.
- 2% equipment quality/suitability.

Absent or unaccepted members score zero and receive no XP. Incompatible role assignments, missing equipment and duplicate exclusive assignments generate warnings. Stage Presence, Crowd Engagement and Charisma are not part of member technical execution.

## Canonical role and attribute relationships

- Lead vocals: vocals; Vocal Talent, Musicality, Mental Focus.
- Backing vocals: vocals/harmony; Vocal Talent, Musicality, Mental Focus.
- Lead guitar: guitar; Musical Ability, Musicality, Mental Focus.
- Rhythm guitar: guitar/rhythm; Rhythm Sense, Musical Ability, Mental Focus.
- Bass: bass/rhythm; Rhythm Sense, Musical Ability, Mental Focus.
- Drums: drums/rhythm; Rhythm Sense, Physical Endurance, Mental Focus.
- Keyboards: piano/music theory; Musical Ability, Musicality, Mental Focus.
- DJ/electronic: DJ/production; Technical Mastery, Rhythm Sense, Mental Focus.

Stage Presence, Crowd Engagement and Charisma feed the stage/audience layer only.

## Song performance

Each song computes:

- selected active performers;
- role coverage against required roles;
- per-performer familiarity for that song;
- song rehearsal readiness;
- difficulty and arrangement complexity;
- progressive fatigue at that point in the set;
- equipment and crew readiness;
- venue environment;
- crowd fit;
- sequencing momentum.

This allows strong and weak songs in the same set, late-show fatigue, opening nerves, encore boosts and song-level notable events.

## Rehearsal, familiarity, cohesion and variance

- Familiarity is capped and contributes directly at 12% of member execution.
- Rehearsal contributes directly to execution and indirectly to technical performance/variance.
- Cohesion and chemistry are bounded inputs to technical score and ensemble score; they do not replace individual skill.
- Seeded variance is server-generated, deterministic and normally within about ±3-5%; rehearsal and cohesion reduce the width, while over-complex production relative to crew can widen it.

## Setlist flow

Setlist flow is a 0-100 score from:

- 24% opener suitability;
- 24% closer suitability;
- 22% tempo/mood variety;
- 30% booked slot duration fit.

Warnings are produced for empty setlists, invalid durations, overlong sets and very short sets. Flow affects audience response and momentum, not raw role skill.

## Condition and fatigue model

Each song increments per-performer fatigue using song duration, role intensity and Physical Endurance. The accumulated fatigue reduces condition in later songs. Drums and lead vocals are more intense than lower-movement roles. Post-gig consequences persist as health, energy and fatigue deltas returned by the calculator.

## Equipment, stage setup and crew

- Equipment affects role execution through quality/suitability and missing-equipment warnings.
- Crew affects technical reliability and stage presentation.
- Stage setup quality improves presentation; setup complexity can widen variance when crew readiness is inadequate.
- These effects are bounded so money cannot replace skill or rehearsal.

## Venue and audience expectations

Venue quality affects environment. Venue/genre fit affects audience response. Fame, ticket price and venue scale raise expectations rather than raw performance. Unknown bands can exceed expectations more easily; famous bands can disappoint if technical/stage scores are weak.

## Audience response formula

Audience response uses separate layers:

- 40% technical performance;
- 25% stage performance;
- 13% setlist flow;
- 10% venue, genre, local and song crowd fit;
- 8% expectation performance;
- 4% bounded momentum.

The audience score is intentionally not identical to technical performance.

## Crowd states and momentum

Momentum ranges from -100 to +100. Strong songs raise it, weak songs lower it, openers have extra influence and encores can add a small boost. Song audience response maps to crowd states: bored, attentive, engaged, hands up, jumping and ecstatic. Viewer event data consumes persisted outcomes; it does not control rewards.

## Fan, reputation and XP rewards

Fan growth depends on audience size, audience response and expectation performance with venue-size reach limits. Local fans may decrease after poor shows; broader fans never become a huge windfall from a tiny room. Reputation change is bounded. XP awards are returned only for active performers and use the assigned role's primary skill.

## Persistence contract

New completions should persist calculation version, lineup, role assignments, setlist snapshot, song scores, member scores, technical score, stage score, audience-response score, setlist-flow score, readiness/equipment/crew/wellness/venue snapshots, variance, notable events, fan/reputation changes, XP rewards and completion timestamp. Completed legacy gigs retain their existing results and should be marked or rendered as legacy where detailed snapshots are absent.

## Diagnostics and telemetry

Admin diagnostics should show role coverage, inputs, scores, rewards and anomalies. Structured telemetry should cover booking, lineup, attendance, setlist lock, readiness check, start, completion, outcome calculation, fan/reputation/XP application, blocked bookings and duplicate completion prevention without logging private user content.

## Follow-up commercial and touring work

Ticket-demand forecasting, dynamic pricing, streaming/chart success, tour routing, transport finance, festival redesign, broad equipment markets and broad crew employment remain out of scope.
