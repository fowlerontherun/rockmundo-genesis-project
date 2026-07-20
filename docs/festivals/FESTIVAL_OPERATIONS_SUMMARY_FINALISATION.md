# Festival Operations Summary Finalisation

## Definitions audited

| Migration | Operation | Parameters | Return | Security | Grants | Access check | Clean-reset order impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20260720120000_repair_london_fixture_operations_projection.sql` | `CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary` | `p_edition_id uuid` | `jsonb` | `SECURITY DEFINER` | `authenticated`, `service_role` | None in function body | Applied before the later 2029 festival domain migrations and before this finalisation migration. Its definition is not authoritative after this PR. |
| `20291217100000_finalise_festival_operations_summary.sql` | `CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary_internal` | `p_edition_id uuid` | `jsonb` | `SECURITY DEFINER` | `service_role` only | Internal helper; caller must be pre-authorised | Private builder used by the final wrapper. |
| `20291217100000_finalise_festival_operations_summary.sql` | `CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary` | `p_edition_id uuid` | `jsonb` | `SECURITY DEFINER` | `authenticated`, `service_role`; `anon` and `PUBLIC` revoked | `public.can_manage_festival_edition(p_edition_id)` before aggregation | Final authoritative definition on both clean reset and forward-upgraded databases. |

Repository search found only the 2026 PR definition before this finalisation work. The authoritative festival operations domain is otherwise established later, especially by `20291212090000_complete_festival_edition_operations.sql`, which defines the private source tables and helper functions consumed by the summary. Because migrations run in filename order, a clean reset applies the 2026 summary before later festival operations migrations; this final `20291217100000` migration is now later than the currently relevant festival migrations and wins on clean reset.

## Current authoritative access model

`public.festival_edition_operations_summary(uuid)` is owner-only. It rejects callers unless `public.can_manage_festival_edition(p_edition_id)` returns true. The helper allows:

- service role;
- platform administrators;
- the festival brand owner through `public.can_manage_festival_brand`;
- active edition management roles: `delegated_manager`, `operations_manager`, `stage_manager`, `talent_booker`, `finance_manager`, and `safety_officer`.

The private builder `public.festival_edition_operations_summary_internal(uuid)` remains callable only by `service_role`. The public wrapper performs the authorisation check before calling finance, staffing and data-health aggregators so nested `SECURITY DEFINER` helpers cannot be used through this RPC by unrelated authenticated players.

## Owner-only response contract

The final wrapper preserves the keys required by current owner console consumers:

| Key | Status | Notes |
| --- | --- | --- |
| `edition_id` | retained | Canonical edition identifier. |
| `festival_id` | retained | Canonical festival brand identifier. |
| `festival_name` | retained | Owner dashboard display value. |
| `venue_name` | retained | Owner dashboard display value. |
| `stages` | retained, always array | Canonical stage rows. |
| `slots` | retained, always array | Canonical slots, enriched with system-act and contract-status fields. |
| `staff` | retained, always array | Private staffing rows, including wage/assignment details. |
| `permit_requirements` | retained, always array | Canonical permit readiness projection. |
| `staffing_readiness` | retained, explicit object | Canonical staffing readiness projection. |
| `insurance_policies` | retained, always array | Private policy rows. |
| `ticket_summary` | retained | Capacity, tickets sold, tiers and internal source. |
| `ticketing` | retained | Backward-compatible alias of ticket summary. |
| `tickets_sold` | retained | Numeric shortcut used by dashboards. |
| `schedule_summary` | retained | Includes total, occupied, open, contracted, published and system-act counts. |
| `finance` | retained | Private finance summary. |
| `data_health` | retained, always array | Migration/data-health blockers. |
| `permissions` | retained | Explicit `can_manage: true` after wrapper authorisation. |
| `lifecycle` | retained | Status/date/currency owner context. |
| `candidates` | retained as empty array | Compatibility placeholder for older owner screens. |
| `insurance_quotes` | retained as empty array | Compatibility placeholder for older owner screens. |
| `ticket_summary_source` | added | Internal authority marker: `test_fixture_metadata` or `unavailable` until a canonical commercial ticket ledger exists. |

No existing keys from the PR #1259 summary were intentionally removed. Deprecated compatibility placeholders should remain until all owner console consumers stop reading them.

## Frontend consumers audited

- `src/features/festivals/admin/service.ts` calls the RPC from `fetchFestivalEditionOperations` and still falls back to scoped table reads only when the RPC is unavailable.
- `useFestivalEditionOperations` and the owner dashboard consume the service-layer projection rather than calling public festival projections directly.
- Schedule, staffing, permit, insurance and live operations pages should continue using owner/admin services for private data. Public festival pages must use `public_festival_editions` and public lineup/schedule/ticket availability projections, not the owner summary.

## Ticket summary authority

The final summary uses edition capacity as the normal capacity authority. It does not treat `festival_audience_generations` or `festival_audience_cohorts.ticket_holders` as completed commercial sales, because those tables model audience simulation rather than a paid ticket ledger. Ticket totals therefore remain unavailable for real festivals until the later Ticket Sales PR introduces canonical ticket inventory, order, purchase, refund, complimentary-ticket, and box-office settlement structures.

Fixture metadata is only considered when `lifecycle_metadata.is_test_fixture = true`; production metadata cannot override edition capacity or supply sales totals. The London fixture may keep using guarded fixture metadata so QA continues to show 3,250 / 10,000.

## Upgraded environment vs clean reset

Before this PR, an upgraded environment that had just applied PR #1259 could expose the 2026 `SECURITY DEFINER` function with no caller check. A clean reset could also diverge if any later migration redefined the same RPC. After this PR, both upgraded and clean-reset databases end at `20291217100000_finalise_festival_operations_summary.sql`, with the same wrapper, grants, internal helper and contract.
