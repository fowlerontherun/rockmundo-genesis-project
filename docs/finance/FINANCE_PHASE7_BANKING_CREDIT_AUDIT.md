# Finance Phase 7 repository audit: banking, credit and controlled financial distress

## Confirmation of prerequisites

Finance Phases 1–6 are present as ordered Supabase migrations and documentation. Phase 1 introduced `financial_accounts`, `financial_transactions`, `financial_ledger_entries`, idempotent `finance_transfer`, balance immutability and ledger integrity views. Phase 2 added band/player finance policies, recurring obligations, withdrawal/reimbursement/distribution workflows and tax-period summaries. Phase 3 added company payroll, unpaid wage liabilities, owner capital and withdrawal controls. Phase 4 added city economy accounts and public spending/grants. Phase 5 added country tax profiles, assessments, historical tax conversion hooks and tax classifications. Phase 6 added explicit currencies, exchange rates, conversion quotes, conversion execution, clearing accounts and international settlement controls.

## Existing debt fields and placeholders

- `player_loans` appears in legacy migrations as an existing placeholder with a later `profile_id` backfill; it is not integrated with the unified ledger, repayment schedules, credit scoring or Phase 6 currency services.
- Company operations already contain unpaid wage liabilities and owner withdrawal restrictions, which behave like operational arrears rather than formal bank borrowing.
- Band withdrawals, reimbursements and recurring obligations can resemble repayment-like workflows, but no canonical loan contract existed before Phase 7.
- Some admin/company screens still expose direct balance editing and negative-balance fields, which remain legacy compatibility risks.

## Negative-balance behaviour

The Phase 1 account constraint keeps non-system `financial_accounts.current_balance_minor` non-negative, while system accounts may go negative for controlled settlement/funding purposes. Legacy company fields include `negative_balance_since` and bankruptcy flags, so Phase 7 treats these as distress inputs rather than source-of-truth balances. New bank accounts never maintain a separate mutable balance; they reconcile to linked finance accounts.

## Current account types

Before Phase 7, the authoritative account type was effectively `financial_accounts.account_purpose` plus owner type/currency. Phase 7 adds bank-account product records for current, savings, business current, band, tax reserve, restricted, loan-disbursement placeholder and currency accounts, each linked one-to-one to a finance account.

## Current repayment-like obligations

`recurring_financial_obligations` already supports owner, amount, currency, due date, auto-pay, attempts and idempotency. Phase 7 reuses it for scheduled loan repayments through `related_entity_type='loan_contract'`, avoiding a parallel scheduler.

## Financial-health and distress indicators

Existing company finance includes payroll records, unpaid wage liabilities, owner capital contributions, owner withdrawal requests and company health/distress concepts. Phase 7 adds debt-service views, delinquency records, credit score events and an insolvency assessment service so debt becomes one input to distress rather than replacing company health.

## Currency assumptions

Phase 6 removed many hard-coded USD assumptions by adding `currency_code` to finance accounts and ledger entries plus safe conversion quotes. Phase 7 restricts loan currency to provider/product supported currencies, requires repayment accounts in the loan currency by default, and stores original loan currency on every application, offer, contract, schedule line, payment, interest accrual and exposure snapshot.

## Tax implications

Borrowed principal is recorded as `loan_disbursement` with `metadata.taxable=false` and `metadata.liability=true`, so it is not income or profit. Savings interest uses the `savings_interest` category and `taxable_interest_income` classification on accrual records for downstream Phase 5 tax reporting. Principal, interest and fees are separated so tax rules can treat interest/fees without reclassifying principal.

## Security risks addressed

- Clients cannot set credit scores; only `record_credit_score_event` updates profile score and writes history.
- Clients cannot approve applications or submit accepted rates; `evaluate_loan_application` calculates offers server-side.
- Clients cannot activate offers directly; `accept_loan_offer` validates ownership, expiry, currency and eligible bank accounts.
- Provider funding remains system-owned and inaccessible through bank account records.
- Band and company borrowing permissions are represented in permissions/product restrictions for server enforcement by follow-up RPCs and UI gates.

## Migration requirements

The migration is idempotent: it creates banking profiles for existing players, bands and companies with neutral credit, seeds fictional banking providers/products, and does not relocate existing funds. Legacy loans remain documented for review unless reliably mapped into new loan contracts in a later data migration. Existing recurring obligations are preserved and duplicate active loan repayment obligations are flagged by integrity checks.

## Double-counting risks

The highest double-counting risk is any downstream reporting that treats all `destination_account_id` credits as income. Phase 7 mitigates this by adding `loan_disbursement`, setting `taxable=false`, and adding `loan_disbursement_classified_as_income` to integrity checks. Savings interest intentionally remains taxable income where configured.
