# Festival admin operations completion audit

## Scope

This audit reviews the PR #1210 foundation in `20291211090000_festival_admin_management.sql`, the admin TypeScript feature area, the owner console selectors, and the SQL harness before the operational completion migration.

## Classification summary

| Area | Classification | Evidence | Completion in this PR |
| --- | --- | --- | --- |
| `festival_admin_audit_events` | Compatibility only | Audit table, admin read policy, and idempotency index existed, but only a few admin operations wrote events. | Adds shared audited operational mutations for stages, slots, system acts, staff, permits, insurance, budget, ledger, copy, migration, and repairs. |
| `festival_edition_management_roles` | Read-only foundation | Delegated roles existed and owner selectors could read them, but no management workflow was present. | Adds role-aware authority checks used by operational RPCs and documents delegated manager UX. |
| Edition-scoped columns | Compatibility only / unsafe for settlement | `edition_id` columns existed on stages, slots, staff, permits, insurance, and ledger, but were nullable and not fully enforced. | Adds deterministic backfill attempts, migration issue records, write restrictions, and edition-required canonical RPCs. |
| Direct-assignment trigger | Fully operational foundation | Direct `band_id` updates without a canonical contract were blocked. | Keeps the trigger and routes system acts through audited, deterministic system-act records. |
| `admin_festival_catalogue` | Projection only | Returned counts and warnings, with zeroed finance values and limited next-action detail. | Adds finance, data-health, and operational projections for catalogue/workspace use. |
| `festival_owner_edition_options` | Fully operational foundation | Returned authorised editions for owners and active delegates. | Reused by owner workspaces and delegated controls. |
| `festival_edition_settlement_readiness` | Projection only / unsafe for settlement | Checked lifecycle, completed sessions, missing outcomes, invalidations, contracts, and pending effects, but omitted operational finance/staff/permit/insurance blockers. | Expands readiness to operational blockers without applying effects or paying settlements. |
| `admin_assign_festival_system_act` | Partially operational | Updated slot NPC fields and audited, but did not persist a canonical system-act entity and generated identity from idempotency key. | Adds `festival_system_acts` with deterministic identity, reliability, metadata, removal, replacement/move workflows, and audit. |
| `festival_staff_candidates` | Projection only | Generated deterministic rows per query but did not persist candidates. | Adds persistent candidate table and stable materialisation. |
| Seed preview RPC | Preview only | Returned non-mutating seed suggestions. | Remains preview-only; apply remains deferred outside this PR's operational scope. |
| Legacy migration preview RPC | Preview only | Returned source event and participants and explicitly did not mutate. | Adds admin apply RPC with preview hash, read-only source marking, mappings, and issues. |
| Admin TypeScript service area | Compatibility only | Used a broad RPC client cast and only covered catalogue, brand creation/update, lifecycle, and owner options. | Adds typed operational service wrappers and focused component directories. |
| `AdminFestivalCatalogue` | Read-only | Showed summary cards, warnings, and workspace button without operational workspaces. | Expanded catalogue/workspace documentation and service surface. |
| `OwnerEditionSelector` | Fully operational foundation | Allowed selecting edition options returned by RPC. | Reused for owner operational controls. |
| `FestivalOwnerConsole` | Read-only | Surfaced readiness messaging and deferred settlement notes. | Owner controls now have RPCs for authorised operational mutations; outcome scoring remains read-only. |
| Admin and owner routes | Compatibility only | Routes existed but many tabs were placeholders. | Documents and wires the canonical service contracts for complete tabs. |
| SQL harness | Projection-only smoke | Verified existence of PR #1210 foundations only. | Extends harness coverage to operational functions and constraints. |
| Generated Supabase types | Compatibility only | Types reflected PR #1210 but broad casts remained in the feature area. | Adds generated-type usage plan and typed service boundaries. |

## Settlement safety conclusion

PR #1210 was a necessary foundation but was unsafe for settlement because operational data could remain unscoped, staff/permit/insurance costs were not authoritative ledger obligations, system acts were not persisted as canonical assignments, legacy records could still be written after mapping, and readiness did not validate operational blockers. This PR closes those gaps while deliberately deferring fame, fan, popularity, streaming, XP, relationship, payment, revenue, tax, and final settlement effects.
