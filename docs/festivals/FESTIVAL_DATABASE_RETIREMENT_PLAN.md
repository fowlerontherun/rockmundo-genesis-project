# Festival Database Retirement Plan

Status: **planning only. No destructive migrations in PR1.**

## Classification

Every festival table lands in one of:

- **retain / reuse** — kept as-is (e.g. `festival_legacy_mappings`
  extended to bridge legacy → new IDs; `generate-festival-poster`).
- **migrate** — data copied into new schema tables before drop.
- **archive** — renamed into `archive_festivals.*` namespace, read-only.
- **drop after replacement** — removed in the destructive migration only
  after zero runtime callers remain for one release cycle.
- **unknown** — requires investigation before classification (tracked
  in `festival-domain-inventory.json > unknowns`).

The per-table disposition lives in `festival-domain-inventory.json`.
Retirement phase corresponds to the PR sequence in
`FESTIVAL_REPLACEMENT_ARCHITECTURE.md`.

## Dependency mapping

Before drop, for each table:

1. Enumerate FKs in and out (via `information_schema.table_constraints`).
2. List RLS policies attached (may cascade drop).
3. List triggers, functions, views, materialized views referencing it.
4. List generated TS types (`src/integrations/supabase/types.ts`).
5. List every code caller (search across `src/`, `supabase/functions/`,
   `supabase/migrations/`).

A table is only eligible for drop when all five lists are empty or
migrated.

## Rollback strategy

- Every destructive migration ships with a paired non-destructive
  precursor that renames the table into `archive_festivals.<name>` first.
- The drop step is a separate migration and can be reverted by restoring
  from the archive schema within the same release window.
- A pre-drop backup of each table (JSON export) is stored under
  `docs/festivals/retirement-backups/<date>/<table>.json`. The export
  script is added in PR12, not now.

## Ordering

Destruction proceeds in reverse-dependency order:

1. Reviews, ratings, rivalries, marketplace listings.
2. Attendance, tickets, watch rewards, sponsor outcomes.
3. Audience/outcome/performance snapshot tables.
4. Session, crew, equipment tables.
5. Contracts, offers, negotiations, applications.
6. Stages, slots, staff, permits, insurance, finance ledgers.
7. Editions, lifecycle, management roles.
8. Root `festivals`.
9. `festival_legacy_mappings` — last, kept while any historical import
   still needs it.

## Non-destructive PR1 marker (optional, not applied)

If applied in a future PR, a single reversible marker migration will
add a `COMMENT ON TABLE public.<table> IS 'legacy_festival_domain: pending replacement — see docs/festivals/FESTIVAL_REPLACEMENT_ARCHITECTURE.md'`
statement for each archived table. No columns, indexes or data touched.

## Approval gate

Each destructive migration requires:

- Signed-off inventory JSON entry with `removal_phase` and `risk`.
- Green build + typecheck + `festival` test suite.
- Manual approval on the migration.

## PR2 replacement objects retained alongside legacy data

PR2 adds replacement-only tables: `festival_companies`, `festival_editions_v2`, `festival_company_audit_log` and `festival_company_founding_requests`. These tables do not reuse or delete legacy festival tables. They establish the new festival-company ownership, idempotency and audit boundary while legacy player-facing routes remain behind the PR1 safety gate.

The secure founding RPC records whole-USD game-dollar movement: personal `profiles.cash` decreases by `$2,000,000`; `companies.balance` starts at `$0`; `company_transactions.amount` records the founding/setup expense for audit without treating it as company capital. Legacy table retirement remains deferred until later migration PRs can map old brands/editions into the replacement model safely.

## PR3 hardening migration safety

PR3 is forward-only and does not edit the PR2 migration. It replaces `found_festival_company`, adds `get_festival_company_setup`, seeds the server-side `game_config` rollout row, extends idempotency result storage and preserves all existing `festival_companies` and `festival_editions_v2` records.

Existing PR2 founding requests are backfilled with stored JSON results where company and festival-company IDs already exist. Misleading PR2 company founding-fee rows are not deleted broadly; they are reclassified to non-P&L `investment` only when a row is linked by the festival company ID, company ID and `related_entity_type = 'festival_company'`. The canonical personal ledger is used for new founding fees through `financial_transactions` category `festival_company_founding_fee`.

Legacy festival tables remain untouched and are still outside the destructive retirement window.

## Replacement company financial gate

Before any replacement configuration wizard work, the financial gate confirms that founding a festival company charges the founder once, leaves the new company at a zero balance, and creates no company operating P&L row. Legacy festival tables remain out of scope and are not retired by the single-charge correction. Rollout migrations must preserve existing administrator configuration and must not enable creation, management or configuration as a side effect of deployment.
