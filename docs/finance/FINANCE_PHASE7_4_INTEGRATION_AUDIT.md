# Finance Phase 7.4 Integration Audit

## PR #1233 review

Phase 7.3 added useful banking primitives, but the effective lifecycle remained the Phase 7.1 path: `accept_loan_offer` still used `finance_transfer_accounts` for direct principal disbursement and `process_due_loan_repayments` still sent the whole payment to provider receivable. The newly added `post_provider_loan_origination` and `post_provider_loan_repayment` were therefore unused in live origination and servicing.

## Provider accounting model

Phase 7.4 uses an atomic journal primitive, `post_financial_journal`, instead of composing provider events from unrelated two-account transfers. Each event records one parent transaction and immutable ledger entries where total debits equal total credits.

### Account roles

| Role | Direction model |
| --- | --- |
| Provider lending funding | Debited when principal leaves provider cash; credited as repayment cash arrives. |
| Loan receivable | Credited when receivable is recognised; debited when principal is repaid. |
| Provider equity | Balancing funding-source account for receivable recognition and release. |
| Interest income | Credited for interest components. |
| Fee income | Credited for origination and repayment fee components. |
| Settlement clearing | Controlled system classification account; integrity checks require it to reconcile. |
| Savings-interest expense / credit-loss expense | Reserved provider roles for deposit interest and write-off events. |

### Origination example

For a 10,000 loan with a 100 fee:

| Entry | Debit | Credit |
| --- | ---: | ---: |
| Provider lending funding | 10,000 | - |
| Borrower bank cash | - | 10,000 |
| Provider equity/funding source | 10,000 | - |
| Loan receivable | - | 10,000 |
| Borrower repayment account | 100 | - |
| Fee income | - | 100 |

Provider funding is reduced once, borrower receives principal once, receivable is recognised through the provider funding-source offset, and the fee is collected separately.

### Repayment example

For a 1,000 principal, 50 interest, 10 fee repayment:

| Entry | Debit | Credit |
| --- | ---: | ---: |
| Borrower repayment account | 1,060 | - |
| Provider lending funding | - | 1,060 |
| Loan receivable | 1,000 | - |
| Provider equity/funding source | - | 1,000 |
| Settlement clearing | 60 | - |
| Interest income | - | 50 |
| Fee income | - | 10 |

The borrower is charged once, provider cash receives the whole repayment, principal reduces receivable, and interest/fees post to their income accounts.

## Effective function audit

- `accept_loan_offer`: replaced to create a pending contract, schedule and obligation before calling `post_provider_loan_origination`; the contract is activated only after the journal posts.
- `process_due_loan_repayments`: replaced to call `post_provider_loan_repayment`, update exact component totals, next due line and recurring obligation state.
- `finance_transfer_accounts`: retained for simple trusted exact-account movements, but not used for provider loan journals.
- `post_provider_loan_origination`: replaced with one balanced journal.
- `post_provider_loan_repayment`: replaced with one balanced journal.
- `create_loan_application`: replaced with input validation and recent-period classified income snapshots.
- `loan_integrity_issues`: restored from the Phase 7 view and extended for journal, reconciliation and next-payment defects.
- `banking_provider_reconciliation`: extended with settlement-clearing and provider component differences.

## Frontend placeholders corrected

`BankingApply` and `BankingLoanDetail` no longer claim unimplemented settlement or partial-repayment features. The application page now loads products/accounts, validates amount and term, submits applications, reads offers and accepts using selected accounts. The loan detail page reads real loan detail, schedule and payment-attempt RPCs and exposes retry for due/failed lines.

## Missing RPC inventory addressed

Phase 7.4 adds the minimum player journey RPC set: provider listing, eligible products, player bank accounts, account opening, application result, active offer, loan details, schedule, payment attempts and manual retry. Settlement and partial repayment remain explicitly deferred.

## Permission defects

The PR centralises mutating entry points through `banking_assert_owner_access`. Player borrowing is fully enabled. Band and company borrowing remain backend-validated and UI-marked as unavailable until approval thresholds are expanded with complete governance flows.

## Test gaps closed

A Phase 7.4 behavioural SQL harness was added to check the presence and expected behaviour of the new journal, acceptance, repayment, reconciliation, income and permission surfaces. Frontend unit coverage was added for the player application and detail journey helpers.

## Remaining limitations

- Mortgages, collateral, property-secured lending, settlement quotes and partial repayments are intentionally deferred.
- Browser E2E fixtures still depend on the local Supabase seed dataset being available.
- Band/company UI borrowing is read-only until the wider approval workflow is completed.

## Readiness decision for Finance Phase 8A

Phase 8A may proceed only after clean migrations, SQL behavioural tests, RLS tests, type generation, typecheck, lint, unit tests, production build, browser banking E2E, loan reconciliation, provider reconciliation and the banking integrity report all pass.
