# Finance Phase 1 architecture

This phase introduces a single financial account and ledger foundation. Money is stored as integer minor units (`*_minor`, USD cents by default) in `financial_accounts`, `financial_transactions` and `financial_ledger_entries`; floating-point arithmetic is not used for canonical balances.

## Ownership model

`financial_accounts.owner_type` is constrained to `player`, `band`, `company`, `venue`, `city`, `country` or `system`. Owners normally use one primary operating account, enforced by a unique primary-owner index, but the schema allows additional non-primary accounts later.

## Ledger design and lifecycle

`finance_transfer` is the canonical mutation path. It locks source and destination accounts, checks active status and available balance, inserts a completed transaction and writes balanced debit/credit ledger entries in one database transaction. Completed or reversed transactions are immutable; corrections must be reversals or compensating transfers.

## Idempotency and reservations

Every transaction requires an `idempotency_key` with a unique index. Duplicate calls return the original transaction id and are logged. `finance_reserve_owner` and `finance_release_reserve_owner` adjust reserved funds so future capture flows can prevent double spending before settlement.

## Permissions

RLS lets players read their own personal account, transactions and ledger entries. Mutations run through security-definer RPCs and trusted service code; clients must not submit arbitrary account ids or direct balance updates. Band/company read permissions remain a Phase 2 hardening area.

## Legacy migration and compatibility

The migration creates primary accounts for profiles, bands and companies from `profiles.cash`, `bands.band_balance` and `companies.balance`, with idempotent `legacy-*` idempotency keys. Those legacy columns remain as deprecated compatibility mirrors while flows are migrated behind `financeService`.

## Current integrations

Phase 1 routes equipment purchases, rehearsal booking payments, DikCok fan tips and company owner deposits through `financeService` while preserving legacy mirrors for existing UI compatibility.

## Integrity checks

`financial_account_integrity_issues` reports ledger imbalances, completed transactions without entries, account balance mismatches and orphaned player accounts.

## Known limitations and Phase 2

Taxes, loans, multi-currency exchange rates, bankruptcy and dynamic economies are not implemented. Phase 2 should expand band/company finance permissions, contributions and withdrawals, revenue splits, recurring expenses and weekly cash-flow summaries.
