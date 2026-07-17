# Finance Phase 2 architecture

Finance Phase 2 builds on the Phase 1 unified accounts and immutable ledger. All new money movement is routed through `financeService.transfer`, `financeService.debit`, `financeService.credit` or reversals; legacy balance columns remain compatibility mirrors only.

## Player finance model

The personal finance hub summarizes current cash, available and reserved money, weekly income, weekly spending, net cash flow, upcoming obligations, tax-period totals and recent transactions. Income and expense categories are explicit but extensible so future gameplay flows can map into the ledger without changing dashboard structure.

## Band treasury rules and permissions

Each band receives a `band_finance_policies` row and uses its Phase 1 primary `financial_accounts` operating account. `band_finance_role_permissions` maps existing band member roles to explicit finance permissions. Leaders receive full finance access; managers and treasurers can view detailed finance and approve ordinary payments; ordinary members can view summary balances, contribute funds and submit reimbursements.

## Contribution, withdrawal and reimbursement flow

Member contributions transfer from the player account to the band account through the central finance service with idempotency keys and a `band_contribution` ledger category. Refunds must use compensating transactions or reversals.

Withdrawal and reimbursement requests store request state separately from money movement. Funds move only after a request reaches an approved payable state. Linked transaction ids and idempotency keys prevent duplicate payment.

## Revenue distribution flow

Band policies declare eligible income categories. Contributions, refunds, administrative corrections, tax placeholders and protected asset sales are excluded by default. Distribution batches record period bounds, eligible gross income, deductions, reserve retained, distributable amount, split method, member allocations, status and idempotency key.

Initial split methods are equal, custom percentage, role weighted, retain all and reserve then distribute. Custom percentages must total 100%. Participation-aware distribution defaults to active members because attendance data is not consistently available across all income sources yet.

## Recurring obligation lifecycle

`recurring_financial_obligations` represents player and band costs such as rent, subscriptions, rehearsal space, storage and crew retainers when the underlying gameplay system already exists. The server-side processor claims due active or overdue obligations, creates unique attempt idempotency keys, pays through the finance service, records success or failure, advances the next due date and marks unpaid obligations failed or overdue without allowing unauthorized negative balances.

## Weekly snapshots and tax periods

Weekly snapshots summarize opening and closing balances, income, expenses, reserved funds, outstanding obligations, taxable income and tax withheld. Snapshots are reproducible from ledger data and are not the primary source of truth.

Tax-period summaries aggregate taxable income, non-taxable income, deductible expenses, withheld tax and tax paid. This PR intentionally does not implement country-specific tax calculation, VAT, corporation tax, audits or penalties.

## Failure and retry handling

All scheduled charges and distributions require idempotency keys. Failed recurring payments create attempts, increment failure counts and notify the owner or authorized band members. Distribution processing must be atomic: either every allocation is paid or the batch remains unpaid for recovery.
