# Finance Phase 8B.2 Accounting and UI Audit

## Migration reset results

A clean Supabase reset was attempted on 2026-07-20 with `npx supabase db reset --local`. The CLI is not available from the current non-Docker environment, so this PR records the exact blocker and adds a forward-only safety migration instead of editing merged migrations. The effective SQL audit below is based on the ordered migrations in `supabase/migrations` and the corrective Phase 8B.2 migration.

## Failed migration risk and exact fix

`20260719233000_finance_phase8b1_residential_mortgage_slice.sql` directly raised `mortgage_funding_cash.current_balance_minor` to £10,000,000 and implemented mortgage deposit, completion and repayment paths that bypassed the authoritative journal primitive. Phase 8B.2 does not edit that merged migration. It adds `20260720090000_finance_phase8b2_mortgage_accounting_repair.sql`, which:

- Adds mortgage-specific transaction categories for future postings.
- Adds missing linkage fields for recurring obligations, compound journals, attempts and seller settlements.
- Reverses any unjournaled development mortgage funding balance and re-capitalises it through `post_financial_journal`.
- Defines `resolve_property_seller_financial_account` for world and player sellers.
- Replaces unsafe completion, deposit reservation and repayment business functions with explicit fail-closed errors until executable accounting tests can prove the vertical slice.
- Makes scheduled repayment processing return structured result counts instead of pretending all attempts are successful.
- Makes arrears derivation idempotent by adding uniqueness and `ON CONFLICT DO NOTHING` behaviour.

## Effective columns and enum values

The merged mortgage schema uses the PR #1239-style columns: `applicant_type`, `applicant_id`, `annual_rate_bps`, `monthly_payment_minor`, `next_payment_due_date`, `principal_due_minor`, `interest_due_minor` and `fees_due_minor`. The abandoned PR #1238 names (`borrower_id` on applications, `rate_bps`, `scheduled_payment_minor`, `next_payment_date`, `scheduled_principal_minor`) must not be used for new mortgage code.

Phase 8B.2 extends `financial_transaction_category` with mortgage-specific values: `mortgage_deposit_reservation`, `mortgage_deposit_release`, `mortgage_origination`, `property_purchase_settlement`, `mortgage_principal_repayment`, `mortgage_interest_payment`, `mortgage_fee_payment` and `mortgage_redemption`.

## Trusted finance posting functions

The authoritative compound posting primitive is `post_financial_journal(...)`, introduced by Finance Phase 7.4. It locks accounts, validates currency and active status, checks non-system debit funds, requires balanced debit and credit totals, inserts `financial_transactions`, inserts `financial_ledger_entries` and updates balances in one function. Simple exact-account transfers remain available through `finance_transfer_accounts(...)` but mortgage origination, settlement and repayment require compound journals.

## Account-balance and ledger direction convention

The effective primitive treats debit entries as balance decreases and credit entries as balance increases. A journal must balance debits and credits by amount. Non-system debit entries must have sufficient available balance. Provider assets and income are therefore represented by positive account balances and must be adjusted through paired offset lines.

## Seller-account model

`resolve_property_seller_financial_account(seller_type, seller_id, currency_code)` now defines the seller destination. World-owned property proceeds route to a `system` account with `metadata.account_role = world_property_treasury`. Player-owned proceeds route to the seller's active bank-linked financial account in the purchase currency. Band/company sellers remain disabled until permissions are complete.

## Provider-capital model

Production migrations must not silently mint provider liquidity. The Phase 8B.2 migration repairs the development fixture by reversing unjournaled mortgage funding cash and then re-applying the same development amount through `post_financial_journal` with explicit audit metadata. Future provider capitalisation must use a treasury/equity/funding model and an idempotent balanced financial transaction.

## Deposit-clearing model

The intended model is `player deposit account -> mortgage_settlement_clearing` using `mortgage_deposit_reservation`, with the `property_deposits` row linking to the transaction and original source account. Release must post `mortgage_settlement_clearing -> original player account` using `mortgage_deposit_release`. Because PR #1240 used `finance_transfer(..., system_fee, metadata.destination_account_id)`, Phase 8B.2 disables that function until the exact-account route is proven.

## Repayment accounting model

A normal repayment must produce borrower cash decrease, provider cash increase, receivable decrease, interest income increase and fee income increase. Fees must post to `mortgage_fee_income`, not `mortgage_interest_income`. Phase 8B.2 disables the unsafe repayment function rather than letting unbalanced journals run.

## UI journey gaps repaired in this PR

The browser no longer routes an application ID to `/finance/mortgages/:mortgageId`. New explicit routes are used for `/finance/mortgage-applications/:applicationId` and `/finance/mortgage-offers/:offerId`, and the dashboard route remains contract-only. The UI now generates a unique idempotency key per intentional application attempt, displays RPC error states, shows underwriting/offer review pages and uses typed service adapters instead of `Record<string, any>`.

## CI installation diagnosis

`npm install` was not required because dependencies are already present in this workspace. The repository uses local file packages for Testing Library and jsdom, which avoids the previously reported npm 403 path for those packages. Full CI still requires a Supabase CLI/Docker-capable environment for migration reset and SQL workflow execution.
