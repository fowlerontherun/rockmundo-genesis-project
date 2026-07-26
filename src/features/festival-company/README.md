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

## Phase 4 — artist applications, negotiation and bookings

Phase 4 unlocks only after the ticket plan reaches `ready_for_artist_planning`. The artist programme uses the ticket plan currency, one or more explicitly activated application windows, separate applications and invitations, versioned offers with append-only revisions, and one confirmed booking per accepted offer. Player solo identities are canonical profiles; bands remain canonical `bands` rows and contractual actions require the existing leader/founder/manager/officer authority; NPC participation is restricted to trusted server/admin actions. No shadow artist records are created.

Offers use integer minor units and basis points. Acceptance encumbers fee, travel and accommodation in `festival_financial_commitments`; it never changes cash and forecast ticket receipts are never available funds. Availability summaries incorporate canonical artist and required-member activities, while deterministic suitability reports genre, audience, budget, stage and travel risks without claiming guaranteed outcomes. Provisional dates/stages are preferences, not timetable reservations.

Every action has a narrow state transition, optimistic version and actor/target/action-scoped idempotency receipt. Identical retries return the receipt; changed payloads conflict. Audit rows contain only safe changed-field names, not private messages. All Phase 4 tables fail closed and browser table mutation is revoked. Artist-facing reads are limited to the represented artist; managers see only their company programme.

The completion review calculates player/NPC counts and budget shares. Player artists earn the stronger community/relationship planning value, while NPCs retain predictable fallback and genre-coverage value. If local player supply cannot meet a target, the server reports a warning rather than creating an impossible requirement. Completion produces `ready_for_operations` only; staffing and supplier work remains Phase 5.

### Phase 4 migration ordering

`20291217150000_festival_artist_applications_and_bookings.sql` is the sole allowed continuation after Phase 3. Fresh installs create Phases 1–4 lexically; existing environments apply only this additive migration. It does not rename historical files or mutate issued tickets/cash. The isolated future-dated sequence exists solely because the retained Phase 1 timestamp was already shared, and the verifier permits this exact filename while rejecting arbitrary future migrations.

### Roadmap

1. Identity, location, scale and dates — complete
2. Site and stage planning — complete
3. Ticketing and capacity allocation — complete
4. Artist applications and bookings — this PR
5. Staffing and suppliers
6. Sponsorship
7. Readiness and launch
8. Live simulation and settlement

## Phase 4B — artist interaction workflows

Phase 4B adds a forward-only `20291217151000_complete_festival_artist_workflows.sql` boundary. Applications move explicitly through submitted, review, shortlist, offer-pending, rejection or withdrawal. Invitations are sent and answered as interested/declined; they never create bookings. Offers begin as drafts, retain immutable ordered revisions, and are sent, countered, declined, withdrawn or accepted with optimistic versions.

Every mutation resolves the authenticated profile and uses a receipt scoped to actor, action, target and UUID key. Equal retries return the stored canonical result; changed payloads fail. Completed receipts may be cleaned after 90 days only after audit/communication retention. Festival owners/admins manage the programme. Solo profiles act for themselves; active band leaders, founders, co-leaders and managers act for the band. Ordinary/former members are read-only and NPC actions remain manager-only.

Acceptance locks the programme, rechecks deadline and commitment capacity, accepts one revision, creates one provisional `awaiting_schedule` booking and one `committed` encumbrance, then updates linked records and communications in the same transaction. It never changes cash, records income, pays an artist, sells tickets or creates a timetable slot. Cancellation preserves the offer/booking, releases the commitment, and produces an audit record. Artist opportunity and manager candidate-search RPCs disclose only authority-safe summaries; direct table access remains revoked and communications link to the registered `/festival-opportunities` route.

RLS/access matrix: anonymous and unrelated profiles have no RPC access; managers see company planning data; artists see only their represented identities; ordinary band members cannot bind the band; service/admin paths are still constrained by action-specific validation. Mail and notification outbox rows are unique per receipt, recipient, channel and event, so retries cannot duplicate delivery.

The inherited npm registry/dependency installation blocker remains external to this feature; dependency-independent migration, RPC and static checks should still run.

## Phase 5 — staffing, suppliers, and operational planning

Phase 5 follows `20291217151000_complete_festival_artist_workflows.sql` as the single allow-listed `20291217160000_festival_staffing_and_suppliers.sql` continuation of the retained 2029 sequence. Fresh installs apply it after Phase 4B; deployed databases apply it forward-only without rewriting prior migrations.

The operations plan inherits the artist programme currency and unlocks only at `ready_for_operations`. Server generation derives departments, safety-critical staffing (security, crowd management, medical, fire safety, gates and accessibility), shift windows, and supplier demand from canonical configuration, site, stage, ticket and booking data. Browser-provided counts, quality, reliability and currency are not authoritative.

Vacancies and applications reference canonical player profiles; assignments select exactly one profile, NPC labour-pool identity, or canonical company. Player quality remains skill-dependent and can exceed NPC ceilings, but participation alone never makes an unqualified worker safe. Shifts enforce the assignment and Festival window. Supplier quotes select exactly one canonical player company or NPC supplier; server-derived quality/reliability and finite refresh selections prevent self-reported or infinite perfect supply.

Accepted staff and supplier work extends `festival_financial_commitments`: integer minor-unit encumbrances remain separate from artist commitments, ticket forecasts, actual cash and realised expense. No payroll, supplier payment, XP, ticket sale, announcement, delivery simulation or settlement occurs.

All tables deny direct browser writes. Explicit RPCs apply owner/admin/applicant/company authority, expected versions, scoped payload-hash idempotency, audit events and communication deduplication. Completion is server-blocked by budget, currency, schedule, skill, safety coverage and essential contracts, and only advances to `ready_for_sponsorship`.

The inherited npm registry `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom` may prevent dependency installation; dependency-independent migration and static verification must continue and blocked commands must not be reported as passing.

## Phase 5B staffing and supplier workflows

Phase 5B completes the server-authoritative workflow boundary introduced by Phase 5A. Vacancies move from publication through player application, withdrawal, manager review and hiring; hiring (including bounded NPC fallback) creates an assignment and one planning commitment in the same transaction. Shifts are append-only, version checked, bounded by the assignment, and reject overlaps. Cancellation retains applications, assignments and shifts while releasing future coverage and the commitment.

Supplier requirements are published as safe opportunities. Only an active company owner, CEO or manager can bind a player company. Quotes move through submitted, under review, declined/withdrawn and accepted states. Acceptance creates the contract, allocation and commitment atomically; it does not transfer cash. NPC quotes use a deterministic daily seed, a 24-hour cooldown and a five-requirement bound. Accepted quotes are never refreshed away.

Every action resolves the authenticated profile on the server, checks optimistic versions, hashes its canonical payload and stores an actor/action/target receipt. Audit and mail/notification outbox rows are unique per request. Direct table writes remain revoked from `PUBLIC`, `anon` and `authenticated`; applicants see only safe marketplace data and their workflow result, while company representatives never see competitor pricing.

`ready_for_sponsorship` requires committed, qualified assignments with shifts, accepted safety supplier contracts and matching active financial commitments. Published vacancies, applications and unaccepted quotes never count as coverage. Ticket, sponsorship and merchandise forecasts are not cash and are not included in these budget checks. Payment, realised expense, launch, XP and settlement remain later-phase work.

Migration sequence: `20291217160000_festival_staffing_and_suppliers.sql` (Phase 5A schema) then `20291217161000_complete_festival_staffing_supplier_workflows.sql` (Phase 5B actions). The inherited install issue is `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom`; dependency-independent verification must continue when it occurs.

## Phase 6 — sponsorship and commercial partnerships

Phase 6 is the single migration `20291217170000_festival_sponsorship_and_partnerships.sql`, ordered directly after the retained Phase 5 workflow migration. It is forward-only: fresh installations receive the complete dependency-ordered schema, while deployed databases add tables/functions without renaming historical migrations. Rollback is by a corrective forward migration because accepted commercial records are audit evidence.

The server owns the sponsorship plan, catalogue-driven categories, derived inventory, package/inventory allocations, prospects, applications, invitations, versioned proposals, append-only revisions, contracts, cash and separately valued in-kind contributions, branding placements, planned deliverables, feedback, idempotency requests and audit events. Phase 5 must be `ready_for_sponsorship`; Phase 6 completion produces only `ready_for_final_readiness`.

Player sponsors reuse canonical `companies` identities. Binding actions require canonical company/Festival authority and server-side quality, reputation, industry, currency, available-cash, reserve, marketing-capacity and solvency checks. NPC prospect refreshes are bounded/cooldown driven and admin sponsors remain trusted admin data. Deterministic compatibility combines audience, genre, Festival, reputation, capacity, community, relationship and risk scores; player companies receive a stronger community/relationship component, never an eligibility bypass.

Proposal acceptance is one database transaction: lock and revalidate versions, deadline, currency, compatibility, affordability, inventory and exclusivity; freeze a revision; create one contract; allocate inventory; create placements and planned deliverables; create separate cash/in-kind Festival receivables and a player-company outgoing reservation; audit and enqueue communications. Receivables are not cash, realised revenue, tax postings or settlement. In-kind operational coverage must be explicitly selected, meet requirement quality/quantity/timing, and never silently replace a supplier contract.

All commercial tables have RLS enabled and direct `PUBLIC`, `anon`, and `authenticated` access revoked. Festival managers see their plan; authorised sponsor representatives see only their own records; public opportunity RPCs expose package rules rather than competitor terms, balances, forecasts or scoring weights. Mutations use actor/action/Festival/target-scoped idempotency and entity versions with stable stale errors.

The responsive manager surface uses cards for inventory, packages, proposals and contracts; textual statuses, semantic headings, accessible alerts, non-truncating `en-GB` money, keyboard-operable actions and focused completion issues. Contract language explicitly says that funds transfer in a later settlement phase. Phase 6 does not activate branding, fulfil deliverables, open ticket sales, launch a Festival or run live simulation.

Known environment issue: `npm ci` may fail with inherited `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom`. Keep the lockfile unchanged and continue dependency-independent verification.
