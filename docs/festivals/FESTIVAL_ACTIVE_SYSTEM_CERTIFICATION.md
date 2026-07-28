# Festival active-system certification

**Evidence date:** 2026-07-28. **Generator:** `scripts/festivals/certify-active-system.mjs`.
The machine-readable evidence is [`festival-active-callers.json`](festival-active-callers.json). This report deliberately does not infer that a feature works from the existence of a component or SQL object.

## Verdict

The repository does **not** currently satisfy full-lifecycle certification. It contains a substantial canonical Festival-company domain and database harnesses, but the reachable application still exposes event-backed routes and direct browser writers. The executable gate therefore preserves these findings as an explicit baseline and refuses stale inventory or absent database fixture configuration; it does not silently skip fixtures.

## Route evidence

The generated inventory records all 28 Festival route declarations in source order, component, actor, parameter meaning, data/write boundary, flag, states, replacement, and disposition. Of particular importance, `/world/festivals` and `/world/festivals/:…` are each declared twice. React Router reaches the earlier legacy declarations, leaving the later canonical public components disconnected. `/company/:companyId` is a generic company route (company ID), not an edition or legacy Festival ID. No `/festival-company/new` or `/festival-company/*` route is registered; the only company setup entry point is `/companies/festivals/:festivalCompanyId/setup`.

Identifier validation is now executable in `routeIdentifiers.ts`: UUID and slug syntax is checked against one declared semantic kind. It intentionally does not probe unrelated tables. Existence, ownership, legacy-only and ambiguity decisions remain server repository/RPC responsibilities and must use the exported stable error vocabulary.

## Canonical and working

Only the following can be claimed without a disposable database run:

* The Festival-company setup, configuration, planning, artist, runtime, settlement and gig-adapter modules compile as an identifiable bounded domain.
* Static route coverage, one-domain parameter semantics, caller generation, direct-write detection and stale-evidence detection execute locally.
* Existing SQL harnesses provide executable coverage candidates for founding, editions, scheduling, applications/bookings, staffing/suppliers, sponsorship, ticketing, runtime, performance, settlement and recovery. `run-full-lifecycle-db-gate.sh` runs those real harnesses sequentially with `ON_ERROR_STOP=1`.

## Canonical but incomplete

* Canonical public directory/detail pages exist but are shadowed by duplicate legacy routes.
* Company setup is routed, but `/festival-company/new` and the requested `/festival-company/*` family do not exist.
* Canonical modules exist for ticketing, sponsorship, live operations, performance adapter and settlement, but their complete end-to-end connection cannot be certified without running the disposable database gate.
* No Festival upgrade catalogue was found by the executable SQL/source scan. Consequently **zero**, not 11, active Festival upgrade categories can be certified. Category names, bounded levels, deterministic costs, versioned effects, upkeep and rolling limits are untested/missing.
* Licence enforcement across duration, stages, slots, capacity, staffing, permits, insurance and site eligibility is distributed across harnesses; a single all-tier proof is absent.

## Legacy active

The player browser, marketplace, directory, detail, simulation, performance, owner console, session, calendar and run routes remain registered behind `LegacyFestivalGate`. The generated RPC map labels runtime callers separately from SQL definitions and test callers, and forces dynamic-wrapper review rather than declaring a function dead from literal search alone. Historical preparation, settlement and finalisation functions remain listed until a worker/RPC reachability review proves delegation.

## Duplicate and disconnected authority

* The duplicate `/world/festivals` declarations make the canonical public journey unreachable at that URL.
* Creation remains available through canonical founding and historical/admin surfaces; flag state and delegation must be resolved before either path is removed.
* Legacy scheduling, application/offer, runtime outcome, lifecycle and settlement writers overlap canonical RPC responsibilities. They are not certified as delegated.

## Unsafe

`frontendWrites` lists every statically visible Festival table mutation and RPC invocation. Direct mutations are classified `direct_write_requires_replacement`; examples include participation/performance results, attendance, finances, offers, stage slots and lifecycle status. These paths must be migrated to server-authoritative RPCs before the legacy flags can be enabled safely. Admin-looking browser writes are not automatically considered safe: authority, reason, expected version, idempotency key and audit creation require server enforcement.

## Broken

* Canonical public routes are shadowed.
* Requested Festival-company route aliases are absent.
* Full certification exits with status 2 when `SUPABASE_DB_URL` is absent rather than reporting a false pass.
* The approved 11-category upgrade plan has no discoverable active catalogue.

## Untested

Until `npm run test:festivals:certification` passes against a reset disposable database, do not certify: founding charge/idempotency; first edition and duplicate-year behavior; upgrade behavior; every licence tier; NPC fallbacks; full obligation semantics; ticket refunds/tax; deterministic runtime replay; gig modifiers; balanced multi-currency settlement; immutable snapshots; worker crash recovery; or complete owner/public/admin UI states. The current harness set also does not demonstrate every requested admin override contract or all external publication effects (World Pulse, FM, Twaater and news) in one transactionally linked fixture.

## Retirement manifest

The `retirement` array in the JSON is the manifest. It records candidate file, callers, replacement, migration need, prerequisite, follow-up PR, risk, verification and category. No data-bearing table is removed. “Unused” source is conservatively `investigate` because dynamic imports and unique behavior still require review; reachable legacy UI is `remove_after_route_migration`.

## Recommended next PRs

1. Remove route shadowing: make canonical public routes first-class, temporarily redirect old URLs, and add server-backed identifier resolvers returning the documented domain errors.
2. Replace every active direct browser gameplay/finance/outcome write with a canonical, idempotent RPC; then make duplicate-authority detection a zero-baseline gate.
3. Implement or identify the approved 11-category catalogue and add an executable catalogue/upgrade harness.
4. Consolidate creation and admin overrides behind versioned audited RPCs.
5. Reset a disposable database and close gaps in the sequential lifecycle fixture, especially NPC assignment, all licence tiers, deterministic replay, external effects and UI smoke states.
6. After production mapping/data snapshots, retire event-backed routes, workers and RPCs in the order recorded by the manifest.

## Commands

* `node scripts/festivals/certify-active-system.mjs` regenerates evidence.
* `npm run test:festivals:active-callers` verifies it is current.
* `npm run test:festivals:routes` verifies source route coverage and identifier syntax boundaries.
* `npm run test:festivals:full-lifecycle` runs the sequential SQL lifecycle against a safe disposable database.
* `npm run test:festivals:recovery` exercises the existing real recovery worker harness.
* `npm run test:festivals:certification` composes all gates and never skips missing fixtures.

## Canonical route certification

The active route registry is `src/features/festivals/routes.ts`. Certification normalises parameter names (for example, `:id` and `:festivalId`) and treats duplicates as a hard failure. Every canonical registry entry must be mounted once, route parameters must have declared domain semantics, removed discovery navigation must stay absent, and compatibility owner redirects must call the canonical resolver.

Canonical components are `PublicFestivalDirectory`, `PublicFestivalPage`, `PublicFestivalEditionPage`, `FestivalFoundingPage`, `FestivalCompanyHome`, and the shared `FestivalEditionShell`. Historical legacy detail reads are retained as read-only compatibility; legacy browser writes are disabled by default. Removal of the old browser, run wizard, standalone booking calendar and duplicate discovery UI requires redirect telemetry review and confirmation that no historical record still depends on it. Data-bearing tables are outside source-retirement scope.

## Festival upgrade implementation (catalogue v1)

Catalogue v1 defines the eleven stable keys documented in `FESTIVAL_UPGRADE_SYSTEM.md`, each with levels 1–5. Licence tiers are Local, Small, Medium, Large, and Major. The purchase boundary is `purchase_festival_company_upgrade`; construction and upkeep use `activate_completed_festival_upgrades` and `process_festival_upgrade_upkeep`; edition evidence uses `snapshot_festival_edition_upgrades`. Declared consumers cover planning, ticketing, runtime, and settlement, which must consume immutable edition snapshots. No legacy companies are automatically upgraded: migrated **0**, review **0** until the production provenance extraction runs. Outstanding legacy gameplay writers remain documented above.

The source catalogue coverage test passed during implementation. The disposable-database upgrade harness has **not passed in this environment** because no reset `SUPABASE_DB_URL` was supplied. Accordingly, this report does not certify database execution, purchase concurrency, upkeep recovery, or snapshot immutability yet.

## 2026-07-28 routing hotfix and artist-workflow evidence

PR #1366 removed the `FestivalsNew` lazy declaration but retained `<FestivalsNew />` in the `/festivals/simulation` route element. Because React constructs every route element while `App` renders, that undeclared identifier caused the application-wide blank screen even away from Festival URLs. The retired simulation URL now uses `PreserveQueryRedirect` and the typed `festivalRoutes.publicDirectory()` builder, preserving its query string while resolving to `/world/festivals`; it no longer mounts a legacy Festival writer.

Two independent controls now protect the boundary. `App.routeRender.test.tsx` server-renders the real `App` provider and route tree for the public directory, both discovery aliases, founding, company, upgrades, editions and edition-detail URLs. The isolated node configuration is intentional because the repository's installed jsdom dependency graph is incomplete. Separately, `route-component-certification.mjs` parses Festival route JSX with the TypeScript AST and rejects any capitalised component identifier without a top-level import or declaration. Its negative fixture demonstrates the former `FestivalsNew` failure class.

The canonical artist aggregate remains `festival_artist_applications` together with its application windows, invitations, offers, bookings, request receipts, audit and communications records. Active application/invitation mutations call the Phase 4B RPC repository boundary (`submit_festival_artist_application`, `withdraw_festival_artist_application`, `review_festival_artist_application`, `send_festival_artist_invitation`, and `respond_to_festival_artist_invitation`) rather than mutating those tables from browser code. The generated caller inventory records these readers, writers and remaining unrelated direct Festival writers; those remaining writers are not certified or broadened by this hotfix.

Source tests and the production build are recorded in the PR validation. Database certification remains **incomplete**: this environment supplied no safe reset `SUPABASE_DB_URL`, so neither `festival_artist_applications_bookings_harness.sql` nor `festival_upgrade_harness.sql` was represented as executed successfully. The certification gate continues to fail rather than silently skip when that disposable database is absent.
