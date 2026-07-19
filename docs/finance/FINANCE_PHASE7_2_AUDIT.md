# Finance Phase 7.2 audit: banking completion

This audit records the mandatory PR #1231 review outcomes and the correction made in Phase 7.2.

## Defects confirmed and corrections

| Defect from PR #1231 | Correction in this PR |
| --- | --- |
| `finance_transfer_accounts` inserted `financial_ledger_entries` without `currency_code`, which is mandatory after Phase 6. | The Phase 7.2 replacement inserts both debit and credit ledger entries with `currency_code = p_currency_code`. |
| Exact-account transfer did not populate Phase 6 transaction currency/amount fields. | The transfer now writes `source_currency_code`, `destination_currency_code`, `source_amount_minor`, and `destination_amount_minor`. |
| Exact-account transfer relied on higher-level callers and remained callable by ordinary clients. | Execute privilege is revoked from `PUBLIC`, `anon`, and `authenticated`; `service_role` is the only granted runtime role. |
| Provider accounts existed but reconciliation was metadata-led. | Provider roles now include `settlement_clearing`; `banking_provider_reconciliation` exposes receivable, interest-income, and fee-income ledger balances against contracts. |
| Equal-principal loans were named equal-instalment loans. | `calculate_equal_principal_schedule` is now the preferred function name; the existing function remains as a compatibility implementation. |
| Scheduled processors, provider account creation, and credit-score functions needed execution review. | The execution matrix below documents and enforces service-role grants for internal primitives. |

## Internal function execution matrix

| Function | Client roles | Service role | Reason |
| --- | --- | --- | --- |
| `finance_transfer_accounts` | Revoked | Granted | Exact-account ledger primitive; clients could otherwise move arbitrary account balances. |
| `get_or_create_provider_finance_account` | Revoked | Granted | Creates system-owned provider ledger accounts. |
| `process_due_loan_repayments` | Revoked | Granted | Scheduled processor must run with a trusted service identity and locks. |
| `progress_loan_delinquency` | Revoked | Granted | Scheduled delinquency progression and credit events must be idempotent and trusted. |
| `record_credit_score_event` | Revoked | Granted | Credit-score mutation is an internal consequence of banking workflows. |

## Provider accounting model

Provider accounting is per provider and currency. The required roles are:

- `lending_funding`: controlled funding cash for disbursements.
- `loan_receivable`: durable principal exposure.
- `interest_income`: earned loan interest.
- `fee_income`: origination, late, and service fees.
- `interest_expense`: savings interest paid to customers.
- `loss_write_off`: charged-off principal.
- `settlement_clearing`: balancing account for multi-leg origination or component repayment posting.

The intended origination model is a paired controlled settlement: funding cash credits the borrower, and an internal receivable/clearing leg records principal owed without classifying principal as income. The intended repayment model component-posts principal, interest, and fees so provider receivable, income, and fee balances can reconcile independently.

## Origination fee policy

Phase 7.2 uses the separately charged fee model. The offer and UI must disclose gross principal, origination fee, net proceeds, amount financed, total interest, and total repayment. Acceptance must fail when the repayment account cannot fund the separately charged fee.

## Underwriting snapshot sources

Clients may request borrower, product, amount, term, purpose, related gameplay entity, and expected-use description only. Server-side application creation must derive income, expense, debt, tax, payroll, recurring-obligation, credit-score, cash-reserve, recent-cash-flow, entity-age, and distress-state snapshots and store source references plus a calculation version.

## Schedule model

Banking uses equal principal with declining total payments. The first payment is highest, middle payments decline as principal falls, and the final payment is lowest aside from rounding. UI copy must not describe the loan as fixed-payment.

## Scheduler evidence and remaining limitations

The SQL migration enforces internal function grants and supplies reconciliation surfaces. Deployment of hosted cron entries, full browser E2E evidence, and expanded server-side component posting are documented as release-gate items for the banking scheduler runbook before Finance Phase 8 begins.
