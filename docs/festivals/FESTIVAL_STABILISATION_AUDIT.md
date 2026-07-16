# Festival stabilisation audit

## Reproduction notes

Local route reproduction was attempted first. The repository does not include an installed Supabase CLI in this container, so route checks that depend on a running local API were recorded from static route/service inspection and are regression-covered by the added frontend and SQL harness checks. `supabase db reset` remains the required validation gate once the supported CLI is available in CI or a developer workstation.

## Issue table

| Route / area | Action | Expected result | Actual result | Console error | Network error | Database object involved | Root cause | Fix | Regression test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/festivals/:festivalId/manage` | Open owner console without `editionId` | Redirect to an authorised edition | Console showed selector and could leave dependent tabs without an edition | N/A | Potential disabled/stale edition queries | `festival_owner_edition_options` | Missing route-level edition selection redirect | Redirect to first authorised edition after permissions load | `src/features/festivals/admin/__tests__/stabilisation.test.ts` plus route smoke target |
| `/festivals/:festivalId/manage/editions/:editionId` | Open invalid edition URL | Useful error | Generic chooser made invalid and unselected states indistinguishable | N/A | Potential 404/RLS from downstream tab queries | `festival_editions` | URL edition was not validated against authorised options before rendering workflows | Show support-coded invalid edition state and keep workflows disabled | Route smoke target |
| `/admin/festivals` | Load catalogue with a brand that has no current edition | Catalogue row renders with null-safe values | Mapper assumed fallback USD and weak result shape | Possible malformed response crash | `admin_festival_catalogue` | Runtime RPC response was trusted | Added Zod validation and null-safe mapping failure code | `stabilisation.test.ts` |
| Owner finance/staff/insurance | Retry RPC after transient failure | One server-side side effect | Risk of duplicate ledger/policy/staff rows | PostgREST duplicate or stale response | `festival_expense_ledger`, `festival_staff`, `festival_insurance_policies` | Existing functions rely on idempotency but client accepted malformed responses | Service boundary validates non-null JSON and maps raw errors | `festival_stabilisation_harness.sql` |
| Migration chain | Apply PR #1211 over historical ledger categories | Migration succeeds or records issues | Constraint could fail on legacy `staff`, `performers`, `stage`, `security_cost`, `sponsorship`, `food`, `drinks`, `miscellaneous` | N/A | Check constraint violation | `festival_expense_ledger_category_check` | Constraint replaced before safe category normalisation | Known mappings applied first; unknown categories become migration issues | `festival_stabilisation_harness.sql` |
| Migration chain | Add ledger currency to existing rows | Currency is derived or flagged | `DEFAULT 'USD'` could silently relabel GBP/EUR/unknown rows | N/A | Silent data corruption risk | `festival_expense_ledger.currency_code` | Universal default used for historical data | Removed default; derive from edition; unresolved rows become blockers | `festival_stabilisation_harness.sql` |
| Migration chain | Backfill brand-scoped operations | Only deterministic edition mapping | Multi-edition brands could attach staff/permits/insurance to edition #1 | N/A | Wrong foreign key | `festival_staff`, `festival_permits`, `festival_insurance_policies` | Unsafe `edition_number = 1` assumption | Backfill only when brand has exactly one edition; otherwise leave issue | SQL inspection + harness |
| Stages | Resolve `festival_stages.festival_id` | ID domain is explicit | Mixed brand/game-event/edition domains were joined as if compatible | N/A | Wrong join or unresolved stage | `festival_stages`, `festival_legacy_mappings` | Legacy field had ambiguous semantics | Added `resolve_festival_stage_legacy_domain()` and unresolved issue recording | `festival_stabilisation_harness.sql` |
| Slots | Create/update slots | Stage and slot editions match; no overlaps | Enforcement depended on RPC/UI path | N/A | Inconsistent rows possible via direct writes | `festival_stage_slots` | Missing central database trigger | Added consistency trigger for edition, dates and overlaps | `festival_stabilisation_harness.sql` |

## Migration dependency report

| Timestamp | Festival migration | Dependency findings |
| --- | --- | --- |
| `20291204090000` | Canonical editions foundation | Creates `festival_editions`, lifecycle events and legacy mappings before later booking/admin migrations use edition IDs. |
| `20291205090000` | Harden festival editions | Depends on edition enum/table and defines public projections/transition helpers used by later routes. |
| `20291206090000` | Booking contracts | Adds canonical application, offer and contract tables and assumes `festival_stage_slots` already exists from legacy schema. |
| `20291207090000` | Booking hardening | Defines SECURITY DEFINER booking RPCs; currency defaults remain a known pre-existing application/offer issue outside this stabilisation patch. |
| `20291208090000` | Booking workspaces | Public/organiser projections join stage slots by festival; canonical-only consumers must prefer edition-scoped queries. |
| `20291209090000` | Performance sessions | Depends on active contracts and stage slots. No settlement functionality changed here. |
| `20291210090000` | Audience/outcomes | Depends on performance sessions and creates outcome projections. |
| `20291211090000` | Admin management | Creates admin catalogue and owner edition options before edition operations UI uses them. Catalogue must tolerate brands without editions. |
| `20291212090000` | Complete edition operations and legacy migration | Confirmed unsafe category, currency and edition-one backfills; patched to deterministic mappings and issue recording. |
| `20291213080000` | Stabilise festival domain | Adds stage ID-domain resolver, slot consistency trigger and final no-USD-default guard. |
| `20291213090000` | Effects and settlement | Present in repository but not extended by this PR; settlement remains deferred. |

## Ledger category mapping

| Legacy category | Canonical category |
| --- | --- |
| `staff` | `staff_wages` |
| `performers` | `artist_guarantee` |
| `stage` | `stage_rental` |
| `security_cost` | `security` |
| `sponsorship` | `sponsor_income` |
| `food` | `fnb_income` |
| `drinks` | `fnb_income` |
| `miscellaneous` | `other` |

Unknown categories are preserved in `festival_operation_migration_issues` as `unmapped_ledger_category` blockers before the canonical check constraint is applied.

## SECURITY DEFINER matrix

| Function family | Search path | Actor check | Grants | Stabilisation status |
| --- | --- | --- | --- | --- |
| Admin catalogue / owner options | `SET search_path=public` in migrations | Admin/owner/delegate checks in SQL | Authenticated | Frontend now validates response shape and maps permission errors. |
| Stage/slot/staff/permit/insurance/finance RPCs | `SET search_path=public` | `festival_admin_can_operate_edition` and admin checks | Authenticated | New slot trigger backs RPC validation with database invariants. |
| Legacy migration/data health RPCs | `SET search_path=public` | Admin-oriented | Authenticated/admin policies | Migration issues are now first-class repair blockers. |
| Stage legacy resolver | `SET search_path=public` | Read-only diagnostic; PUBLIC revoked | Authenticated | New helper avoids joining incompatible ID domains. |

## Remaining known issues

- Full browser reproduction and `supabase db reset` require the repository-supported Supabase CLI, which was not installed in this container.
- Settlement migration `20291213090000_festival_effects_and_settlement.sql` remains present but was not expanded; this PR intentionally avoids adding settlement behavior.
