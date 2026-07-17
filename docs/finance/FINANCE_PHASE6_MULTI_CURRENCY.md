# Finance Phase 6: Multi-currency accounts, FX and international activity

## Repository audit findings

Finance Phases 1–5 are present as Supabase migrations for the unified ledger, player/band money management, company operations, city economies and country taxation. Phase 1 introduced `financial_accounts`, `financial_transactions` and `financial_ledger_entries` with integer minor-unit storage, but most helper functions still defaulted to USD. Phase 4 added `cities.primary_currency_code` and city treasury accounts. Phase 5 added `country_economic_profiles.primary_currency_code`, national treasury profiles and tax jurisdictions, but its foundation function still seeded treasuries and tax jurisdictions as USD.

Current currency assumptions found during the audit:

- `financial_accounts.default_currency_code` existed, but unique primary-account constraints were owner-level rather than owner/currency/purpose-level.
- `financial_transactions.currency_code` existed, but did not preserve separate source and destination currencies, amounts, rate version, fee or rounding values.
- `financial_ledger_entries` did not store a currency code on each ledger line.
- Country, city, festival and some touring flows already had currency-code placeholders, while many finance helpers still assumed one domestic account.
- Tax assessments used the jurisdiction currency, but had no durable foreign-transaction conversion evidence.
- Legacy UI and docs still contain hard-coded symbols such as `$`, `£` and `€`; Phase 6 centralises currency definitions and documents remaining symbol-only UI as migration risk.
- Rounding risk existed where rates or taxes used numeric calculations without storing conversion adjustments; Phase 6 stores conversion fees, rate versions and rounding adjustments.

## Currency architecture

Phase 6 adds a central `currency_definitions` model with ISO-style codes, display names, symbols, minor-unit precision, status, default formatting locale, minimum transferable amounts, supported maximums, exchange enablement and effective dates. Formatting should now be driven from this table rather than scattered symbol constants.

Country currency assignment is effective-dated through `country_currency_assignments`. Cities continue to inherit country primary currency unless a future explicit exception is introduced. Historical account and transaction currencies are not rewritten by later country assignment changes.

## Initial currencies and country assignments

The foundation seed creates active definitions for the currently supported currency set: USD, GBP, EUR, JPY, CAD, AUD, BRL, SEK, NOK, DKK, CHF, PLN and MXN. Country profiles are mapped by recognised country names where possible, with USD as a safe fallback for unknown or unsupported countries.

## Multi-currency account model and migration strategy

Financial accounts now have an explicit `currency_code` and `account_purpose`. The preferred model is one active owner account per currency and purpose, with `get_or_create_financial_account_for_currency` creating player, band, company, city, country or trusted system accounts server-side. Existing balances are backfilled into their current/default currency and are not converted during migration.

System FX clearing, reserve, fee and rounding accounts are created per currency. In this first implementation they are accounting-clearing accounts, not constrained central-bank liquidity reserves. Negative balances are allowed only for system-owned clearing/reserve accounts so conversions can be represented without creating a separate foreign-currency ledger.

## Exchange-rate model and stability controls

`exchange_rates` stores versioned effective-dated currency pairs. USD is the internal reference currency for seeded generated rates, but this is only a rate-calculation implementation detail and does not replace actual account currencies. The model stores rate source, calculation method, status, volatility tier, version and timestamps. Active pair uniqueness prevents contradictory active rates.

`exchange_rate_controls` stores maximum daily/weekly moves, min/max rates, smoothing windows, volatility tiers, administrative freezes, manual overrides with expiry and circuit-breaker state. Scheduled rate processing activates scheduled rates, supersedes expired active rates, expires events and snapshots reserves.

## Conversion flow, fees and rounding

The trusted server-side conversion service supports quoting, quote expiry and execution. Clients supply amount and desired currency pair only; trusted exchange rates, fees, expiry and clearing accounts are selected on the server. Quotes include gross destination amount, explicit fee, rounding adjustment, net destination amount, expiry and rate timestamp.

Completed conversions create balanced same-currency ledger movements:

1. Source currency moves from the owner source account to the source currency clearing account.
2. Destination currency moves from the destination currency reserve account to the owner destination account.
3. Visible conversion fees move to the destination currency fee account.
4. Rounding adjustments are stored and reserved for reconciliation through rounding accounts.

Currency-specific minor-unit rounding uses deterministic half-up minor-unit rounding through `currency_round_minor`. Same-currency conversions are treated as no-rate/no-fee no-ops in quote calculation.

## International transfers, touring, company sales and payroll

`international_transfers` records sender and recipient currencies, amounts, rate, fee, status, compliance placeholders and settlement policy. Supported policies include preserving recipient currency, preserving sender currency and explicit authorised selection.

Foreign touring support is represented by `foreign_gig_income_records`, which preserves gross local income, local fees, local withholding placeholders, net local income, conversion status, reporting equivalents and the related gig/city/country. Bands can retain local currency or convert later, allowing realised gain/loss reporting.

Foreign company sales continue to preserve invoice currency on the ledger while conversion is recorded separately through conversion records. `international_payroll_contracts` supports company-currency and employee-currency contracts with employer-bears, employee-bears and no-conversion policies. Arbitrary unsupported contract currencies remain out of scope.

## Tax-reporting conversion and withholding placeholder

Tax assessments remain jurisdiction-currency based. `foreign_tax_reporting_conversions` stores original amount/currency, tax-reporting amount/currency, applied historical rate, rate timestamp and rate version. `foreign_tax_withholding_placeholders` captures informational foreign withholding without implementing treaty relief or double-tax relief.

## Currency gains, losses and exposure

`realised_currency_gain_losses` tracks realised movement using a simplified weighted-average reporting-basis method. `currency_exposure_snapshots` stores informational unrealised exposure for dashboards and planning. Unrealised movement does not create ledger entries, does not move cash and is not treated as taxable income in this phase.

## Reporting, charts and admin controls

`multi_currency_balance_summary` separates actual balances from reporting equivalents and flags missing/stale rates. Company and band FX reports aggregate currency positions. `currency_rate_chart_view` provides lightweight chart data without any trading affordance. `admin_currency_controls_view` exposes currency definitions and rate controls for admin tooling.

## Reconciliation and security

`reconcile_currency_conversions` flags missing currencies, mixed-currency ledger entries, conversions without rate versions, cross-currency transactions without destination amounts, fee mismatches, missing clearing entries, unsupported currency accounts and tax conversion records missing rate evidence.

RLS exposes public currency/rate reads and owner-only player conversion/transfer reads. Mutations are through security-definer functions so clients cannot submit trusted rates, create fees, alter quote expiry, select clearing accounts, backdate completed conversions or modify completed conversions.

## Known limitations and remaining single-currency flows

- Legacy finance helpers that call `finance_transfer`, `finance_credit_owner` or `finance_debit_owner` still default to USD until they are migrated to currency-aware wrappers.
- Some React screens still format with hard-coded symbols and should be moved to `currency_definitions`-driven formatting.
- Festival and touring tables with currency-code columns are documented but not fully wired into automatic cross-currency settlement in this migration.
- Foreign withholding is informational only and does not implement treaty credits.
- Currency exposure snapshots are available but not yet scheduled for every owner dashboard.
- No speculative FX trading, order books, leverage, crypto, central-bank simulation or international tax treaties are implemented.

## Recommended Finance Phase 7 scope

Phase 7 should implement banking, credit and financial risk: bank accounts, savings, interest, personal/company/band loans, credit scores, repayment schedules, affordability checks, missed payments, defaults, refinancing, bank providers, country interest-rate baselines and initial bankruptcy/administration integration.
