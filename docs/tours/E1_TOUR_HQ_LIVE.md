# E1 — Live Tour HQ

## Outcome

Tour HQ now loads one canonical workspace for scheduled, active, completed and cancelled tours. The same Supabase RPC supplies every tour detail view, and all player mutations return through versioned, idempotent database functions.

## Live database contract

The schema was applied directly to Supabase rather than added as a repository migration, by request.

### Tables

- `tour_operation_templates`
- `tour_operation_states`
- `tour_budget_ledger`
- `tour_equipment_manifest`
- `tour_crew_schedules`
- `tour_merchandise_plans`
- `tour_sponsor_obligations`
- `tour_logistics_events`
- `tour_completion_reports`
- `tour_operation_requests`

Direct `anon` and `authenticated` table access is revoked. RLS remains enabled as defence in depth.

### Browser RPCs

- `get_tour_operations_workspace`
- `save_tour_operation_template`
- `save_tour_operations_plan`
- `apply_tour_operation_template`
- `record_tour_logistics_event`
- `resolve_tour_logistics_event`
- `complete_tour_operations_report`

The RPCs validate the authenticated tour/band relationship. Management mutations require a leader/manager role, use idempotency keys and serialize plan changes with `plan_version`. Logistics costs and condition effects are selected on the server, and completion reports derive from canonical gig outcomes rather than browser totals.

## Client behaviour

`LiveTourHQPanel` provides:

- live progress, itinerary, finance, open issues and operations ledger;
- production, crew, equipment, merchandise and sponsor editors;
- reusable band-scoped templates;
- server-mapped logistics events and resolution;
- canonical completion reports;
- loading, error/retry and read-only states;
- focus refresh, 60-second reconnect refresh and explicit manual refresh;
- optimistic version conflict detection that never silently overwrites another session.

The application never reads or writes the operations tables directly. `src/lib/api/tourOperations.ts` is an RPC-only boundary.

## Verification

- `npm run test:touring`
- `npm run build`
- `npm run lint:ci`
- `npm run test:e1:db` with `SUPABASE_DB_URL`

The database harness is verification-only. It checks object presence, RLS, revoked browser table access, exact RPC signatures, authenticated execution, anonymous denial, `SECURITY DEFINER` review status and fixed function search paths.
