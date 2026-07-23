# Festival Current Inventory (verified against repository at v1.1.603)

This is the human-readable audit that accompanies
`festival-domain-inventory.json`. Every item is classified with one of:
`remove`, `replace`, `reuse`, `adapt`, `archive`,
`unknown_requires_investigation`.

## Routes (registered in `src/App.tsx`)

| Path | Page | Disposition |
|---|---|---|
| `/world/festivals` | redirect → `/festivals` | replace (canonical target) |
| `/world/festivals/:festivalId` | `FestivalDetail` | replace |
| `/festivals` | `FestivalBrowser` | replace |
| `/festivals/marketplace` | `FestivalMarketplace` | remove (duplicate of directory) |
| `/festivals/directory` | `FestivalDirectory` | replace |
| `/festivals/:festivalId` | `FestivalDetail` | replace |
| `/festivals/simulation` | `FestivalsNew` | remove (dev-only) |
| `/festivals/perform/:participationId` | `FestivalPerformance` | replace (server-authoritative) |
| `/festivals/:festivalId/manage` | `FestivalOwnerConsole` | replace |
| `/festivals/:festivalId/manage/editions/:editionId` | `FestivalOwnerConsole` | replace |
| `/festivals/sessions/:sessionId` | `FestivalSessionPage` | replace |
| `/festivals/:festivalId/calendar` | `FestivalBookingCalendar` | replace |
| `/festivals/:festivalId/run` | `FestivalRunWizard` | remove |
| `/admin/festivals` | `FestivalsAdmin` | adapt (diagnostic + catalogue) |
| `/admin/festival` | redirect → `/admin/festivals` | remove |
| `/admin/festival-admin` | redirect | remove |
| `/admin/city-festivals` | redirect | remove |

## Pages (in `src/pages/`)

`FestivalBrowser`, `FestivalDetail`, `FestivalMarketplace`,
`FestivalDirectory`, `FestivalOwnerConsole`, `FestivalPerformance`,
`FestivalRunWizard`, `FestivalBookingCalendar`, `FestivalsNew`,
`Festivals` (unrouted), `FestivalOwnerConsole.test.ts`,
`festivals/FestivalSessionPage`, `admin/FestivalsAdmin`,
`admin/FestivalAdmin`, `admin/CityFestivalsAdmin`.

All classified `replace` unless explicitly `remove` above. Legacy code
stays in-tree until the retirement plan lists them for archive.

## Feature module: `src/features/festivals/`

Sub-modules (each covered by many hooks/services/components):

- `admin/` — owner + admin console services & UI
- `booking/` — canonical player booking hub, offers, contracts
- `outcomes/` — audience generation, crowd sim, performance outcomes
- `performance/` — live session hooks & realtime
- `scheduling/` — schedule workspace, template preview
- `settlement/` — readiness, prepare, apply, report

Plus root files: `festivalFeatureRegistry.ts`, `legacyResolver.ts`,
`lifecycle.ts`, `service.ts`, `types.ts`, `__tests__/`.

Disposition: **replace** (all). Legacy module remains importable during
transition; new code MUST NOT import from it.

## Supabase edge functions

- `generate-festival-poster` — **reuse** (visual asset generator, not
  gameplay-authoritative).

## Supabase migrations

22 files under `supabase/migrations/*festival*.sql`. All retained; no
new destructive migration in PR1.

## Database tables (63)

Full list mirrored in `festival-domain-inventory.json`. Grouped:

- **Core**: `festivals`, `festival_editions`, `festival_legacy_mappings`,
  `festival_edition_lifecycle_events`, `festival_edition_management_roles`,
  `festival_edition_transition_requests`, `festival_edition_creation_requests`,
  `festival_ownership_history`.
- **Applications & booking**: `festival_applications`,
  `festival_application_events`, `festival_booking_requests`,
  `festival_offer_negotiations`, `festival_offer_revisions`,
  `festival_slot_offers`, `festival_contracts`, `festival_contract_events`,
  `festival_contract_offers`, `festival_contract_versions`,
  `festival_contract_setlists`, `festival_contract_setlist_items`,
  `festival_contract_signatures`.
- **Stages & scheduling**: `festival_stages`, `festival_stage_slots`,
  `festival_stage_slot_reservations`, `festival_stage_crowd_snapshots`,
  `festival_staff`.
- **Ops**: `festival_permits`, `festival_insurance_policies`,
  `festival_expense_ledger`, `festival_finances`, `festival_revenue_streams`,
  `festival_sponsor_outcomes`, `festival_sponsorships`,
  `festival_merch_sales`, `festival_tickets`, `festival_watch_rewards`,
  `festival_participants`, `festival_attendance`.
- **Audience & outcomes**: `festival_audience_cohorts`,
  `festival_audience_generations`, `festival_audience_simulation_configs`,
  `festival_backstage_events`, `festival_fan_conversion_outcomes`,
  `festival_media_outcomes`, `festival_outcome_publications`,
  `festival_performance_attendance`, `festival_performance_audience_snapshots`,
  `festival_performance_effects`, `festival_performance_highlights`,
  `festival_performance_history`, `festival_performance_incidents`,
  `festival_performance_outcomes`, `festival_performance_session_events`,
  `festival_performance_sessions`, `festival_song_performance_outcomes`,
  `festival_session_crew`, `festival_session_equipment`.
- **Reviews & marketplace**: `festival_reviews`, `festival_quality_ratings`,
  `festival_rivalries`, `festival_sale_listings`,
  `festival_purchase_offers`, `festival_admin_audit_events`.

Every table receives a per-table disposition in the JSON. All are
`archive` or `replace` for PR-later; **none** are dropped in PR1.

## RPCs (representative)

`create_festival_edition`, `update_festival_edition_planning`,
`transition_festival_edition`, `admin_transition_festival_edition`,
`festival_edition_operations_summary`, `festival_edition_finance_summary`,
`festival_edition_schedule_workspace`, `generate_festival_stage_slots`,
`apply_for_festival_edition_permit`, `purchase_festival_edition_insurance`,
`hire_festival_edition_staff`, `prepare_festival_edition_settlement`,
`apply_festival_settlement_batch`, `festival_edition_settlement_readiness`,
`festival_settlement_report`, `festival_owner_management_bootstrap`,
`resolve_festival_management_identifier`, `admin_festival_catalogue`,
`generate_festival_edition_audience`, `simulate_festival_crowd_movement`,
`calculate_festival_performance_outcome`, `festival_performance_narrative`,
`public_festival_performance_outcomes`.

Disposition: **replace** (all). Legacy names remain callable while
`legacyFestivalSystemEnabled=true`.

## Hub / navigation entries

- `WorldOverview.tsx` — "Upcoming festivals" list card → `/world/festivals`
- `EventsHub.tsx` — "Festivals" tile → `/festivals`
- `BandLiveHub.tsx` — "Festivals" tile → `/festivals`
- `WorldHub.tsx` — "Seasonal Events" tile (retained, non-festival specific)

All continue to work under legacy flag; new module will re-point them in
a later PR.

## Tests

`src/features/festivals/__tests__/festivalFeatureRegistry.test.ts`,
`src/pages/FestivalOwnerConsole.test.ts`, and the harness suite in
`supabase/tests/festival_*_harness.sql`. All retained.

## Seeds & scripts

`scripts/festivals/check-edition-migration-order.mjs`,
`scripts/festivals/run-creation-phase1-db-gate.sh`. Retained.

## Generated Supabase types

`src/integrations/supabase/types.ts` regenerated automatically; treat as
read-only. Any `festival_*` type appearing there is de-facto tracked by
this inventory.

## Unknowns requiring investigation

- Legacy `festival_participants` vs new `festival_performance_sessions`
  overlap during in-flight editions.
- Whether any external `city_festivals` seeder still writes to
  `festivals` after the Victorious cleanup.
