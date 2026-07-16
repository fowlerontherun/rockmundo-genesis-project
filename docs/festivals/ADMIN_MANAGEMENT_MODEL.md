# Canonical festival admin management model

The admin model is split between permanent festival brands and dated festival editions.

## Brands

Brands live in `festivals` and contain durable identity only: name, description, home city, genre identity, scale classification, ownership metadata, visibility and archive state. `admin_create_festival_brand` and `admin_update_festival_brand` are admin-only RPCs and audit every mutation in `festival_admin_audit_events`.

Occurrence dates, ticket prices, attendance, lifecycle and results are intentionally rejected by brand editing.

## Editions

Editions live in `festival_editions` and hold dates, city, venue, capacity, expected attendance, ticket ranges, currency, budget, lifecycle and public occurrence metadata. Owners and admins must explicitly select an edition; the owner console does not infer one from brand dates.

## Operations

Stages and slots now carry `edition_id` columns. Staff, permits, insurance and ledger tables gain edition references so operational dashboards can move away from brand-scoped calculations. Direct slot band assignment without a canonical contract is blocked by a trigger; emergency system acts use `admin_assign_festival_system_act` with deterministic identity and audit.

## Permissions

Server-side checks distinguish platform admins, owners and delegated edition managers. `festival_edition_management_roles` supports talent booker, finance manager, operations manager, stage manager and safety officer delegation without transferring ownership.

## Audit

`festival_admin_audit_events` records actor, authority, festival, edition, operation, target, before/after snapshots, reason, idempotency key and timestamp. Destructive or corrective operations require a reason.

## 2029-12-12 operational completion update

The canonical edition operations PR completes the PR #1210 foundation by adding edition-scoped operational RPCs, deterministic operational backfill, migration issues, persistent system acts, persistent staff candidates, permit and insurance workflows, controlled ledger posting, data-health repairs, legacy migration apply, and expanded settlement readiness. Career effects and final financial settlement remain deferred to `feat(festivals): apply career effects and settle performance contracts`.

## Settlement administration

Admins can inspect readiness, locked inputs, application records, contract instructions, reconciliation discrepancies and completed immutable settlement history. Manual final profit or fame entry is not supported.
