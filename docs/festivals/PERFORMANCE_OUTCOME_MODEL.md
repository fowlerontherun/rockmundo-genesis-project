# Festival Performance Outcome Model

## Scope

The outcome layer consumes immutable PR #1199 performance-session evidence. It calculates performance quality, song outcomes, crowd response, fan conversion proposals, media/sponsor sentiment and reputation effects. It does not apply balances, fame, streaming, XP, fan counts or contract payments.

## Server-authoritative scoring

`calculate_festival_performance_outcome(session_id, idempotency_key)` requires a terminal session status: completed, partially completed, abandoned, cancelled or no-show. It locks the session, hashes session evidence, loads the active config, loads or creates an immutable performance audience snapshot, creates one current outcome for model version `festival_performance_outcome_v1`, and writes dependent records in the same transaction.

Inputs are separated into:

- skill/execution proxies;
- preparation and readiness;
- setlist completion and pacing;
- operational professionalism;
- incidents;
- audience fit and crowd excitement.

## Controlled randomness

Randomness is bounded and secondary. SQL derives a deterministic seed from session id, session version and input hash. Variation is limited to small score ranges and is stored as `calculation_seed`; retries with the same evidence return the same outcome.

## Song outcomes

Every planned setlist item receives a `festival_song_performance_outcomes` row. Per-song rows include performed/skipped/not-performed status, quality, technical execution, crowd response, singalong/dancing response, energy change, audience retained, gained and lost, media reaction and evidence snapshot.

## Highlights and narrative

Highlights are generated from song scores and incidents, not random viewer behaviour. `festival_performance_narrative(session_id)` projects a deterministic narrative from stored highlights, incidents, audience snapshot and song outcomes.

## Public projection

`public_festival_performance_outcomes` exposes audience size, capacity percentage, crowd state, safe highlights, public incident state, public status and completion summary. It does not expose private health, detailed skill values, crew issues, contract terms, settlement values, input hash or seed.

## Invalidation

`invalidate_festival_performance_outcome` is admin-only, requires a reason and refuses to mutate finalised outcomes. Historical outcomes are preserved through status rather than silent rewrites.

## Settlement handoff

Finalised outcomes are now consumed by settlement as immutable source evidence. Pending effect rows remain proposals until `festival_effect_applications` records an applied, adjusted, blocked, rejected or superseded result.
