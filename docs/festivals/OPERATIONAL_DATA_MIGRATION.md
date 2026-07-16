# Operational data migration

The completion migration audits `festival_stages`, `festival_stage_slots`, `festival_staff`, `festival_permits`, `festival_insurance_policies`, and `festival_expense_ledger` for missing or ambiguous edition references.

## Resolution strategy

Rows are attached only when deterministic evidence exists: an existing `edition_id`, a legacy `game_event` mapping, a stage-to-slot relationship, brand plus edition number, or explicit row metadata. Ambiguous rows are not attached to the latest edition.

## Issue tracking

Unresolved rows are recorded in `festival_operation_migration_issues` with source table, source ID, festival ID where known, proposed edition where known, issue type, severity, evidence, resolution status, resolver, timestamp, and metadata.

## Write restrictions

New canonical writes must pass through edition-scoped RPCs. Direct stage/slot policies require edition authority, direct ledger inserts are revoked from authenticated clients, and mapped legacy festival records become read-only except for explicit migration/compatibility paths.

## Repairs

`repair_festival_data_health_issue` supports safe, audited repairs such as deterministic attachment, missing mapping rebuild notes, stale reservation release notes, stale offer expiry notes, readiness recalculation records, and duplicate/historical-only marking. There is no generic fix-everything mutation.

## Stabilisation update — safe historical mappings

Historical festival operations are no longer attached to edition #1 by default. Staff, permit, and insurance rows are mapped only when the brand has a single deterministic edition; otherwise rows remain unresolved and are recorded in `festival_operation_migration_issues`. Ledger categories are normalised through the documented legacy-to-canonical mapping, while unknown categories are recorded as blockers. Ledger currency is derived from the canonical edition and unresolved rows stay flagged instead of receiving a universal USD default.
