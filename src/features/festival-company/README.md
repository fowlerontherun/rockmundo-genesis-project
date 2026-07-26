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

### Configuration hardening contract

The historical migration `20291217122000_festival_configuration_wizard.sql` has an anomalous future timestamp. Its merge into shared history means deployment cannot be disproved, so it is retained to avoid a duplicate execution. `20260726120000_document_festival_configuration_migration_order.sql` is a forward-only, existence-guarded correction for already-migrated databases; the original definition is also hardened for clean installs. `npm run verify:migration-timestamps` validates calendar timestamps without network access, freezes the documented legacy 2029 range through the configuration migration, and rejects newly added future timestamps. Shared deployment history must be confirmed by an operator because this checkout contains no production credentials or migration ledger.

The configuration RPC boundary validates every scalar, nullable value, city and scale catalogue entry. It also checks catalogue membership, real ISO dates, inclusive duration, status completeness, steps 1–4, versions starting at one, UUIDs, IANA timezones and timestamps. Any contract violation becomes `malformed_festival_configuration_result`; players never receive parser internals.

Identity unlocks location and scale, those choices unlock dates, and a valid scale-bounded future schedule unlocks review. Earlier steps remain editable and existing later values are preserved when an edit makes a prerequisite incomplete. Field validation mirrors the server limits and is linked to inputs and a focusable error summary.

Every successful save replaces the local draft and version with the canonical RPC result, including server-normalised strings, dates, duration, step, status and timestamp. Dirty state compares that saved draft with current values. Pending saves disable every submit action. One idempotency key belongs to one company, caller, expected version and material payload; retrying that unchanged attempt reuses the key. Receipts need an operational retention job after the retry window so the request table cannot grow forever.

A stale-version response preserves local work and offers explicit **Reload latest saved version** or **Keep editing locally** controls. Reloading refetches and replaces the draft only after that choice; there is no unsafe automatic merge. Known RPC failures map to stable, player-safe messages.

`canWrite` is authoritative: read-only players can inspect all four sections and review the summary, while controls and mutations are unavailable. Unsaved drafts protect page unloads and intercepted in-app links with a discard confirmation. Save state is a polite live region, uses en-GB times, and distinguishes unchanged, unsaved, saving, saved, failed, conflict and read-only states. The responsive step list and stacked narrow-screen actions avoid a content-obscuring fixed footer.

Completion is server-derived and requires valid identity, city, active scale and dates. It changes the setup to `ready_for_planning`, remains editable, and creates one audit event per non-idempotent canonical change. Changed fields are determined on the server; stale/invalid attempts and idempotent retries do not create successful audit events. Completion does not announce a festival or create an edition, site, venue, stage, ticket or artist booking.

Dependency installation remains subject to the inherited npm registry/lockfile issue recorded by the release checks; a failed `npm ci` must be reported rather than worked around by hand-editing a lockfile. Phase 2 (festival site, venue and stage planning) remains intentionally deferred until this hardening work lands.
