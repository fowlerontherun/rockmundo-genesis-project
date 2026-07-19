# Finance Phase 7.1 Banking Hardening Audit and Corrections

Finance Phase 7 is a banking foundation, not a completed player-facing banking system. This Phase 7.1 slice confirms the critical security and settlement defects from PR #1230 and adds the first corrective migration before any property, mortgage, collateral or insurance work builds on banking.

## Confirmed Phase 7 defects

| Defect | Confirmation | Correction in this PR |
| --- | --- | --- |
| Loan schedule RLS was too permissive | `loan_schedule_owner_select` only checked that a parent contract existed. | Replaced with `can_access_loan_contract`, which ties schedule visibility to the parent borrower. |
| Child banking records lacked explicit parent authorization | Several child tables had RLS enabled but no owner-select policies. | Added parent authorization policies for underwriting results, offers, payments, delinquencies, defaults, restructurings, refinances, savings accruals, credit events and debt snapshots. |
| SECURITY DEFINER functions trusted caller-supplied owner IDs | Opening accounts, underwriting and offer acceptance did not assert caller authority over the applicant/borrower. | Added `assert_financial_owner_permission` and applied it to account opening, underwriting and offer acceptance. |
| Scheduled processors were callable by ordinary clients | Repayment and delinquency functions had no service-role gate. | Added `is_service_role` checks so scheduled processors require trusted service execution. |
| Loan disbursement ignored the selected bank account | Offer acceptance credited the owner-level primary account and stored the chosen bank account only in metadata. | Added `finance_transfer_accounts` and updated acceptance to credit `disbursement_bank_account_id -> linked_finance_account_id`. |
| Loan repayment ignored the selected repayment account | Automatic repayment debited the owner-level primary account. | Updated repayment processing to debit `repayment_bank_account_id -> linked_finance_account_id`. |
| Provider accounting was anonymous | Phase 7 used generic system settlement without durable provider-side lending accounts. | Added provider finance accounts for funding, receivable, income, fee, write-off and interest-expense roles; origination and repayment metadata now identify provider accounting accounts. |
| “Equal instalment” was actually equal principal | Schedule generation used equal principal, resulting in declining payments. | Documented the selected Phase 7.1 model as equal principal and marks offer/contract metadata accordingly; a later UI must label payments as declining. |
| Recurring obligation amount used the maximum schedule row | The recurring obligation could imply a fixed charge when the schedule varies. | New contracts use the recurring obligation as a trigger with amount `0` and `dynamic_amount_from = loan_schedule_lines`. |
| Rejected applications always damaged credit | Underwriting applied `-5` for every rejection. | Removed automatic rejection penalties from underwriting; credit changes now focus on repayment/default behaviour and explicit service/admin adjustments. |
| Repayment errors were swallowed | The processor converted all exceptions to an obligation failure with no durable detail. | Added `loan_payment_attempts` with failure category, code, user message, retry data and internal error reference. |
| Delinquency penalties/fees could repeat | The old progression logic could apply credit events repeatedly by stage. | Delinquency now ignores paid/cancelled lines, is service-only, inserts idempotent stage records, and checks for duplicate score events. |

## Authorisation model

`assert_financial_owner_permission(owner_type, owner_id, permission_key, actor_user_id)` is the reusable gate for privileged banking operations. It currently supports:

- player self-access through `profiles.user_id = auth.uid()`;
- band access through active membership visibility inherited from existing `band_members` records;
- company access through `companies.owner_id = auth.uid()`;
- admin access via `has_role(auth.uid(), 'admin')`;
- scheduler access via the Supabase `service_role` JWT role.

This is intentionally conservative. Where the repository later exposes richer band/company finance-permission tables, this helper should be extended rather than bypassed.

## Exact account settlement model

`finance_transfer_accounts(source_account_id, destination_account_id, amount_minor, currency_code, category, description, idempotency_key, ...)` transfers between exact finance accounts. It:

- requires both account IDs;
- locks accounts deterministically;
- verifies status and matching currency;
- enforces available-balance checks for non-system sources;
- writes one immutable transaction and balanced debit/credit ledger entries;
- returns the existing transaction for safe idempotent retries.

Loan origination now credits the selected disbursement bank account’s linked finance account. Loan repayment now debits the selected repayment bank account’s linked finance account.

## Provider accounting model

Each provider/currency can now have explicit provider accounts:

- `lending_funding` funds loan principal disbursement;
- `loan_receivable` represents outstanding provider exposure and receives repayment cash;
- `interest_income` identifies scheduled interest allocation;
- `fee_income` identifies fee allocation;
- `loss_write_off` is reserved for future write-off accounting;
- `interest_expense` is reserved for provider-funded savings interest.

The current implementation records receivable/income account IDs in transaction metadata. A later ledger refinement should split repayment transactions into separate component transfers when the base ledger supports component postings without compromising balance.

## Repayment schedule formula

Phase 7.1 keeps the existing equal-principal formula for compatibility:

1. Base principal is `floor(principal / term_months)`.
2. Monthly interest is calculated from opening principal and annual basis points divided by 12.
3. Final principal is adjusted to clear the remaining principal exactly.

The borrower-facing UI and documentation must describe this as declining equal-principal payments, not fixed equal instalments.

## Credit-score rules

- Product ineligibility, provider unavailability, unsupported currency and exposure-limit rejection do not automatically reduce credit.
- Positive repayment movement is capped and receives diminishing returns within a rolling period.
- Negative credit adjustments require service-role or admin execution.
- Duplicate related credit events are ignored over a short idempotency window.

## Failure classification

Repayment attempts are recorded as `succeeded` or `failed`. Failures are classified into borrower-funds, account-status, currency-mismatch or system categories, with a safe user-facing message and retriable metadata. Only borrower-caused failures should feed delinquency or credit damage.

## Remaining limitations

This PR is a security and settlement hardening slice, not the full playable vertical slice requested for the complete Phase 7.1 programme. Still remaining:

- full banking hub UI and guided loan application UI;
- manual repayments, early repayment, settlement quotes and payoff;
- restricted payroll lending enforcement;
- savings-interest accrual/payment scheduler;
- richer band/company finance permission mapping;
- browser E2E coverage;
- deployed scheduler configuration evidence;
- full provider receivable reconciliation entries by principal/interest/fee component.
