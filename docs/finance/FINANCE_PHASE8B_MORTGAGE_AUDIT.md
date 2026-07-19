# Finance Phase 8B mortgage audit

## Decision

PR #1237 must be revised in-place before Phase 8C. The previous TypeScript-only mortgage domain model was useful as vocabulary, but it was not a persistent, secure or playable secured-lending system.

## Effective repository findings

- Banking has durable accounts, transactions, ledger entries, provider account roles, loan applications, offers, contracts, schedule lines, recurring obligations and service-role journal posting in `20260719200000_finance_phase7_4_banking_integration.sql`.
- Provider accounting uses `post_financial_journal(...)` and `banking_provider_financial_accounts`; mortgage accounting must reuse this pattern rather than creating JavaScript journals that are never posted.
- Phase 8A property data lived in `src/services/banking/propertyPhase8A.ts`; `generateCityProperties()` generated runtime IDs and in-memory ownership, leases, valuations and journals.
- The old Property Hub rendered generated properties and called `rentProperty(...)` for `demo-player` during component execution. That page-render side effect has been removed and the page now reads `list_persistent_properties()`.
- Existing scheduler and recurring-obligation support is represented by `recurring_financial_obligations` and the loan repayment processor. Mortgage repayment processing should follow the same service-only model.
- Existing notifications can be called from trusted RPCs or service jobs; this slice records durable audit state and leaves broad fan-out expansion deferred where the current repo has no mortgage-specific notification consumer.
- Supabase generated TypeScript types are not authoritative for new migrations until the project runs type generation after database reset.
- CI previously could not prove Vitest, Vite, build or browser tests because dependency installation failed around `@react-three/fiber`; the registry/lockfile state must be repaired and all checks rerun before merge.

## Why the original TypeScript-only model was not persistent

The original model stored mortgage products, contracts, payments, settlement quotes, refinancing, arrears and equity in local TypeScript objects. Refreshing the page, opening a new browser or calling from another process would lose the mortgage state. It also allowed callers to mutate balances without row locks, RLS, idempotency, durable financial transactions or audit events.

## Phase 8A concepts requiring database persistence

Phase 8B now adds persistent tables for districts, templates, properties, listings, ownership history, occupancies, valuations, permissions, running costs, reservations, purchase transactions, leases and deposits. Mortgages must reference stable property UUIDs rather than generated catalogue entries.

## Value manufacture/destruction risks in the previous implementation

- Mortgage funding credited a seller-facing account without debiting a provider cash or settlement account.
- Overpayments reduced outstanding principal without debiting borrower cash or crediting provider cash.
- Oversized normal repayments capped principal but journaled the full submitted amount, allowing excess value to disappear.
- Settlement was simulated by passing an oversized regular payment instead of validating a quote and posting a settlement journal.
- Balance checks compared debit and credit totals but did not prove correct account roles, component allocation or provider receivable reconciliation.

## Client-supplied calculation risks

The original affordability function accepted salary, royalties, gig income, savings, credit score, commitments and company profit from the caller. The revised server RPC accepts only property, product, term, deposit, currency and idempotency key, then derives income and cash from financial transactions and financial accounts for a documented twelve-week source period.

## Demo-only routes and removed behaviour

`/finance/properties` no longer generates city properties or rents/buys anything during render. It calls `list_persistent_properties()` and displays fallback data only when the RPC is unavailable. Application and dashboard journeys are scaffolded by schema/RPCs but still need full route depth and E2E coverage before claiming completion.

## Tests not yet proven

The repository still needs a clean dependency install, type generation, lint, unit tests, SQL/RLS tests, production build and browser E2E run in CI. `supabase/tests/finance_phase8b_mortgage_integration.sql` documents the required behavioural assertions and should be run against a reset database.

## Deferred functionality

- Band and company mortgage journeys are schema-prepared only.
- Variable-rate repricing is disabled for player applications unless a future PR implements scheduled repricing.
- Refinancing is schema-recorded but explicitly deferred unless the full settle-and-replace workflow is implemented.
- Repossession, foreclosure, auctions, shared ownership, equity release, offset mortgages and commercial property operations remain non-goals.
