# festival-company (PR1 skeleton)

Replacement bounded context for the legacy festival system. PR1 introduces
only the module boundary, feature flags and a legacy gate. No gameplay,
data access or database schema lives here yet.

## Bounded contexts (to be filled by later PRs)

- `domain/` — festival-company aggregate + annual edition aggregate.
- `application/` — server-authoritative services (creation, transfers, upgrades).
- `data/` — Supabase repository adapters over the new schema.
- `permissions/` — owner / stage-manager / admin authority checks.
- `finance/` — company balance, personal-to-company transfers, reservations.
- `scheduling/` — stages, slots, canonical activity blocking.
- `performance/` — thin adapter over the existing gig engine.
- `history/` — immutable settled records + versioned scoring snapshots.
- `ui/` — player-facing screens; currently only the "rebuilding" screen.

## PR sequence

See `docs/festivals/FESTIVAL_REPLACEMENT_ARCHITECTURE.md`.

## Configuration wizard (phase 1)

The owner/admin-only setup route now saves a resumable RPC-backed draft covering public identity, canonical home city, a database-backed scale, and inclusive planned dates. `festival_configurations` uses statuses `not_started`, `in_progress`, `identity_complete`, `schedule_complete`, `draft_complete`, and `ready_for_planning`; completion means planning-ready, never announced or on sale. Server constraints, active catalogues, optimistic versions, UUID idempotency keys, and a structured audit row protect every change. Tables fail closed and browser writes are prohibited.

The scale catalogue is intentionally rebalanceable and supplies capacity guidance, complexity, and maximum duration. Dates use server `CURRENT_DATE`; no northern-hemisphere seasonal restriction is invented, and the UI instead warns about later weather/cost effects.

Roadmap: phase 2 venue/site and stages; phase 3 ticketing and capacity; phase 4 artist applications/bookings; phase 5 staffing/suppliers; phase 6 sponsorship; phase 7 readiness/launch; phase 8 live simulation/settlement.

Verification note (2026-07-26): `npm ci` is blocked by the inherited registry policy (`E403` fetching `jsdom`), after an npm 11 versus required npm 10.9 engine warning. No dependency manifests were changed.
