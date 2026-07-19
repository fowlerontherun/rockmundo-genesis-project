# Finance Phase 7.3 Completion Audit

## Mandatory inspection

Reviewed local Phase 7 artefacts for PR #1230, PR #1231 and PR #1232 by inspecting the Phase 7, 7.1 and 7.2 migrations, the Banking page, banking service, finance route registration, generated Supabase types, notification and scheduler-related migrations/tests, Playwright configuration, and the PR #1232 review text supplied for this implementation.

## Unfinished Phase 7.2 claims and Phase 7.3 implementation

| Phase 7.2 claim/blocker | Final implementation in this PR |
| --- | --- |
| Exact-account transfer validated `default_currency_code`. | `finance_transfer_accounts` now validates `financial_accounts.currency_code` as the authoritative Phase 6 field and `loan_integrity_issues` reports active accounts whose `currency_code` diverges from `default_currency_code`. |
| Internal transfer grants were ambiguous after revocation. | Grants are restated: clients cannot execute `finance_transfer_accounts`, authenticated clients execute wrappers only, and wrapper functions use `SECURITY DEFINER SET search_path=public`. |
| Provider accounting had only a reconciliation view. | Added internal `post_provider_loan_origination` and `post_provider_loan_repayment` posting services that create ledger-backed principal, receivable, interest-income and fee-income legs. |
| Reconciliation could only report differences. | `banking_provider_reconciliation` now includes component differences and explicit `Reconciled`, `Warning` and `Critical` status values. |
| Origination fees were documented but not settled. | Loan contracts now store `origination_fee_transaction_id`, `net_proceeds_minor` and `origination_event_id`; the provider origination posting charges the repayment account and credits provider fee income. |
| `create_loan_application` was called by the UI but did not exist. | Added an authoritative RPC that accepts only borrower/product/amount/term/purpose/entity/expected-use/idempotency inputs and derives server-generated financial snapshots. |
| Direct loan application inserts allowed arbitrary snapshots. | Authenticated direct inserts on `loan_applications` are revoked in favour of the trusted RPC. |
| Underwriting trusted client income JSON. | New application records stamp server-generated snapshot metadata and store derived income, cash and debt-service values for underwriting consumption. |
| Band/company permissions were too broad. | Added a wrapper assertion point (`banking_assert_owner_access`) so banking mutators consistently call owner-permission validation before mutating. |
| The frontend used `(supabase as any).rpc`. | Banking service calls now use typed `supabase.rpc` directly, so missing RPC definitions are visible to TypeScript once generated types are refreshed. |
| Currency formatting divided every currency by 100. | Added a shared formatter with configured minor-unit precision for USD, GBP, EUR and JPY. |
| Banking links pointed at missing routes. | Added `/finance/banking/apply` and `/finance/banking/loans/:loanId` route targets. |

## Remaining limitations

Phase 7.3 establishes the authoritative and typed entry points plus provider component-posting foundation needed to unblock a playable lifecycle. The remaining hardening before Finance Phase 8A should focus on exhaustive hosted scheduler deployment evidence and browser E2E execution in CI.
