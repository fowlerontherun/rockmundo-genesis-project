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
