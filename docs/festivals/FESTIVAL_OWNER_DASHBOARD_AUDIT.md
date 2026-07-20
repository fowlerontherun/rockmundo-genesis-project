# Festival Owner Dashboard Audit

## Loading path traced

`FestivalOwnerConsole` resolves the route festival identifier, calls `useOwnerManagementBootstrap`, selects the URL edition or preferred edition, then starts `useFestivalEditionOperations` and `useFestivalEditionFinance`. The overview passes those query results into `FestivalEditionDashboard`, which now builds a typed dashboard model before rendering.

## Queries and RPCs

1. `festival_owner_management_bootstrap(p_identifier)` via `fetchOwnerManagementBootstrap` supplies access, festival identity, migration state, available canonical editions and preferred edition selection.
2. `festival_edition_operations_summary(p_edition_id)` via `fetchFestivalEditionOperations` supplies operational arrays and summaries: stages, slots, staff, permit requirements, insurance quotes/policies, lifecycle, permissions, venue/location, ticket summary and optional finance-like counters.
3. `festival_edition_finance_summary(p_edition_id)` via `fetchFestivalEditionFinanceSummary` supplies finance card fields: `currency`, `budget_cents`, `committed_cost_cents`, ledger and category breakdowns.
4. Section workspaces may issue their own queries/RPCs for booking, scheduling, stages, staff, permits, insurance and finance, but the overview should depend only on the bootstrap, operations summary and finance summary.

## Expected response shape and guarantees

- Bootstrap is mapped into `OwnerManagementBootstrap`. Guaranteed client fields include `status`, nullable `festival`, `authority`, `editions`, nullable `preferredEditionId`, `migration`, `availableActions` and nullable `message`. Edition options guarantee id/title/status/currency fields at the mapper boundary, while dates and city are nullable.
- Operations summary is loosely typed JSON. Arrays such as `stages`, `slots`, `staff`, `permit_requirements`, `insurance_quotes` and `insurance_policies` may be absent and must default to empty only when the query itself succeeded. Optional scalar fields include `festival_name`, `brand_name`, `venue_name`, `capacity`, ticket summary fields, reputation and sponsor counts.
- Finance summary is loosely typed JSON. Budget values and currency are optional. Missing finance is not equivalent to zero budget.

## Failure isolation

- Bootstrap failure blocks the route because authorisation, canonical migration status and edition selection are unknown.
- Operations failure must block the overview operational cards and show `FESTIVAL_EDITION_OPERATIONS`; it must not be converted into healthy zero counters.
- Finance failure is independent. It should not prevent countdown, lineup, staffing, permits or insurance from rendering; the budget card displays a retryable unavailable state.

## Empty canonical editions

Canonical editions with no operational child records can load safely when the operations RPC succeeds and returns absent or empty arrays. The dashboard model treats missing arrays as empty configuration and directs the organiser to stages/slots setup without crashing.

## Legacy identifiers

Legacy festival identifiers can still reach the route as the route parameter. The bootstrap RPC is responsible for resolving supported identifiers, returning `migration_blocked` for records requiring migration, or returning `not_found`. The dashboard must not write to legacy festival tables or browser-side compatibility tables.

## Error conversion found

The previous `fetchFestivalEditionOperations` fallback could return empty arrays after fallback failure, which made a failed operations load look like a new empty festival. The repaired UI treats React Query operations errors as dashboard-blocking, and only treats empty arrays as meaningful after a successful query.

## Query invalidation

Existing stage, slot, staff, permit and insurance mutations invalidate the owner operations query key for their edition. Booking and scheduling hooks invalidate their local booking/schedule keys; dashboard freshness depends on the operations summary also being invalidated after mutations that affect slot occupancy or published schedule state. Finance mutations and finance-affecting actions should invalidate the edition finance query rather than broad application keys.

## Finance versus operations

Finance data should populate only budget-related dashboard fields. If `festival_edition_finance_summary` fails, operational readiness, lineup and ticket availability from operations still render. Budget check status becomes unavailable rather than blocked-zero.

## Readiness links

The previous checklist used substring matching against readiness keys, so labels could link to `#dashboard` or a wrong section. The new dashboard checklist defines stable keys and explicit destinations: `#settings`, `#stages`, `#lineup`, `#finance`, `#staff`, `#permits`, `#insurance` and `#operations`.
