# Finance Phase 8B.1 Vertical Slice Audit

This audit records the effective schema after PR #1239 and the forward-only fixes introduced for the residential mortgage vertical slice.

## Effective finance and banking objects

- `financial_accounts` stores balances in `current_balance_minor`, `reserved_balance_minor`, generated `available_balance_minor`, and `default_currency_code`. Later migrations sometimes also set `metadata.account_purpose`; no reliable `currency_code` column exists in the base table.
- `financial_transactions` stores immutable transaction facts with `transaction_category`, `gross_amount_minor`, `net_amount_minor`, optional source/destination financial accounts, and an `idempotency_key`.
- `financial_ledger_entries` records one debit row against the source account and one credit row against the destination account for completed transfers.
- `bank_accounts` links playable bank accounts to `financial_accounts` through `linked_finance_account_id`, with `owner_type`, `owner_id`, `account_type`, `currency_code`, and `status`.
- `banking_providers` exposes active lenders through `provider_code`, `brand_name`, `supported_currencies`, `status`, `lending_frozen`, credit thresholds, and exposure limits.
- `banking_provider_financial_accounts` maps provider, currency, and role to one internal `financial_accounts` row.
- `loan_contracts` and `loan_schedule_lines` remain the authoritative existing-loan commitment source; affordability must read unpaid schedule lines, not stale contract-level scheduled payments.
- `recurring_financial_obligations` is the existing scheduler-facing recurring obligation table used by the loan repayment processor.

## Transaction categories

The effective `financial_transaction_category` enum includes income categories used by mortgage underwriting: `wage_payment`, `gig_payment`, `festival_payment`, `merchandise_revenue`, `streaming_royalty`, and `song_release_royalty`. It does not include `session_income`, so Phase 8B.1 excludes that category until a real writer/enum value exists. Mortgage ledger postings use `system_fee` with explicit `related_entity_type` and metadata because no mortgage-specific enum value exists yet.

## Journal and balance convention

The trusted transfer procedures debit the source account, credit the destination account, decrease source `current_balance_minor`, and increase destination `current_balance_minor`. Non-system accounts cannot go negative; system/provider accounts can represent internal asset, income, clearing, and expense accounts.

## Scheduler mechanism

Existing loans use service-only scheduled functions that scan due schedule lines and update `recurring_financial_obligations`. Phase 8B.1 follows that pattern with `process_due_mortgage_repayments(as_of_date, limit)` and derives arrears from unpaid mortgage schedule lines.

## Permission mechanism

Player ownership is resolved with `current_player_profile_id()` and existing owner-access checks such as `assert_financial_owner_permission`. Direct client writes to property ownership, mortgage contracts, schedules, payments, security, and purchase transaction tables remain blocked; borrower reads are provided through RLS and SECURITY DEFINER read RPCs.

## Known migration conflicts corrected

- Active mortgage products now require a real provider.
- Provider financial account roles are extended for mortgage funding, receivable, income, clearing, and credit-loss accounts.
- The seeded GBP mortgage product is attached to an active GBP-capable provider.
- Application idempotency no longer updates timestamps or creates duplicate snapshots/results/offers.
- Affordability normalises a 90-day source window into a monthly figure and rejects zero or insufficient income.
- Borrower-facing RLS policies are added for Phase 8B tables that PR #1239 left RPC-only or implicit.

## CI installation failure diagnosis

The repository uses npm with `package-lock.json`. A repeated `403 Forbidden` while fetching `@react-three/fiber` is consistent with a registry/authentication override rather than a package declaration issue because `@react-three/fiber` is a public package. Phase 8B.1 should verify `.npmrc`, global npm config, lockfile `resolved` URLs, scoped registry overrides, proxy settings, and CI cache state before accepting further finance work.
