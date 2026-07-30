# Authoritative annual-edition runtime

## Authority and scheduling dependency

The runtime starts after merged PR #1440 (`62829ed`). It consumes the canonical published/locked `festival_schedule_revisions`, edition-scoped `festival_stages`, and revision items that reference stable stage/slot identifiers. It never creates a second schedule and does not use `game_events` as runtime authority. Preparation resolves the temporary company-edition/legacy-edition bridge and returns `FESTIVAL_RUNTIME_SCHEDULE_INVALID` when that mapping is absent.

## Aggregate and configuration

`festival_edition_runtimes` permits one non-terminal aggregate per `festival_editions_v2` edition. It stores the clock, deterministic seed/rules, immutable schedule and upgrade references, preserved licence/weather inputs, attendance conservation counters, readiness, evidence states, version, recovery and audit metadata. `festival_runtime_configuration_versions` freezes schedule stages/items, assignments/contracts, upgrade/licence, capacity, weather and rules. Corrections append a version with a reason; they never rewrite an earlier configuration.

States are `preparing → ready → gates_open → live → closing → completed`, with constrained pause, abort and recovery paths. `transition_festival_edition_runtime` checks authenticated profile authority, expected version, idempotency and significant-action reasons. The browser has no table grants.

## Processing and evidence

`festival_runtime_ticks` provides claim fencing and exactly-once `(runtime_id,tick_number)` processing. Random inputs are derived from runtime seed, rules version, tick, event key and stable entity ID; the resolved value and digest live in append-only `festival_runtime_evidence`. Evidence types cover arrival cohorts, admission, conserved crowd movement, stage/artist readiness, performance adapter results, staff, suppliers, sales, sponsors, preserved weather, component satisfaction and operational overrides.

Food/drink and merchandise values remain integer-minor-unit evidence. No sale posts the Festival balance. Performance evidence references the shared canonical gig engine boundary and creates no fame, fans, money or reputation. Settlement/effects consumers use frozen evidence only.

## Operations

Gate admission is bounded by sold-ticket and lowest-capacity snapshots. Movement evidence must reconcile entrance, stages, facilities, welfare/camping/general areas and departed attendees. Stage states are `closed`, `setup`, `ready`, `soundcheck`, `performance`, `changeover`, `delayed`, `paused`, `evacuated`, and `completed`; performance workers require stage and canonical-member artist readiness or an audited permitted override.

Operational schedule changes append override evidence against the published revision. Delays, shorten/extend/skip/move/cancel actions preserve the planning schedule and re-evaluate later occupancy, curfew, artist, staff, sponsor and transport conflicts. Staff/supplier fulfilment refers to contracts. Sponsor satisfaction and audience/artist satisfaction are derived from component evidence rather than client-submitted totals.

Incidents use a versioned catalogue, typed category and severity, probability inputs, assigned response, state, costs and audit history. Role-scoped RPCs are the mutation boundary. Preserved weather sequences drive deterministic arrival, crowd, stage, incident, sales, camping, transport and satisfaction effects; replay never fetches mutable historical weather.

## Projections, permissions and recovery

The owner route `/festival-company/:festivalCompanyId/editions/:editionId/live` polls `get_festival_edition_runtime_control_room`, a secured projection. Owners see edition operations; later role projections must filter assigned stage, medical/security category, supplier obligations or the artist's own session. Public projection work must expose only approved status, schedule, warnings and highlights—never medical data, weaknesses, private readiness or finance.

Tables have RLS and no `anon`/`authenticated` DML grants. Definer functions use an empty search path, derive actor identity from `auth.uid()`, and never accept actor identity. Workers use service authority. Stable `FESTIVAL_RUNTIME_*` errors are mapped at the repository/UI boundary rather than exposing SQL.

Timed-out ticks retain their claim/evidence. Recovery inspects the last completed tick and stable evidence keys, increments retry metadata and resumes; it never deletes evidence. Completion requires closed gates, zero onsite population, final sessions, no unresolved critical incident and frozen evidence, then writes a versioned component/count digest. This makes the edition settlement-eligible but does not settle it.

## Migration and harness status

The launch-scoped runtime remains a compatibility read and settlement source for already launched historical Festivals. Its RPCs are `legacy_rpc`/`remove_after_migration`; new edition runtime RPCs are `canonical_rpc`, and service tick processing is `canonical_worker`. Remaining direct browser writers elsewhere in the Festival inventory remain `direct_write_requires_replacement` and are not legitimised by this runtime.

The disposable harness refuses execution unless `FESTIVAL_TEST_DATABASE_DISPOSABLE=true`. On 2026-07-30 no database URL was explicitly confirmed disposable, so the runtime, upgrade, artist-application, scheduling and full-lifecycle database harnesses are recorded as **not executed**, not passed.
