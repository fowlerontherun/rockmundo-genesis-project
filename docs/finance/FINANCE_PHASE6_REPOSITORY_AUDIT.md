# Finance Phase 6 repository audit

## Confirmed prerequisites

- Phase 1 ledger migration is present and defines unified accounts, transactions and ledger entries.
- Phase 2 player/band finance migration is present.
- Phase 3 company operations migration is present.
- Phase 4 city economy migration is present and adds city primary currencies and treasury profiles.
- Phase 5 country taxation migration is present and adds national economies, treasuries, jurisdictions and tax assessments.

## Current currency assumptions

- Most ledger helpers use integer minor units, but Phase 1 helper functions default to USD.
- `financial_accounts.default_currency_code` existed before Phase 6, but accounts were not constrained per owner/currency/purpose.
- `financial_transactions.currency_code` existed before Phase 6, but cross-currency source/destination amounts and rate versions were not represented.
- `financial_ledger_entries` did not store currency, so ledger-line currency identity had to be inferred from transaction/account context.
- Phase 5 tax assessment calculations used jurisdiction currency and current ledger totals, with no separate historical foreign conversion evidence.

## Hard-coded currency symbols and legacy currency codes

- UI/docs contain symbol-only examples such as `$`, `£`, `€`, and `¥`.
- Several festival and booking tables already store `currency_code`, but are separate from the central finance ledger.
- Existing compatibility mirrors such as profile cash, band balance and company balance remain legacy single-currency surfaces.

## Amount fields without complete currency context

- Legacy `cash`, `band_balance`, `companies.balance` mirrors.
- Some finance UI props and chart values are amounts without currency metadata.
- Tax assessment aggregate columns are jurisdiction-currency amounts and need foreign-source conversion evidence for cross-border activity.
- Recurring obligations, reservations and some payroll/service abstractions had amount fields before dedicated Phase 6 currency policy records.

## Country currency mappings

Phase 6 seeds USD, GBP, EUR, JPY, CAD, AUD, BRL, SEK, NOK, DKK, CHF, PLN and MXN. Country assignments infer primary currency from recognised country names and retain USD fallback for unsupported or unknown countries.

## Accounts requiring migration

All `financial_accounts` receive `currency_code` from their existing `default_currency_code` or USD fallback. Multi-currency expansion is done by adding additional owner/currency/purpose accounts server-side, not by mixing currencies in one balance.

## Transactions requiring currency backfill

All existing `financial_transactions` receive source/destination currency and source/destination amount from their existing single transaction currency and net amount. Existing amounts are preserved and not converted.

## Cross-border gameplay flows

Risk areas include touring costs, foreign gig income, company service sales, merchandise sales, international payroll, player-to-player transfers and treasury transfers. Phase 6 adds durable models and central services for these flows while leaving deeper treaty/customs/banking policy for later phases.

## Reporting risks

Converted dashboard totals may be mistaken for cash available. Phase 6 separates actual balances from reporting equivalents and flags missing/stale rates.

## Tax integration risks

Current tax assessment functions aggregate ledger amounts by account. Foreign income must store historical tax-reporting conversions so old assessments are not recalculated using current rates. Phase 6 adds `foreign_tax_reporting_conversions` and a withholding placeholder but does not implement treaty relief.

## Rounding and precision risks

The system uses integer minor units for money and numeric exchange rates. Phase 6 stores applied rate, rate version, fee and rounding adjustment and provides reconciliation checks for fee mismatch, missing clearing entries and mixed-currency ledger lines.
