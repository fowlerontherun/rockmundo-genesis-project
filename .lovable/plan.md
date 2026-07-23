# PR1: Isolate Legacy Festivals & Define Replacement System

Scope: architecture, inventory, isolation, and safeguards only. No destructive DB changes, no new gameplay, no client-authoritative logic.

## 1. Inventory (verified against current repo)

Sweep the codebase and DB for every festival-related asset. Produce two artifacts:

- `docs/festivals/FESTIVAL_CURRENT_INVENTORY.md` — human-readable audit grouped by layer (routes, pages, components, hooks, services, RPCs, edge functions, tables, views, enums, triggers, policies, realtime, cron, tests, seeds, admin, integrations, generated types).
- `docs/festivals/festival-domain-inventory.json` — machine-readable list. Each item: `{path, kind, responsibility, authority, callers, dependencies, proposed_replacement, removal_phase, risk, disposition, notes}` where `disposition ∈ {remove, replace, reuse, adapt, archive, unknown_requires_investigation}`.

Search terms: `festival`, `festivals`, `festival_edition`, `festival_stage_slot`, `festival_participation`, `festival_application`, `festival_offer`, `festival_contract`, `festival_performance`, `city_festival`, plus RPC prefixes (`admin_festival_`, `festival_edition_`, `apply_for_festival_`, `hire_festival_`, `purchase_festival_`, `generate_festival_`, `simulate_festival_`, `calculate_festival_`, `prepare_festival_`, `apply_festival_`, `transition_festival_`, `create_festival_`).

## 2. Replacement architecture

`docs/festivals/FESTIVAL_REPLACEMENT_ARCHITECTURE.md` covering: rationale, dependency map, bounded contexts, canonical route structure (`/world/festivals`, `/company/festival/*`, `/festival-company/*`), festival-company vs annual-edition ownership, authority boundaries, integration with companies/VIP/finance/bands/scheduling/gigs, immutable snapshot strategy, feature-flag rollout, legacy-data strategy, safe table-retirement process, full PR sequence (12 PRs), risks and mitigations.

## 3. Feature boundary

Add `src/features/festival-company/config/featureFlags.ts` exposing:

- `legacyFestivalSystemEnabled`
- `newFestivalSystemEnabled`
- `festivalCreationEnabled`
- `festivalApplicationsEnabled`
- `festivalLivePerformanceEnabled`

Flags resolved from `import.meta.env` following existing patterns; defaults preserve current behaviour (legacy on, new off). Add central `useFestivalFeatureFlags()` hook.

Route all currently registered legacy festival routes through a `<LegacyFestivalGate>` wrapper that renders a "Festivals are being rebuilt" page (`src/features/festival-company/ui/FestivalRebuildingScreen.tsx`) when `legacyFestivalSystemEnabled === false`. Admin diagnostic path preserved at `/admin/festivals/diagnostic`.

Do NOT delete legacy pages.

## 4. New module skeleton

```text
src/features/festival-company/
  README.md
  config/featureFlags.ts
  domain/README.md              (types placeholders)
  application/README.md         (service boundaries)
  data/README.md
  permissions/README.md
  finance/README.md
  scheduling/README.md
  performance/README.md
  history/README.md
  ui/FestivalRebuildingScreen.tsx
  index.ts
```

No gameplay logic; only boundary definitions + README describing intent per bounded context.

## 5. ADRs

`docs/architecture/decisions/` (create if absent):

- `0001-festival-as-company-type.md`
- `0002-festival-company-vs-edition.md`
- `0003-server-authoritative-booking-and-performance.md`
- `0004-immutable-settled-history.md`
- `0005-delayed-destructive-db-removal.md`

## 6. DB retirement plan

`docs/festivals/FESTIVAL_DATABASE_RETIREMENT_PLAN.md`: every festival table/view/function/trigger/policy classified (retain/migrate/archive/drop-after/unknown) with FK map, callers, rollback, backup requirements, ordering. No destructive migration. Optional non-destructive migration limited to `COMMENT ON TABLE` markers tagging legacy tables (`'legacy_festival_domain: pending replacement per PR1'`) if it clarifies the plan.

## 7. Automated safeguards

`src/features/festival-company/__tests__/`:

- `featureFlags.test.ts` — flag resolution, defaults.
- `legacyFestivalGate.test.tsx` — renders rebuilding screen when disabled; renders children when enabled.
- `festivalRoutes.registry.test.ts` — enumerates all festival routes and asserts each is present in inventory JSON (fails CI if a new festival route is added without inventory update).
- `worldNavigation.festivals.test.ts` — asserts World nav respects gate.
- `nonFestivalSmoke.test.ts` — asserts a sample of company + gig routes still resolve.

## 8. Version + history

Bump banner to `v1.1.604`; add version-history entry summarising PR1.

## Out of scope (deferred to later PRs)

- New festival company type creation, $2M founding transaction, VIP server check.
- Wizard, upgrades, stages, slots, applications, offers, contracts, NPC fallbacks, performance simulation, settlement, history schema.
- Legacy table drops.

## Technical details

- Feature flags: read `import.meta.env.VITE_FEATURE_*` with safe defaults; matches how the repo already reads env.
- Legacy gate: minimal HOC; wrap route element in `App.tsx` route registry. Zero behavioural change while `legacyFestivalSystemEnabled` defaults to `true`.
- Inventory generation is manual for PR1 (script optional in PR2); focus on completeness over automation.
- Tests use existing Vitest setup; no new frameworks.
- No Supabase migrations required. If a `COMMENT ON` marker migration is included, it will be a single reversible statement batch.

## Acceptance

Build passes, typecheck passes, lint passes, tests pass. Legacy routes still function (flag on). Toggling flag off renders rebuilding screen everywhere legacy festival lives. Inventory + architecture + retirement plan + ADRs committed. Next PR clearly identified: "secure festival-company type and founding transaction".
