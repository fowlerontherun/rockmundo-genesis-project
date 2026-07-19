# Finance Phase 8B Mortgage Audit

## Decision

The original PR #1237 implementation must not merge as a completed Finance Phase 8B. It introduced useful TypeScript domain terms, but properties, mortgages, balances, security interests, schedules and repayments were transient objects rather than authoritative game state.

## Effective repository findings

- The unified finance foundation exists in Supabase via `financial_accounts`, `financial_transactions`, `financial_ledger_entries`, reservation helpers and reconciliation views.
- Banking Phase 7 uses provider financial-account roles, customer credit profiles, applications, offers, contracts, schedules, payment attempts and service-style RPCs.
- Notifications exist via `create_notification` and banking-specific notification tables.
- The Property Phase 8A implementation was TypeScript demo data: `generateCityProperties()` derived IDs at runtime and returned in-memory catalogue rows.
- `PropertyHub.tsx` generated properties in component execution and then called mortgage completion helpers with `demo-player` and hard-coded financials.
- Supabase generated types do not yet include the Phase 8B property and mortgage schema until a type-generation pass is run after migration application.
- The npm registry issue around `@react-three/fiber` must be repaired before this PR can be merge-ready; without a successful install, Vitest, Vite, production build and browser E2E are not reliable evidence.

## Why the current TypeScript-only model is not persistent

The previous mortgage code stored contracts, balances, rate history, arrears and settlement quotes inside JavaScript objects. Refreshing the page recreated property inventory and discarded purchase, mortgage and servicing state. There were no Supabase tables, RLS policies, RPC transaction boundaries or durable ledger links for mortgage events.

## Phase 8A property concepts requiring persistence

The mortgage feature requires stable database rows for property templates, districts, inventory, listings, ownership history, occupancies, valuations, permissions, running costs, reservations, purchase transactions, leases and deposits. A mortgage must reference a stable `properties.id`, not a runtime-generated catalogue ID.

## Operations that manufacture or destroy value

- Mortgage funding recognised a lender mortgage asset and credited the seller without debiting a real provider funding or settlement account.
- Overpayments reduced outstanding principal without debiting borrower cash or posting a provider-side receivable reduction.
- Oversized normal payments capped principal while journaling the submitted amount, leaving excess unallocated.
- Settlement was represented by an oversized repayment instead of a quote-backed settlement journal and release workflow.

## Client-supplied calculations

The former `BorrowerFinancials` accepted salary, royalties, gig income, operating profit, cash flow, savings and credit score from the caller. That made affordability browser-controllable and mixed undefined periods with monthly repayment calculations. Phase 8B now documents a server-derived 90-day player income window normalised to mortgage affordability checks.

## Demo-only routes

The old Property Hub was presentation demo code. Merely opening it generated properties, rented a home and manufactured a mortgage dashboard. The route now queries the persistent marketplace RPC and does not perform purchases, ownership changes or mortgage completion during render.

## Tests not run

Prior review evidence reported that only type checking passed and that dependency installation, Vitest, Vite, production build and browser tests were unavailable due to the recurring npm registry failure. This remains a merge blocker until CI is repaired and the required SQL, RLS, unit and E2E suites run successfully.

## Deferred functionality

This revision creates the persistent schema, fail-closed RPC surface, RLS/read policies, audit trail tables and persistent marketplace UI foundation. Full atomic completion ledger posting, scheduled repayment processing, overpayment execution, settlement execution, refinancing, browser E2E screenshots and generated Supabase types remain deferred until the ledger-integrated vertical slice is completed and tested.

## Accounting model to implement before enabling completion

- Deposit reservation: debit/lock borrower cash into a controlled reserve; release on cancellation or failure.
- Completion: transfer reserved deposit and lender funding to seller settlement exactly once; recognise mortgage receivable exactly once; transfer ownership; close listing; register security.
- Repayment: allocate principal, interest and fees separately; principal reduces mortgage receivable, interest and fees reach provider income accounts.
- Settlement: require a valid quote, debit borrower cash, clear principal/accruals/fees, release security, cancel future schedules and mark the contract redeemed.

## Readiness recommendation for Phase 8C

Do not begin Finance Phase 8C until Phase 8B has persistent properties and mortgages, authoritative affordability, atomic completion, enforceable security, durable schedules, real ledger repayments, RLS, UI journeys, SQL behavioural tests, browser E2E and reconciliation evidence.
