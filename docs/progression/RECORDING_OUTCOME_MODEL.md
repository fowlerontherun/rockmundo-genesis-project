# Recording Outcome Model

## Balance version

`recording_outcome_v1` separates the written song from the recording/master. New completions store a structured `outcome_breakdown`, `source_song_quality`, `final_master_quality`, `applied_variance`, `calculation_version`, credits and XP award metadata on `recording_sessions`.

## Concepts

- **Song potential**: the completed songwriting quality. It is source material, not the whole master.
- **Performer execution**: each accepted/attended performer evaluated by assigned role.
- **Vocal performance**: lead and backing vocals evaluated separately from instruments.
- **Instrumental performance**: instrument-specific execution, timing and expression.
- **Ensemble tightness**: cohesion, chemistry, familiarity, rehearsal readiness and timing.
- **Arrangement readiness**: how prepared the band is to execute the arrangement in studio.
- **Capture quality**: studio room, microphones, equipment, monitoring and maintenance.
- **Production quality**: producer direction, arrangement choices, take selection and focus.
- **Engineering quality**: technical capture, mic placement, noise control and consistency.
- **Mix quality**: blend of engineering, production and studio capture.
- **Session efficiency**: duration, condition, producer/engineer support and retake waste.
- **Final master quality**: staged blend plus bounded stored variance and smooth ceilings/floors.

## Final weighting

`finalMasterQuality` is calculated from the pre-variance blend:

- 35% source song quality;
- 30% performer execution;
- 20% production/engineering/mix average;
- 8% studio capture;
- 7% readiness/cohesion.

This keeps the song as the largest single factor while allowing weak performances or poor production to drag down a strong song. It also lets a modest song sound polished without becoming an all-time songwriting masterpiece.

## Performer calculation

Each performer uses canonical role relationships where practical:

- 54% role skill;
- 12% supporting skills;
- 11% song familiarity;
- 6% rehearsal readiness;
- 9% relevant attributes;
- 5% condition;
- 3% equipment quality/suitability.

Attributes are deliberately bounded below skills. High Vocal Talent, Rhythm Sense or Musical Ability improves consistency but cannot replace a missing role skill.

## Role coverage

Required roles are normalized to canonical recording roles such as `lead_vocals`, `backing_vocals`, `lead_guitar`, `rhythm_guitar`, `bass`, `drums`, `keyboards` and `electronic_production`. Missing required roles receive a low placeholder score and reduce the ceiling. Duplicate exclusive assignments produce warnings and a smaller penalty. Unaccepted or absent participants are excluded.

## Vocals

Lead and backing vocals use `vocals`, performance/harmony support, Vocal Talent, Musicality, Mental Focus, familiarity, condition and microphone/studio capture. Poor health or energy reduces consistency and efficiency rather than automatically making completion impossible.

## Instruments

Instrument roles use instrument-specific skills. Drums and bass emphasize Rhythm Sense, guitar emphasizes Musical Ability/Musicality, keyboards use theory/composition support, and electronic production uses production/technical skills.

## Rehearsal and cohesion

Readiness combines band cohesion, chemistry, song familiarity and rehearsal readiness. It contributes directly through the 7% readiness share and indirectly through ensemble tightness and session efficiency. It remains capped and cannot replace role skill.

## Studio and equipment

Studio capture averages overall quality, equipment, room acoustics, microphones, monitoring and maintenance where available. Studio quality affects capture, engineering effectiveness and ceilings, but it is not a raw multiplier on final quality. Performer equipment is bounded in performer execution.

## Producer and engineer

Producer and engineer scores combine NPC/studio ratings, relevant player skills, Technical Mastery, Creative Insight, Mental Focus, genre fit and studio familiarity. Missing producer uses a conservative baseline. Missing specialist engineer uses the studio default or safe baseline.

## Session musicians

Session musicians are represented as performers with `isSessionMusician`. They fill role coverage, can earn role XP if player-controlled, and should be persisted in credits. They do not become band members and must be validated by the server booking path.

## Duration and modes

Duration uses diminishing returns: one day provides essential recording, days two and three add large/moderate gains, and later days mostly polish. Professional mode improves technical efficiency and narrows variance; chilled mode improves readiness/chemistry with moderate efficiency; party mode widens variance and lowers technical efficiency while allowing morale/creativity upside. No mode is universally optimal.

## Randomness and idempotency

Variance is deterministic from a server seed and stored as `applied_variance`. Normal professional variance is approximately ±2.8%; chilled and party widen it. Producer, engineer and readiness reduce variance width. Repeated completion can reuse the stored outcome and must not reroll.

## Quality ceilings and floors

A source ceiling blends source song quality, performance, production and studio capture, then subtracts coverage penalties. A weak song cannot become a songwriting masterpiece through studio quality alone. The floor is improved by performers, engineering and studio quality so strong staff mostly raise reliability rather than overriding weak takes.

## Scheduling, payments and XP

The calculator returns role-specific XP awards but does not accept XP from the client. Booking, attendance, conflict checks, funds reservation, settlement and ledger writes must remain server-authoritative. The current PR persists outcome metadata and gives the completion worker a reusable staged model; further RPC hardening should move quote/booking/settlement into one atomic database operation.

## Telemetry and explanations

The stored breakdown supports admin diagnostics and player explanations: source contribution, performer execution, vocal/instrumental performance, readiness, capture, production, engineering, mix, duration, variance, strengths, weaknesses and warnings.

## Legacy compatibility

Completed legacy rows keep historical quality and are marked `legacy`. New calculations apply only to new completions. Incomplete legacy bookings receive safe defaults when detailed inputs are absent.

## Follow-up live performance and commercial outcome work

Future PRs should consume `final_master_quality` and `outcome_breakdown` for releases, profiles and song history. Live gig performance, streaming, chart, ticket-sales and crowd-response formulas remain separate follow-up work.
