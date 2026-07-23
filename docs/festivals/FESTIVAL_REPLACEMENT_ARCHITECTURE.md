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
