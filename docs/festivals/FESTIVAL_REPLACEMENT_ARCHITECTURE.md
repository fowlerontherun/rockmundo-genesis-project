# Festival Replacement Architecture

Status: **PR1 — safe boundary only. No gameplay changes.**

## 1. Why replace

The current festival domain contains overlapping public browser,
marketplace, directory, simulation, live-performance, owner-console,
calendar, run-wizard and admin routes plus 60+ database tables. Several
flows are partially implemented, some settlement math is client-side, and
navigation exposes at least three parallel entry points. Incremental
patching preserves conflicting behaviour and blocks the VIP-owned
festival-company design the product team has approved.

## 2. Product direction (target state)

A festival is a special **company type**:

- VIP-only founding, $2,000,000 personal-balance cost, atomic server txn.
- Own company balance + personal→company transfers.
- One recurring **annual edition** per game year.
- 11 upgrade categories, levels 1–50, max 2 upgrades per rolling 30 days.
- Player-invited stage managers, hourly slots 13:00–22:00, 40–50 min
  regular sets, 60–90 min 22:00 headliner.
- Band applications → offers → immutable contracts → reserved fees.
- NPC fallback acts for empty slots.
- Reuse of the canonical gig performance engine + festival modifiers.
- Server-authoritative settlement, immutable history, versioned scoring.

## 3. Current-system dependency map (summary)

| Layer | Legacy surface | New surface |
|---|---|---|
| Routes | `/festivals`, `/festivals/marketplace`, `/festivals/directory`, `/festivals/simulation`, `/festivals/:id`, `/festivals/:id/manage`, `/festivals/:id/manage/editions/:editionId`, `/festivals/sessions/:sessionId`, `/festivals/:id/calendar`, `/festivals/:id/run`, `/festivals/perform/:participationId`, `/world/festivals`, `/admin/festivals` | `/world/festivals` (directory), `/company/:companyId` (owner console via company type), `/festival-company/*` (new module screens) |
| Feature modules | `src/features/festivals/{admin,booking,outcomes,performance,scheduling,settlement}` | `src/features/festival-company/*` |
| Tables (63) | `festivals`, `festival_editions`, `festival_stage_slots`, `festival_applications`, `festival_contract_*`, `festival_permits`, `festival_insurance_policies`, `festival_performance_*`, `festival_settlement_*`, etc. | New schema under `festival_company_*` prefix (PR2+), plus retained bridge tables where the mapping is proven safe. |
| RPCs | 40+ (`create_festival_edition`, `transition_festival_edition`, `prepare_festival_edition_settlement`, `apply_festival_settlement_batch`, `festival_edition_operations_summary`, `admin_festival_catalogue`, etc.) | New RPCs prefixed `festival_company_*`. Legacy RPCs remain callable while flag is on. |
| Edge fn | `generate-festival-poster` | Retained (marked reuse). |

Full item-level classification lives in
`docs/festivals/festival-domain-inventory.json`.

## 4. Bounded contexts (new module)

- **Festival Company** (aggregate root) — company row + balance + owner + upgrades.
- **Annual Edition** (child aggregate) — dates, site, vibe, environmental
  policy, stages, slots, applications, offers, contracts, tickets, results.
- **Scheduling** — stages + hourly slots + activity blocking.
- **Booking** — applications → offers → contracts → reservations.
- **Performance** — adapter over gig engine + festival modifiers.
- **Finance** — company ledger + reservations + settlement.
- **History** — immutable snapshots per edition and per band appearance.
- **Permissions** — owner, invited stage manager, platform admin.

## 5. Canonical route structure (target)

```
/world/festivals                          public directory
/world/festivals/:festivalId              public festival page
/world/festivals/:festivalId/:editionId   public edition page
/company/:companyId                       owner console (festival = company type)
/festival-company/new                     founding wizard (VIP + feature gate)
/festival-company/:id/editions/:editionId owner edition console
/festival-company/:id/editions/:editionId/schedule
/festival-company/:id/editions/:editionId/finance
/festival-company/:id/editions/:editionId/history
/admin/festivals                          admin diagnostic + catalogue
```

## 6. Database ownership

Legacy tables remain untouched in PR1. New context introduces (PR2+):

- `festival_company_profiles`
- `festival_company_editions`
- `festival_company_upgrades`, `festival_company_upgrade_history`
- `festival_company_stages`, `festival_company_stage_slots`
- `festival_company_applications`, `festival_company_offers`, `festival_company_contracts`
- `festival_company_tickets`, `festival_company_finance_ledger`
- `festival_company_edition_history`, `festival_company_band_appearances`

## 7. Festival company vs annual edition

The festival **company** persists year-round: balance, upgrades, staff
relationships, reputation. The annual **edition** owns per-year mutable
state: dates, site, lineup, tickets, settlement. Completed editions
become read-only snapshot rows.

## 8. Authority boundaries

| Actor | Company | Upgrades | Edition planning | Stages | Slots | Money | Settlement |
|---|---|---|---|---|---|---|---|
| Owner | full | full | full | full | full | full | trigger |
| Invited stage manager | none | none | none | assigned only | assigned only | view stage budget | none |
| Platform admin | audit + override | audit | audit + override | audit | audit | audit | override |

Enforced via `has_role` + explicit company-ownership joins in every RPC.

## 9. Integrations

- **Companies**: festival = new company type. Reuses ownership,
  employees, transactions, taxation.
- **VIP**: `has_active_vip(profile_id)` checked server-side before wizard
  step 1 unlocks and before founding txn commits.
- **Personal finance**: transfers via existing atomic wallet primitives.
- **Bands**: application/offer/contract mirrors gig-offer patterns.
- **Scheduling**: uses canonical activity-blocking service. No festival
  fork.
- **Gigs**: performance adapter calls the shared gig engine (no
  duplication).

## 10. Immutable snapshot strategy

Settled editions freeze into snapshot rows carrying `formula_version`,
`scoring_version`, `resolved_at`, `settled_by`. History screens never
recompute — they render snapshots. Balancing changes only affect future
editions.

## 11. Feature-flag rollout

Flags in `src/features/festival-company/config/featureFlags.ts`:

- `legacyFestivalSystemEnabled` (default **true**) — while true, all legacy
  routes behave exactly as today.
- `newFestivalSystemEnabled` (default false) — enables the new module.
- `festivalCreationEnabled`, `festivalApplicationsEnabled`,
  `festivalLivePerformanceEnabled` — sub-flags to stage rollout inside
  the new module.

Every legacy festival route is wrapped in `<LegacyFestivalGate>`. When
the legacy flag is disabled, the gate renders
`FestivalRebuildingScreen` — no redirect loops, no blank screens.

## 12. Legacy-data strategy

1. **Preserve.** No destructive migrations in PR1.
2. **Bridge tables** in PR2+ map legacy IDs → new IDs where mappings are
   provably 1:1 (see `festival_legacy_mappings`, extended).
3. **Snapshot import.** Completed legacy editions are imported as
   immutable history rows only when their financial data is settled.
4. **Archive.** Once new system is stable, legacy tables are renamed into
   an `archive_festivals_*` namespace.
5. **Drop.** Destructive drop happens in a dedicated PR after one full
   release cycle without runtime callers.

## 13. Safe table-retirement process

See `docs/festivals/FESTIVAL_DATABASE_RETIREMENT_PLAN.md`.

## 14. PR sequence

1. **PR1 (this)** — Isolate & document.
2. Festival company type + $2M atomic founding + VIP check.
3. Configuration wizard + annual editions.
4. Upgrade categories + cooldowns + annual costs.
5. Stages, managers, permissions, slot calendar.
6. World directory + band applications.
7. Offers, contracts, budget reservations, activity blocking.
8. NPC fallback acts.
9. Gig-engine integration + festival rewards.
10. Tickets, operational finances, settlement.
11. Festival + band history (immutable snapshots).
12. Legacy data retirement + table removal.

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Silent breakage of `/world/festivals` navigation | Route tests + LegacyFestivalGate covers every entry. |
| Legacy RPC still called after new module ships | Inventory JSON tracks every RPC and its callers. |
| Users lose in-flight festivals | Non-destructive migration order; snapshot import before drop. |
| Client-authoritative settlement re-appears | ADR-0003 + review gate; tests fail on new client-side settlement code. |
| Scoring formula changes rewrite history | ADR-0004: versioned snapshots. |
| VIP bypass | ADR-0003: server-side `has_active_vip` gate at RPC boundary. |

## 16. Definition of done (PR1)

- Legacy routes still work when flag is on.
- Every legacy festival route is either wrapped in the gate or explicitly
  listed as intentionally exempt in the inventory.
- Inventory, retirement plan and ADRs committed.
- Tests cover flag behaviour, gate rendering, route registry drift, and
  non-festival smoke.
- Version bumped, history updated.

## 17. PR2 secure VIP festival founding foundation

PR2 introduces `festival` as a canonical company type and adds the first server-authoritative company founding path. Festival founding is deliberately not wired through the legacy browser-controlled `useCreateCompany` sequence because that generic path still reads cash, deducts cash, inserts the company, inserts ledger rows and attempts refunds from the browser. That remains known company-creation security debt for non-festival companies.

### Replacement schema

New replacement tables are `festival_companies`, `festival_editions_v2`, `festival_company_audit_log` and `festival_company_founding_requests`. Legacy festival tables are intentionally retained and untouched until migration and retirement PRs can prove data parity.

### RPC and authority boundary

`public.found_festival_company(p_public_name, p_company_name, p_description, p_idempotency_key)` owns festival founding. The browser sends only names, optional description and an idempotency key. It cannot send owner IDs, VIP status, company type, founding price, starting balance, tax rate or weekly cost.

### VIP source of truth

The RPC checks `vip_subscriptions` for an entitlement whose status is active or cancelled-but-unexpired, with `starts_at <= now()` and `expires_at > now()`. It also honours the existing `profiles.is_vip` compatibility flag used elsewhere in the app for admin/test/lifetime-style entitlement sync.

### Money semantics

All values are whole USD game dollars, matching `profiles.cash`, `companies.balance` and `company_transactions.amount`. The founding charge is exactly `$2,000,000`, deducted from personal cash as a setup expense. The new company starts with `$0`; the fee is not minted into company balance and owner funding transfers are deferred.

### Atomic sequence and idempotency

The RPC runs in one PostgreSQL transaction: authenticate, lock the active profile row with `FOR UPDATE`, validate VIP and cash, reserve/check idempotency, deduct cash, create the `companies` row with `company_type = 'festival'`, create the festival extension, add founder shareholder ownership, write the company transaction, write audit events and persist the idempotent result. Repeating the same key with the same payload returns the original IDs and balance without a second charge. Reusing the key with different input raises `idempotency_conflict`.

### RLS

All replacement tables have RLS enabled. Owners can read their own festival company, draft editions and audit/founding records. Admins use the canonical `has_role(auth.uid(),'admin')` helper. Direct client inserts and broad public reads are not opened in this PR.

### Frontend entry point

`src/features/festival-company` now contains the typed founding repository, React Query mutation and eligibility card. My Companies exposes the VIP-only card and setup placeholder route at `/companies/festivals/:festivalCompanyId/setup`, guarded by `newFestivalSystemEnabled` and `festivalCreationEnabled` rather than `LegacyFestivalGate`.

### Next PR

The next PR should build the festival configuration wizard and first annual edition creation. Month, location, vibe, site type, duration, environmental policy, applications, stages, lineups, tickets and simulation remain non-goals here.

## 18. PR3 foundation hardening before configuration wizard

PR3 repairs the security, retry and accounting foundations introduced by PR2 before any month/location/vibe/site wizard depends on them.

### Active profile source of truth

Festival founding and setup reads now use the existing `public._caller_profile_id()` helper. That helper is the canonical database boundary already used by game banking RPCs because it delegates to `current_profile_id()` when available and only then falls back to profile lookup. The founding RPC locks exactly that profile row and rejects missing or invalid active characters with `profile_not_eligible`; it no longer chooses the newest active profile.

### Company-limit rule

Festival companies count as normal top-level owned companies. The database counts `companies` for the authenticated owner where `parent_company_id IS NULL`, `status NOT IN ('dissolved','bankrupt')` and `is_bankrupt = false`. The default limit is read from `game_config.config_key = 'festival_company_creation'` (`company_limit`, currently `3`) and `found_festival_company` raises `company_limit_reached` before deducting cash.

### Server rollout configuration

Vite flags remain useful for route visibility, but creation authority now lives in `game_config.config_key = 'festival_company_creation'`. Both `new_festival_system_enabled` and `festival_company_creation_enabled` must be true or direct RPC calls return `festival_creation_disabled`.

### Idempotency concurrency behaviour

Retries are serialized with a transaction-scoped advisory lock derived from the authenticated user and idempotency key. A completed same-payload retry returns the stored result plus `idempotent: true`; a changed payload returns `idempotency_conflict`; a still-processing same-key request returns `festival_request_in_progress`. The previous global `unique_violation => festival_name_taken` handler was narrowed so public-name/slug duplicates are classified separately from unrelated integrity failures.

### Founding-fee accounting and personal ledger

The `$2,000,000` founding fee is a personal expense. The company still starts with `$0`, and the hardened RPC does not insert an ordinary `company_transactions` expense. Instead it inserts one canonical `financial_transactions` debit using the dedicated `festival_company_founding_fee` category with metadata linking the festival company and company. Legacy PR2 founding rows in `company_transactions` are reclassified to non-P&L `investment` rows only when matched by `festival_companies.company_id`, `related_entity_id` and `related_entity_type`; no broad description-only deletion is performed.

### Setup page authorisation

`/companies/festivals/:festivalCompanyId/setup` now loads data through `get_festival_company_setup(p_festival_company_id)`. The RPC resolves the caller profile, checks owner/admin permission server-side, and returns only the setup-shell fields required by React. Non-owners receive a generic unavailable/not-found outcome so private UUID existence is not revealed.

### Tests and remaining debt

This PR adds a DB hardening harness covering the RPC definitions, idempotency strategy, server feature flag, setup RPC authorisation and accounting semantics, plus React/TypeScript coverage for typed setup retrieval and rendered setup states. The complete festival configuration wizard and first annual edition creation remain the next PR.

### Next PR

The next PR should implement the festival configuration wizard and first annual edition creation. Month, country/city, vibe, site type, duration, environmental policy and initial edition creation belong there; stages, bookings, tickets, simulation, settlement and legacy-table deletion remain later programme work.

## PR #1279 financial and rollout correction

The PR #1279 hardening review identified that `found_festival_company` updated `profiles.cash` and then called `finance_debit_owner`. The finance implementation was inspected in `20260717090000_finance_phase1_ledger.sql`: `finance_debit_owner` delegates to `finance_transfer`, creates a completed `financial_transactions` row, updates the source and destination `financial_accounts.current_balance_minor`, inserts balanced ledger entries, locks the financial accounts with `FOR UPDATE`, rejects insufficient financial-account balances for non-system accounts, uses minor units, and returns the transaction id. It does not update `profiles.cash`.

Festival founding now treats `profiles.cash` as the visible whole-USD profile balance and `financial_transactions` as the canonical minor-unit finance ledger for the same personal founding charge. The required $2,000,000 founding cost is represented as `2000000` in `profiles.cash` and `200000000` in `financial_transactions.gross_amount_minor` / `net_amount_minor`. The festival company starts with `companies.balance = 0`, `weekly_operating_costs = 0`, and no company operating expense or operating loss is posted for the founding fee.

Idempotency is successful-result idempotency only. Failed attempts raise and roll back the request row with the rest of the transaction. Successful requests persist `result`, `completed_at`, the company ids and the resulting personal cash; retries with the same request hash return the saved result, while changed payloads raise `idempotency_conflict`. The personal ledger reference remains `festival-company-founding:<idempotency-key>` and relies on the existing unique `financial_transactions.idempotency_key` constraint.

Rollout capabilities are separated and server-authoritative: `new_festival_system_enabled`, `festival_company_creation_enabled`, `festival_company_management_enabled`, and `festival_configuration_enabled`. A new migration only inserts defaults when the config row is absent and only fills missing JSON keys on existing rows, preserving administrator choices and defaulting replacement festival features to disabled.

Company-limit checks now flow through `can_profile_found_company(profile_id, 'festival')` and `company_ownership_limit`. The rule is scoped to the active profile's user, counts normal top-level active/suspended companies, excludes subsidiaries, dissolved companies and bankrupt companies, does not add a VIP allowance, and counts festivals as ordinary top-level companies unless future game design changes the helper.

Operational diagnostic for PR #1279 deployments: identify possible double-visible-charge cases by joining successful `festival_company_founding_requests`, `festival_companies`, and `financial_transactions` with idempotency keys matching `festival-company-founding:<request key>`, then compare profile balance-history evidence from any production audit source available to administrators. Do not refund automatically unless a one-to-one duplicate debit is proven from the founding request, festival company, transaction reference and profile balance history.

The executable gate added for this correction is `supabase/tests/festival_company_financial_correctness_harness.sql`. It verifies the deployed RPC shape, rollout capability contract, financial idempotency uniqueness and currency-unit mapping. The next feature PR after this gate remains the configuration wizard and first annual edition creation.

## PR #1281 runtime gate: founding money, capabilities and listing

This gate corrects the PR #1280 source-inspection harness: financial correctness is no longer claimed from `pg_get_functiondef` string checks. The runtime harness in `supabase/tests/festival_company_financial_correctness_harness.sql` creates real auth users, active and inactive profiles, VIP entitlement, finance accounts and rollout configuration, then calls `public.found_festival_company(...)` and verifies persisted rows and balances.

### Authoritative player-money source

The finance audit found that Phase 1 finance migrations define `financial_accounts.current_balance_minor` / `available_balance_minor` as the canonical spendable wallet for player money. `profiles.cash` is a whole-USD legacy compatibility projection used by older UI and gameplay code. `finance_transfer`, `finance_debit_owner` and `finance_credit_owner` lock `financial_accounts`, enforce non-system insufficient-funds checks, create immutable `financial_transactions`, and write balanced `financial_ledger_entries`. They do not update `profiles.cash` themselves.

Answers to the source-of-truth review:

1. `profiles.cash` is not the new authoritative spendable balance; it remains a visible legacy projection.
2. The player-owned primary `financial_accounts` row is authoritative for migrated finance-domain personal cash.
3. They are not intended to be two separately spendable festival wallets.
4. `profiles.cash` is a compatibility mirror/projection of the canonical finance account for this flow.
5. The new reusable `finance_debit_player_personal_cash(...)` bridge mutates finance once and updates the projection atomically in the same transaction.
6. Ordinary legacy gameplay purchases still vary: some older flows update `profiles.cash`, while finance-domain flows use `finance_transfer`/`finance_debit_owner`/`finance_credit_owner`; harmonising every purchase remains finance migration debt.
7. Existing personal-cash UI primarily displays active-profile `cash`; festival eligibility now reads the authoritative finance balance from the server and treats malformed responses as disabled.
8. Festival founding debits the player primary finance account once through the finance service.
9. During the wider migration the two balances can differ temporarily for legacy flows, but a festival founding success projects the canonical post-transaction balance back to `profiles.cash`.
10. PR #1280's direct `profiles.cash` update plus `finance_debit_owner` call was economically unsafe because it could charge two independent spendable stores or fail one store after the other appeared sufficient.

### Final single-debit mechanism

`found_festival_company` no longer directly subtracts the founding fee from `profiles.cash`. It creates the company/festival rows inside the same transaction, then calls `finance_debit_player_personal_cash(...)`, which performs exactly one canonical `finance_debit_owner('player', profile_id, 200000000, 'festival_company_founding_fee', ...)` debit and projects the resulting finance balance back into `profiles.cash`. A player wallet starting at `1,000,000,000` minor units (`$10,000,000`) ends at `800,000,000` minor units (`$8,000,000`). The festival company still starts with `$0`, and the founding fee does not create a company operating expense.

### Runtime and rollback verification

The festival runtime gate covers successful founding, same-key retry, changed-payload conflict, duplicate names, anonymous access, capability totality and a test-only late rollback triggered with the transaction-local `app.festival_foundation_fail_after_extension` setting. The rollback assertion proves money movement, company rows, festival extension rows, shareholder rows, founding request rows, audit rows and financial events do not survive the failed transaction. The gate command is `npm run test:festivals:company-runtime`; it fails clearly when `psql` or `SUPABASE_DB_URL` is missing.

Concurrent idempotent retries are serialized by `pg_advisory_xact_lock(user_id || ':' || idempotency_key)`. Because the request row is inserted and committed in the founding transaction, a waiting same-key retry should observe the committed `succeeded` request and return the stored result with `idempotent = true`; the previous `festival_request_in_progress` expectation is not documented as the normal concurrent outcome.

### Capability and eligibility design

`festival_company_capabilities()` is total and disabled-by-default even if the `game_config` row is missing. Authenticated UI uses `get_festival_company_founding_eligibility()` to read server-authoritative system, creation, management and configuration flags plus active-profile-only ownership capacity, VIP eligibility, canonical personal balance, founding cost and affordability. The founding RPC repeats every validation inside the write transaction.

### Festival company listing and navigation

Owned festival listings no longer rely on an optional client-side `Company.festival_company_id` alone. `get_owned_festival_companies()` joins `festival_companies` to `companies` and returns `festivalCompanyId`, public festival name, legal company name, setup status, configuration completeness, first-edition existence, company balance and management availability. The Festivals tab renders a dedicated festival company card and navigates with `festival_companies.id`.

### Company-limit scope

The generically named PR #1280 helpers overstated their scope because their limit came from festival configuration. This PR introduces honest `festival_company_ownership_limit` and `can_profile_found_festival_company` helpers, keeps the old wrappers for compatibility, and documents that generic company, holding-company, VIP allowance and subsidiary limit harmonisation remains future company-system debt.

The next PR can now implement the festival configuration wizard and first annual festival edition without adding month, country, city, date, vibe, site, duration, booking, ticketing, staffing, simulation or settlement work to this runtime gate.

## Corrective runtime gate and finance bridge security (PR #1282)

PR #1281 introduced the first RPC-driven runtime harness, but that harness was not executed during generation and its concurrency script was a placeholder that only checked the capabilities RPC. This corrective PR replaces that placeholder with a real two-session same-user, same-profile, same-idempotency-key founding race that enables transaction-local fixture mode and pauses one session after the advisory lock.

The executable gate now runs the Supabase RPC contract verifier before the SQL founding harness and the concurrency gate. The successful runtime fixture starts the authoritative player financial account at `1,000,000,000` minor units (`$10,000,000`) and asserts it ends at `800,000,000` minor units (`$8,000,000`) after exactly one `festival_company_founding_fee` financial transaction and two balanced ledger entries. The profile `cash` column remains only a compatibility projection of that canonical balance. The rollback-after-debit test enables a transaction-local test hook after the canonical finance debit and asserts that the account balance, `profiles.cash`, financial transaction, ledger entries, company row, festival extension, shareholder row, audit rows and founding request all roll back.

The finance bridge `finance_debit_player_personal_cash(...)` is an internal `SECURITY DEFINER` primitive. Execute permission is explicitly revoked from `PUBLIC`, `anon` and `authenticated`; browser clients cannot call it directly with arbitrary profile IDs, categories or amounts. The `found_festival_company(...)` security-definer RPC can still call the primitive internally, so festival founding still performs exactly one canonical debit. Test-only failure and delay hooks are ignored unless `app.allow_test_fixtures = true` is set transaction-locally by the database harness.

The generic compatibility wrappers `company_ownership_limit(...)` and `can_profile_found_company(...)` no longer silently route non-festival callers through festival rollout configuration. Festival code uses `festival_company_ownership_limit(...)` and `can_profile_found_festival_company(...)`; the generic wrappers are deprecated and direct client execute permission is revoked.

Frontend integration now uses generated Supabase RPC type entries for the festival capabilities, eligibility, owned-listing and finance bridge functions rather than `as never` casts for the new festival RPCs. Runtime response parsing fails closed for malformed capabilities, eligibility, setup, owned-listing and founding-result payloads. Successful founding invalidates companies, owned festival companies, founding eligibility, capabilities, active profile, cash balance and the new setup query. Until the owner console exists, every festival company card action routes to `/companies/festivals/:festivalCompanyId/setup`; completed companies show the truthful `View setup summary` label.

Remaining finance-system migration debt outside festivals: older non-festival gameplay still contains legacy direct `profiles.cash` mutations and should be migrated to the canonical finance service in dedicated finance PRs. The next replacement-festival PR should implement the festival configuration wizard and first annual edition after this runtime gate remains green.
# Phase 2 planning boundary (2026-07)

Festival configuration, site planning, stages, calculated facility summaries and readiness are separate concepts. `festival_site_plans` is the aggregate root and retains a canonical `venues` foreign key only for existing venues; temporary/open-land plans do not pollute the venue catalogue. `festival_stages` contains operational planning details but no artist schedule. Scale limits remain catalogue data. Individual stages cannot exceed usable capacity, but aggregate capacities may because visitors circulate; server-derived concentration metrics communicate the resulting scheduling risk.

The owner/admin RPC boundary is `get_festival_site_plan(uuid)` and `save_festival_site_plan(uuid, integer, jsonb, jsonb, uuid, boolean)`. The save validates the Phase 1 prerequisite, city, active-compatible canonical venue, scale capacities, stage count, exactly one main stage, hours and accessible capacity. It calculates facility estimates and `ready_for_ticketing`; clients cannot assert either. Version predicates prevent stale overwrites. Normalised stage order participates in the deterministic request hash, and successful idempotency receipts plus one audit event prevent duplicate stages, versions and audits. Direct browser writes are revoked and RLS fails closed.

The migration is intentionally `20291217130000_festival_site_and_stage_planning.sql`. It follows the retained 2029 configuration anomaly so fresh installs never reference Phase 1 before it exists and deployed databases receive a forward-only addition. The verifier has an exact-name exception—not an open future-date range. This is the sole approved continuation of that legacy sequence.

Facility figures (toilets, medical and water points, security, bars, vendors, accessible viewing, backstage, parking and transport) are planning estimates based on capacity and stage count. Supplier, staffing, finance, contract, booking, ticketing and artist records remain outside Phase 2.

Roadmap: Phase 1 identity/location/scale/dates is complete; Phase 2 site/stages is this change; Phase 3 ticketing; Phase 4 artist applications/bookings; Phase 5 staffing/suppliers; Phase 6 sponsorship; Phase 7 readiness/launch; Phase 8 live simulation/settlement. The inherited npm registry/lockfile installation issue remains an environment limitation and does not relax SQL/static verification.

## Phase 3: ticket planning boundary

Festival ticket planning is intentionally isolated from transactional sales. `festival_ticket_plans` owns canonical currency, tax/fee assumptions, purchase limits, deterministic demand assumptions, readiness and versioning. Products distinguish admission, upgrade and add-on classes; only admission products expand over their canonical single-day/date-range/full-Festival dates and consume the Phase 2 `usable_capacity`. Daily allocation rows include reserved operational and complimentary capacity in oversell checks. Planned release phases may overlap only for distinct eligibility groups; phases without distinct eligibility are sequential, ordered deterministically, and their per-product total cannot exceed product capacity.

All money uses integer minor units and all rates use basis points. Server forecasts derive maximum face-value revenue, expected sales/gross receipts, customer/company fees, tax, refunds, net receipts and daily utilisation. They are planning forecasts—not earned revenue—and create no ledger, payment, purchase, issued-ticket, public-sale, announcement or scheduled-job record.

The RPC boundary resolves currency from the configured home-city country, expands product dates, reads site capacity and Phase 2 status server-side, and returns structured issues. Owner/admin access, fail-closed RLS, optimistic version predicates, normalised idempotency hashing and audit rows follow Phases 1–2. Completion alone advances the plan to `ready_for_artist_planning`.

Migration ordering remains forward-only: the retained historical sequence is followed by the exact Phase 2 `20291217130000_festival_site_and_stage_planning.sql` and Phase 3 `20291217140000_festival_ticketing_and_capacity_planning.sql` names. Lexical ordering protects fresh installs, while deployed databases apply only unseen migrations. The verifier allow-lists these exact continuations, not a broader future range.

## Phase 4: artist programme boundary

Artist planning is an RPC-only aggregate downstream of the completed ticket plan. Application windows, authorised applications, invitations, versioned offers/revisions, bookings, encumbrance-only commitments, idempotency receipts and safe audit events are separate records. Artist identity always references canonical profiles, bands, or trusted NPC identifiers. Availability includes required band members; travel and stage compatibility are advisory summaries except definite unavailability, foreign stages/dates, currency mismatch and budget overflow, which block acceptance. Accepted bookings are provisional scheduling inputs only: Phase 4 neither creates timetable rows nor pays or announces artists.

The exact migration sequence is `20291217122000` (retained Phase 1), `20291217130000` (site), `20291217140000` (ticketing), then `20291217150000_festival_artist_applications_and_bookings.sql`. This additive ordering is safe for fresh and previously migrated environments and remains isolated by the timestamp verifier.

### Phase 4B: artist interaction and booking workflows

The Phase 4A planning schema is completed by the forward-only `20291217151000_complete_festival_artist_workflows.sql` migration. It supplies action-specific application, invitation, revisioned-offer, acceptance and cancellation RPCs plus safe artist-opportunity and manager candidate-search reads. Each transition is authenticated, authority checked, version checked, deterministic-payload idempotent, audited and communicated exactly once. Acceptance is one database transaction: it locks/revalidates budget, marks the selected revision and offer accepted, creates one provisional booking and one financial encumbrance, and updates linked application/invitation state. No cash, ticket forecast, final slot, settlement or public announcement is created.

Roadmap:

- Phase 1: Identity, location, scale and dates — complete
- Phase 2: Site and stage planning — complete
- Phase 3: Ticketing and capacity allocation — complete
- Phase 4A: Artist programme schema and planning — complete
- Phase 4B: Artist interaction and booking workflows — this PR
- Phase 5: Staffing and suppliers
- Phase 6: Sponsorship
- Phase 7: Readiness and launch
- Phase 8: Live simulation and settlement

## Phase 5 operational planning

`20291217160000_festival_staffing_and_suppliers.sql` is the exact next migration after Phase 4B in the frozen 2029 Festival sequence. It is safe for fresh installs and forward-only existing environments. The migration models the operations plan, catalogue-derived departments, server-generated staffing and supplier requirements, vacancies, canonical-profile applications, one-identity assignments, shifts, canonical-company/NPC quotes, contracts, allocations, idempotency receipts and audit events.

Safety-critical security, medical, fire, crowd, gate and accessibility coverage is never client-waivable. Operational budgets and quality/coverage scores are server-derived. Player workers and companies have a higher skill-dependent quality ceiling and social potential, while bounded city/market-sensitive NPC pools remain fallback. Contract acceptance creates encumbrances in the existing Festival commitment ledger, never payments or expenses; forecast ticket revenue remains isolated.

Transitions are explicit RPCs rather than unrestricted status writes. Festival owners/admins manage the plan, applicants control their own applications, and only authorised canonical company representatives bind supplier quotes. Payload hashes, expected versions and transactional audit/communication records make retries safe. Completion validates Phase 4, coverage, shifts, qualifications, essential power/sanitation/medical/security/accessibility contracts, budgets, currency and commitment integrity before `ready_for_sponsorship`.

### Roadmap

- Phase 1: Identity, location, scale and dates — complete
- Phase 2: Site and stage planning — complete
- Phase 3: Ticketing and capacity allocation — complete
- Phase 4A: Artist programme and planning — complete
- Phase 4B: Artist workflows and bookings — complete
- Phase 5: Staffing and suppliers — this PR
- Phase 6: Sponsorship
- Phase 7: Final readiness and launch
- Phase 8: Live simulation and settlement

### Phase 5B — staffing and supplier workflows

The Phase 5A records are now driven by dedicated transactional RPCs rather than generic status mutation. Staff lifecycle: publish vacancy → submit/withdraw application → review/shortlist/reject → hire player or bounded NPC → assign non-overlapping shifts → cancel before live work. Supplier lifecycle: publish requirement → discover opportunity → authorised company or deterministic NPC quote → review/decline/withdraw → accept into contract/allocation/commitment → cancel before delivery. Acceptance communications explicitly state that settlement occurs later.

Authority is derived from the authenticated profile. Festival managers operate only their Festival; applicants operate their own applications; active company owners, CEOs and managers may bind their company; ordinary employees and unrelated players may not. RPCs are `SECURITY DEFINER` with an empty search path, direct writes are revoked, idempotency receipts hash payloads, optimistic versions reject stale transitions, and request-scoped audit/outbox uniqueness prevents retry duplication.

Readiness is evidence based: qualified committed assignments, required shifts, safety contracts, allocations and exactly matching active commitments must exist within canonical-currency staff/supplier budgets plus contingency. Marketplace interest is never coverage, forecasts are never cash, and no Phase 5 action pays staff/suppliers, posts realised expense, opens sales, launches the Festival or awards delivery rewards.

Roadmap: Phase 1 identity/location/scale/dates — complete; Phase 2 site/stages — complete; Phase 3 ticketing/capacity — complete; Phase 4A programme/planning — complete; Phase 4B artist workflows/bookings — complete; Phase 5A operations schema/planning — complete; **Phase 5B staffing/supplier workflows — this PR**; Phase 6 sponsorship/commercial partnerships; Phase 7 final readiness/launch; Phase 8 live simulation/settlement.

The forward-only completion migration is `20291217161000_complete_festival_staffing_supplier_workflows.sql`. Fresh installs apply it after Phase 5A; deployed environments retain existing drafts and partially populated records. The known dependency blocker remains `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom` and does not prevent dependency-independent checks.

## Phase 6: sponsorship and commercial partnerships (this PR)

Phase 6 follows `20291217161000_complete_festival_staffing_supplier_workflows.sql` with the sole verifier exception `20291217170000_festival_sponsorship_and_partnerships.sql`. Fresh installs apply it after operations; already deployed environments receive additive, forward-only objects. Previous migrations are immutable and compatibility rollback uses a later corrective migration.

### Commercial domain and lifecycle

* A Festival sponsorship plan inherits operations currency and cannot start until operations is `ready_for_sponsorship`.
* Catalogue categories drive scale, sponsor limits, exclusivity, contribution, reputation, inventory and industry policy. Inventory is derived from stages, tickets, site facilities, attendance, duration and media capabilities; packages allocate inventory through a junction rather than opaque JSON.
* Prospects have exactly one canonical player-company, NPC or admin identity. Server-derived, deterministic audience/genre/Festival/reputation/capacity/community/relationship/risk scoring favours genuine player relationships without weakening reputation, quality or affordability requirements. Bounded NPC pools and cooldowns prevent refresh farming.
* Applications and invitations are non-binding. Proposals use explicit transitions and immutable append-only revisions. Acceptance atomically rechecks authority, affordability, currency, deadlines, package capacity, inventory and exclusivity before creating exactly one contract, allocations, placements, planned deliverables, audit/outbox communications and matching financial records.
* Cash and in-kind values remain separate. Festival receivables are planned—not received cash or realised revenue. A player company receives a matching reserved outgoing commercial commitment, without deduction. In-kind supplier coverage requires explicit selection and safe transactional cancellation/reduction; supplier contracts are never silently replaced.
* Naming rights, site/stage/product-category and date-limited industry exclusivity are server constraints at send and acceptance. Feedback exposes game-friendly reason codes, not hidden weights.

### Access matrix

| Actor | Public opportunities | Own sponsor records | Festival plan | Binding action |
|---|---:|---:|---:|---:|
| Anonymous | No private access | No | No | No |
| Unrelated player | Public fields only | No | No | No |
| Authorised player-company representative | Yes | Yes | No | Own company only |
| Festival owner/commercial manager | Yes | As counterparty | Yes | Festival side |
| Ordinary employee | Yes | Read only where canonical role permits | No | No |
| Admin | Yes | Yes | Yes | Explicit trusted path |

RLS is enabled and table writes are revoked; action-specific security-definer RPCs rederive identity and authority. Idempotency scopes actor/action/Festival/target and hashes payloads. Optimistic versions prevent stale plan, application, invitation, proposal, contract or inventory decisions. Communications use mail for contracts, notifications for status and an outbox/audit uniqueness boundary.

### Roadmap

* Phase 1: Identity, location, scale and dates — complete
* Phase 2: Site and stage planning — complete
* Phase 3: Ticketing and capacity allocation — complete
* Phase 4A: Artist programme and planning — complete
* Phase 4B: Artist workflows and bookings — complete
* Phase 5A: Operations schema and planning — complete
* Phase 5B: Staffing and supplier workflows — complete
* Phase 6: Sponsorship and commercial partnerships — this PR
* Phase 7: Final readiness, scheduling and launch
* Phase 8: Live Festival simulation and settlement

The inherited dependency installation blocker is `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom`; dependency-independent migration, RPC, shell, syntax and diff checks must still run.

## Phase 6B: sponsorship negotiation and contract workflows

The forward-only `20291217171000_complete_festival_sponsorship_workflows.sql` migration completes Phase 6A without rewriting deployed objects. Dedicated RPCs replace the partial generic dispatcher at the public boundary. Each action resolves the authenticated actor, Festival or company authority, fixed transition, expected version, canonical plan/package/currency, inventory and exclusivity rules, then records a payload-hashed request and audit event. Equal retries return their canonical receipt; changed reuse conflicts.

The lifecycle is application window → safe opportunity → company application or manager invitation/direct prospect → review → draft proposal → sent proposal → sponsor counter/Festival revision → acceptance or decline/withdrawal. Applications and invitations are non-binding and allocate no inventory. Revisions are ordered snapshots and sent/accepted terms are retained. NPC prospect refresh is bounded, deterministic per daily window and cooldown protected. Safe affordability categories replace exposure of company balances.

Acceptance is a single transaction locking the plan, proposal, revision and inventory. It revalidates the counterparty and commercial terms, creates one contract, contracts inventory, creates planned branding and deliverables, separate planned cash/in-kind receivables, and one reserved player-company commitment. These are planning records: no company/Festival cash transfer, tax posting, revenue recognition, branding activation or fulfilment occurs. In-kind operational coverage must match category, quality, quantity and timing; supplier replacement requires explicit confirmation and is rolled back with cancellation.

Cancellation retains the contract/history and releases inventory, planned placements/deliverables/receivables/commitments and operational coverage. Readiness counts only intact contracts and validates targets, minimum cash, in-kind share, currency, allocations, exclusivity and record integrity. It advances only to `ready_for_final_readiness`.

Access remains RPC-only with fail-closed RLS: Festival managers control their plan, authorised company representatives bind only their company, ordinary employees are read-only, NPC/admin actions require trusted authority, and competitor records/private scoring stay hidden. Mail is used for contractual events, notifications for workflow events, and request-scoped outbox/audit keys prevent duplicates. Routes point to Festival setup or the canonical company opportunity surface.

Roadmap: Phase 1 complete; Phase 2 complete; Phase 3 complete; Phase 4A complete; Phase 4B complete; Phase 5A complete; Phase 5B complete; Phase 6A complete; **Phase 6B — this PR**; Phase 7 final timetable/readiness/launch; Phase 8 live simulation/settlement. The inherited `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom` install blocker remains an environment limitation, not a feature failure.

## Phase 7A: timetable and readiness planning

The private timetable is a typed aggregate rather than a generic calendar: inclusive Festival
days own stage operating windows; typed stage slots own allocations, soundchecks and derived
changeovers. Separate schedules cover stage managers, operational dependencies, supplier
load-in/load-out and contracted sponsor activations. Locked slots survive deterministic server
generation. Canonical activity availability remains the authority for artists, required band
members and confirmed session players; only safe conflict summaries cross the Festival boundary.

Server recalculation derives time-based staff coverage, structured cross-system conflicts,
game-world weather contingencies, risk bands and readiness checks. Financial readiness keeps
actual cash, reserved commitments, planned sponsorship receivables and forecast ticket income
separate in the Festival currency. A safety blocker cannot be offset by a high score.

Owner/admin RPC authority, expected versions and idempotency requests protect every mutation.
Assigned managers are constrained to their stage and explicit scopes; artists, staff, suppliers
and sponsors see only their own relevant calls/windows, while unrelated and anonymous users see
no pre-launch plan. Direct grants are revoked. Completion appends an exact formula-versioned
snapshot and stops at `ready_for_launch_preparation`; Phase 7B owns publication and sales.

The retained forward-only migration order is `20291217170000` (6A), `20291217171000` (6B), then
`20291217180000_festival_timetable_and_readiness.sql` (7A). Fresh installs apply it in order;
upgrades preserve all Phase 1–6 drafts and fail explicitly when prerequisites are absent.

## Phase 7B: Festival launch and public ticket sales

Phase 7B is the publication and pre-event commerce boundary. It adds final launch review, immutable launch snapshots, safe public edition/stage/line-up/timetable/sponsor/ticket projections, the canonical `/world/festivals` directory and slug page, a server-time countdown, city-calendar registration, communications outbox events, and capacity-safe ticket purchasing. Launch remains private until every projection and integration succeeds in the same database transaction.

The ticket path converts Phase 3 plans to real time-derived sale phases and row-locked inventory. Authoritative totals use integer minor units and versioned fee/tax formulae at purchase time—not forecasts or browser calculations. Canonical finance moves value directly from the player owner account to the Festival company's financial account and writes its double-entry ledger exactly once. Completed sales issue opaque-reference tickets to the existing player-facing ticket area; upgrades and add-ons never grant admission, and add-ons do not affect attendance sell-out.

Pause/resume/close are explicit versioned RPCs. Complimentary tickets consume reserved allocation with no finance entry. Cancellation preserves planning and immutable history, cancels its public calendar/countdown state, notifies affected parties, and records pending refund obligations; it never marks money refunded before a later refund processor succeeds. Public policies and SECURITY DEFINER reads expose projections only, while all direct launch, inventory, sale and issuance writes are revoked.

Roadmap:

- Phase 1: Identity, location, scale and dates — complete
- Phase 2: Site and stage planning — complete
- Phase 3: Ticketing and capacity planning — complete
- Phase 4A: Artist programme and planning — complete
- Phase 4B: Artist workflows and bookings — complete
- Phase 5A: Operations planning — complete
- Phase 5B: Staffing and supplier workflows — complete
- Phase 6A: Sponsorship planning — complete
- Phase 6B: Sponsorship workflows — complete
- Phase 7A: Timetable and readiness planning — complete
- Phase 7B: Festival launch and public ticket sales — this PR
- Phase 8A: Live Festival runtime foundation
- Phase 8B: Live performances, crowds and incidents
- Phase 9: Settlement, outcomes and history

The only Phase 7B migration is `20291217190000_festival_launch_and_ticket_sales.sql`. It is additive, performs no launch/backfill/money movement, preserves all planning data, and fails migration on incompatible references. The known dependency-install environment may return `E403 403 Forbidden - GET https://registry.npmjs.org/jsdom`; that blocks Node-dependent execution but not migration/RPC static verification.
