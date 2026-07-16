# Festival Audience Simulation Model

This PR adds the canonical audience layer that sits after performance-session readiness and before financial settlement.

## PR #1199 review findings

- `festival_performance_sessions` is the one-to-one canonical session record for active contracts and stores immutable setlist, readiness, attendance, equipment, crew, incident and performance evidence snapshots.
- Song progression is server-authored through `advance_festival_performance`, checks the expected current setlist position, and appends a progression event to `performance_evidence`.
- Completion sets settlement evidence flags and does not apply money, fame, streaming, fans or contract payment.
- The public projection excludes raw readiness, private health, equipment, crew and contract economics and only returns public status, safe progress and incident state.
- The blocking gap for outcomes was not a payment mutation; it was the absence of audience, crowd and scoring records. This PR fixes that gap additively.

## Configuration

`festival_audience_simulation_configs` stores versioned balancing constants. Active config versions are copied onto generated audience, crowd and outcome records. Constants include demand weights, cohort weights, elasticity, satisfaction thresholds, fan-conversion thresholds and bounded randomness ranges.

## Audience generation

`generate_festival_edition_audience(edition_id, idempotency_key)` locks the edition, records an input hash and deterministic seed, and creates exactly one generation per edition. It uses available edition facts: expected attendance, capacity, ticket-price range, status and active contract count. Missing factors such as weather or city market size are omitted from `source_facts` rather than invented.

Retries with the same idempotency key return the original row. Reusing a key against changed input hash fails.

## Cohorts

The model stores aggregate `festival_audience_cohorts`; it never creates per-attendee rows. Cohorts include local casual fans, genre fans, travelling fans, hardcore band fans, loyalists, social attendees, families, tourists, VIP, media/industry, sponsor guests and staff/performers. Cohort arrivals reconcile with the edition generation.

## Stage movement

`simulate_festival_crowd_movement(edition_id, at, idempotency_key)` creates minute-bucket stage snapshots for active/upcoming sessions. Stage totals are capped by safe stage capacity and by actual edition arrivals. Snapshots store density, satisfaction, excitement, fatigue, safety pressure, crowd state and cohort distribution.

The movement engine is deterministic from stored generation, session schedule and seed; retries do not reroll.
