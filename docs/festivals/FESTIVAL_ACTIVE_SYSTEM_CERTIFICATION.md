# Festival active-system certification

**Evidence date:** 2026-07-28. **Generator:** `scripts/festivals/certify-active-system.mjs`.
The machine-readable evidence is [`festival-active-callers.json`](festival-active-callers.json). This report deliberately does not infer that a feature works from the existence of a component or SQL object.

**Artist workflow review (2026-07-30):** the opportunity page now exposes persisted applications and invitations, lets the active profile choose any represented band, displays structured server eligibility failures, and sends apply, withdraw, accept, and decline commands exclusively through the repository RPC boundary. The active-writer inventory classifications are `canonical_rpc`, `legacy_rpc`, `direct_write_requires_replacement`, `compatibility_read`, `unused`, and `remove_after_migration`; application UI may not introduce a table mutation. See [`FESTIVAL_APPLICATION_SYSTEM.md`](FESTIVAL_APPLICATION_SYSTEM.md) for the aggregate and transition contract.

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

## 2026-07-30 annual-edition scheduling authority

The active legacy stage console no longer writes `festival_stages` or `festival_stage_slots` directly. Its transitional adapters are classified `legacy_rpc`; they resolve a canonical edition before server-side permission, aggregate locking, idempotency, contract, NPC and audit checks. Canonical scheduling mutations remain `canonical_rpc`, public/session/calendar consumers are `compatibility_read`, administrator repair is `admin_only`, and unreferenced generations are `unused` or `remove_after_migration` in the generated inventory.

The canonical stage/slot schemas were extended rather than duplicated. Full occupancy now spans setup through clearance and a database exclusion constraint serialises concurrent stage overlap. Direct authenticated writes to stages, slots, items and revisions are revoked. Publication continues through immutable revision snapshots. Runtime simulation and performance scoring remain explicitly out of scope.

The new scheduling database gate was not reported as passing in this environment: no explicitly disposable `SUPABASE_DB_URL` was supplied. The gate refuses execution unless both repository safety checks and `FESTIVAL_TEST_DATABASE_DISPOSABLE=true` are present. Existing artist, upgrade and full-lifecycle gates must likewise be recorded independently and a refusal is not success.

## 2026-07-30 authoritative annual-edition runtime

Merged PR #1440 is commit `62829ed`; its final scheduling migration supplies edition-scoped stages/slots, setup-to-clearance exclusion intervals, server-authoritative contract assignment, overlap fencing, revoked direct writes and stable IDs. The new runtime references that revision and does not duplicate scheduling objects or use `game_events` as authority.

Active runtime browser writes are `canonical_rpc`: preparation, transition, and the secured control-room read. Runtime tick execution is `canonical_worker`. Existing launch-runtime functions are `legacy_rpc` or `compatibility_read` for historical settlement and are `remove_after_migration`, not competing new-edition authority. Generic admin inspection is `admin_only`. Any table mutations listed by the generated inventory retain `direct_write_requires_replacement`; unreferenced historical simulations remain `unused`.

The owner live route now renders a real controlled-polling projection with runtime time/state, gates, conserved attendance/capacity, preserved weather warning, stage/artist status, readiness, incidents, unposted sales evidence, satisfaction, blockers and recent events. Direct authoritative table subscriptions and browser outcome calculation are absent.

Database execution remains unclaimed: `run-edition-runtime-db-gate.sh`, `run-upgrade-db-gate.sh`, `run-artist-applications-db-gate.sh`, `run-scheduling-db-gate.sh`, and `run-full-lifecycle-db-gate.sh` were each refused/not executed because this environment did not explicitly confirm a disposable database. Static/domain/build results are recorded in the PR validation.

## 2026-07-30 — canonical edition settlement certification delta

| Surface | Classification | Certification |
|---|---|---|
| `prepare_festival_edition_settlement` | `canonical_rpc` | schema/static verified; disposable DB execution pending |
| `approve_festival_edition_settlement` | `canonical_rpc` | schema/static verified; disposable DB execution pending |
| `post_festival_edition_settlement` | `canonical_rpc` | shared finance ledger, unique line receipts and recovery batch; DB execution pending |
| edition settlement owner workspace | `compatibility_read` + canonical RPC commands | route active; build pending |
| public immutable edition projection | `compatibility_read` | anonymous redacted RPC only |
| legacy settlement RPC family | `legacy_rpc` | must not receive canonical edition runtimes |
| outcome/fame/reward application | `canonical_worker` | audience/eligibility/achievement evidence only; shared-service application uncertified |
| platform-admin reopen/correction | `admin_only` | intentionally not exposed; uncertified |
| direct browser financial/history writes | `direct_write_requires_replacement` | no active canonical writer; certification inventory guard required |

The migration and static timestamp check ran in this workspace. Database harnesses were **not executed** because no explicitly confirmed disposable `SUPABASE_DB_URL` was provided; Festival database certification is therefore not claimed. Per-artist/sponsor satisfaction, shared fame/fan/reward application, admin replacement versions, downloadable statements, rankings/awards and full legacy import remain uncertified functionality.

## PR #1442 remediation status

The settlement posting protocol now commits one finance item per RPC and derives recovery totals from persisted evidence. The readiness and typed repository paths have deterministic Node coverage. Full Festival database certification is **incomplete until an explicitly disposable reset database is supplied and every listed database gate actually runs**; safety-guard refusal is retained as a non-pass result.

### Validation run 2026-07-30

`run-settlement-db-gate.sh` and `run-full-lifecycle-db-gate.sh` refused to run because `SUPABASE_DB_URL` was not set. Consequently no disposable reset database was identified and database certification is not claimed. The upgrade, artist-application, scheduling and runtime database gates share that missing prerequisite and were not represented as passes.

## 2026-08-02 Phase 10B certification closure evidence

**Implementation under test:** `4b32de0` (`fix(festivals): restore phase 10 certification gates`), based on `ce1f156`. **Workflow:** `Festival & Touring Integration Gate` (`Touring integration`, `Festival static certification, lint and build`, and `database-lifecycle` jobs). General CI remains `.github/workflows/ci.yml`.

The earliest locally reproduced failure was `npm test -- --run --maxWorkers=1`, before test collection, with `RangeError: options.minThreads and options.maxThreads must not conflict`. This is worker-pool configuration, not Festival/touring application behaviour, fixture data, authentication, database state, seeding, timing, or cleanup. Adding an explicit shared `minWorkers: 1` makes the requested serial maximum valid and deterministic. The regression command `node --test scripts/festivals/vitest-serial-certification.test.mjs` verifies the supported configuration rather than weakening an application assertion.

| Command | Result | Evidence / count |
|---|---|---|
| `node --test scripts/festivals/vitest-serial-certification.test.mjs` | PASS | 1 test |
| `npm test -- --run --maxWorkers=1` | BLOCKED in this workspace | Reproduction reached the worker error; clean reinstall was then blocked by registry HTTP 403. CI performs `npm ci` in a clean runner. |
| `npm run test:touring` | Pending CI clean install | Hard-gated independently; no skips. |
| `npm run test:festivals` | Pending CI clean install | Hard-gated independently; no skips. |
| `npm run test:e2e:festival:pr` | Pending CI/browser environment | Existing London fixture. |
| `npm run test:e2e:festival:main` | Pending CI/browser environment | Complete `tests/festivals` directory. |
| `npm run certification:festival-phase10` | Pending CI clean install | Touring, focused Festival and static certification composition. |
| `npm run lint:ci` / `npm run typecheck` / `npm run build` | Pending CI clean install | Festival static job remains hard-failing. |
| disposable database lifecycle and radio seed regression | Pending CI Docker/Supabase | `database-lifecycle` remains hard-failing and performs two clean deterministic replays. |

The only local limitation is dependency registry policy (`403 Forbidden` for `@types/aria-query` during `npm ci`); it is environmental and does not change, skip, soften, or suppress a gate. No known application limitation is waived. No Festival gameplay, rewards, settlement values or balancing changed in Phase 10B.
