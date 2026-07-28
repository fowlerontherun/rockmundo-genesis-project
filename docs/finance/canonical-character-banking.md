# Canonical character banking and band funding audit

## Previous split

The Banking page called a legacy `bank_accounts` facade and deposited into `bands.band_balance`, while Band Finances read Finance Phase 7 `financial_accounts`. The cash reconciliation migration could also overwrite cached account balances without a ledger entry. Those independent write paths made character, bank, treasury, and ledger totals disagree.

## Source-of-truth rules

`financial_accounts`, `financial_transactions`, and balanced `financial_ledger_entries` are authoritative. `profiles.cash` is the whole-major-unit projection of the active character wallet. `bands.band_balance` is a compatibility projection of the band's primary canonical treasury only; multi-currency treasuries are always displayed separately and never summed. Gameplay RPCs lock money rows, reject currency mismatch, and post the debit and credit together. Legacy browser execute privileges are revoked.

## Player flows

* **Wallet → bank → band:** `open_my_bank_account` atomically creates a canonical deposit account and moves an optional whole-unit opening amount. Deposits, withdrawals, and bank transfers use active-profile-derived RPCs. `fund_my_band` can then debit the selected eligible bank account.
* **Wallet → band:** the shared Add Money to Band panel selects Character wallet without requiring a bank account, previews both resulting balances, and confirms once. A treasury in the wallet's actual currency is created when needed; no FX is implicit.

## Live-data repair

The forward migration preserves the visible whole-unit wallet value. It compares that projection with the wallet ledger, restores the cached account value to the ledger-derived value, and posts an explicit system reconciliation journal for the remaining visible-balance delta. It does not delete accounts, transactions, contributions, or ledger history. The projection integrity view reports future wallet or legacy band projection drift.
