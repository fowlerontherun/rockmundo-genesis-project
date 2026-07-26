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
# Phase 2: site and stage planning

Phase 1 (identity, home city, scale and inclusive dates) is complete. Phase 2 adds an RPC-only `festival_site_plans` aggregate with child `festival_stages`; it is available only after configuration reaches `ready_for_planning`. An existing site references the canonical `venues` row and derives its name/city/capacity constraint. Temporary, open-land and mixed sites remain provisional planning records and never create, book or charge a venue.

Planning limits live on the admin-rebalanceable `festival_scale_catalogue`: local 1/1,000; small 1–2/5,000; medium 2–4/20,000; large 3–6/50,000; major 4–10/120,000. Exactly one main stage is required for completion. Each stage must fit the usable site capacity and site hours. Stage capacities need not sum to site capacity because crowds move; the server returns concentration metrics and warnings instead. Accessibility, toilets, medical, security, bars, food, water, backstage, parking and transport values are estimates—not contracts.

`save_festival_site_plan` owns validation, readiness, recommendations and completion. It uses an atomic version check and caller/company/key-scoped SHA-256 idempotency receipts. Identical retries return the recorded canonical result; changed payloads conflict. Each successful logical save writes one audit row. Receipts should be retained for the client retry window and purged after 90 days. Tables have RLS and no browser table privileges; owner/admin access is resolved server-side.

## Migration ordering

Phase 2 uses `20291217130000_festival_site_and_stage_planning.sql`, immediately after the retained anomalous `20291217122000_festival_configuration_wizard.sql`. This is a narrowly bounded continuation: fresh installs create Phase 1 first, while shared environments apply only the new forward migration. The timestamp verifier permits the exact Phase 2 and Phase 3 continuation filenames only and continues to reject arbitrary future migrations. The older 2026 corrective migration is documentation only and is not a Phase 1 dependency.

Dependency installation may still fail because of the inherited npm registry/lockfile mismatch. Do not edit the lockfile or create shims; run dependency-independent migration and script checks regardless.

## Roadmap

1. Identity, location, scale and dates — complete
2. Site and stage planning — complete
3. Ticketing and capacity allocation — this PR
4. Artist applications and bookings
5. Staffing and suppliers
6. Sponsorship
7. Readiness and launch
8. Live simulation and settlement

## Phase 3 — ticketing and capacity allocation

Phase 3 is a **planning model**, separate from future issued tickets and purchases. It stores a ticket plan, editable admission/upgrade/add-on products, planned release phases, daily allocations, deterministic forecasts, idempotency requests, and append-only audit events. Admission products support single-day, date-range, and full-Festival access; the server expands their date effects. Add-ons use `non_admission` and never consume attendance capacity.

The authoritative daily rule is `admission allocation + reserved operational capacity + complimentary capacity <= Phase 2 usable site capacity`. Browser totals, readiness, currency, tax, fees, and forecasts are ignored. Prices and forecast values are integer minor units; basis points provide fixed-point tax, fee, sell-through, refund, complimentary-use, and no-show assumptions. Forecasts are labelled not earned and never post to the finance ledger.

`get_festival_ticket_plan` and `save_festival_ticket_plan` are owner/admin-only security-definer RPCs. Tables have RLS enabled and direct `PUBLIC`, `anon`, and `authenticated` access revoked. Saves use an atomic planning version, normalised payload hash, caller/company-scoped idempotency key, and one audit event. Completion is possible only after Phase 2 is `ready_for_ticketing`, when blocking validation is clear, and produces `ready_for_artist_planning`; it does not open sales.

### Deliberate migration sequence

The retained Phase 1 migration established an already-deployed future-dated sequence. Fresh installs order the exact continuations lexically: `20291217130000_festival_site_and_stage_planning.sql`, then `20291217140000_festival_ticketing_and_capacity_planning.sql`. Already-deployed environments safely apply only the latter migration forward; no historical filename is renamed. The timestamp verifier permits these two exact names only and continues to reject arbitrary future migrations.

The inherited npm registry/dependency installation blocker remains external to Festival Phase 3. A failed `npm ci` must be reported verbatim; dependency-independent migration, shell, JavaScript and diff checks must continue.

### Roadmap

1. Identity, location, scale and dates — complete
2. Site and stage planning — complete
3. Ticketing and capacity allocation — this PR
4. Artist applications and bookings
5. Staffing and suppliers
6. Sponsorship
7. Readiness and launch
8. Live simulation and settlement
