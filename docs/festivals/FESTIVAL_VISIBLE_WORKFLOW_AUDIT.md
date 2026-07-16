# Festival visible workflow runtime audit

Date: 2026-07-16. Scope: follow-up audit for PR #1214 visibility claims.

## Method

The local app was inspected from source and the festival routes were mapped to mounted components, data queries, actions, and error states. Network-backed checks require Supabase configuration and are covered by the route smoke matrix.

## Findings

| Area | Route or tab | Loads | Heading | Real data | Actions | Known blockers |
|---|---|---:|---|---|---|---|
| Public discovery | `/festivals` | Yes | Festival browser | Public edition query | Apply/detail links | Empty state depends on published editions. |
| Festival detail | `/festivals/:festivalId` | Yes | Festival detail | Canonical resolver with legacy fallback | Application journey | Legacy IDs may be compatibility-only. |
| Owner overview | `/festivals/:festivalId/manage/editions/:editionId` | Yes | Festival management | Owner edition options | Edition switching | Requires authorised edition RPC. |
| Owner booking/lineup | Booking, Lineup | Yes | Booking workspace | Applications/offers/contracts/setlists | Review and contract actions | Server permissions remain authoritative. |
| Owner stages/slots | Stages | Yes | Create canonical stage / Slot timeline | Edition operations summary and slot rows | Create, preview, generate | Legacy stage mappings show migration-blocked state. |
| Owner staff | Staff | Yes | Staffing readiness | Staff/candidate projection | Hire/update/suspend/terminate controls | Candidate RPC may return no candidates. |
| Owner permits | Permits | Yes | Permits | Permit requirements/statuses | Apply/request info/view status | Admin controls separated. |
| Owner insurance | Insurance | Yes | Insurance quotes/policies | Quotes and policies | Request quote/purchase/view policy | Stale quotes are disabled. |
| Owner finance | Finance | Yes | Finance summary | Finance RPC/ledger | Read-only ledger | Failed RPC values are not rendered as zero. |
| Owner outcomes | Outcomes | Yes | Edition outcomes | Outcome projection | Read-only | Private contract/health data excluded. |
| Owner settlement | Settlement | Yes | Settlement readiness/report | `festival_settlement_report` hook | Prepare/apply/reconcile/inspect | Actions disabled until eligible readiness hash. |
| Admin catalogue | `/admin/festivals` | Yes | Festivals Administration | Admin catalogue RPC | Brand/edition/lifecycle workspace | None found in source audit. |
| Admin operations | Stages through Settlement | Yes | Section headings | Edition-scoped queries | Admin-scoped controls | Requires edition selection. |
| Admin legacy | Legacy Records | Yes | Legacy records | Mappings/RPC | Preview/apply/mark/open | Transactional failures are surfaced. |
| Admin data health | Data Health | Yes | Festival data health | Migration issue RPC/table | Repair classifications | No free-form SQL action. |
| Admin audit | Audit | Yes | Festival audit log | Audit projection/table | Filters | Empty state shown when no events. |

## Placeholder removal

The owner console no longer uses a generic feature-registry card for Stages, Staff, Permits, Insurance, Finance, Outcomes, or Settlement. Admin tabs now mount concrete content instead of badge labels.
