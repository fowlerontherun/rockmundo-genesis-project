# Company economy recovery: first authority and accounting batch

Date: 2026-11-24. RockMundo live Supabase project: `yztogmdixmchsmimtent`.

## Problems confirmed

- The former creation hook deducted profile cash in the browser, inserted a company and then attempted a separately written ownership record. It could leave partial work behind; it allowed starting capital to be created without equivalent owner funding.
- The former closure hook edited profile cash, wrote a transaction, deleted transactions and tax records, and deleted the company, without atomic settlement or preservation of financial history.
- Owners could INSERT companies and company_transactions, and modify protected company fields through broadly granted database access.
- Company summaries treated every positive company transaction as income and every negative one as an expense, so investments, transfers and dividends skewed operating profit. Counting every non-holding company as a subsidiary was also inaccurate.
- Period queries were vulnerable to the Supabase/PostgREST page cap, truncating totals for busy companies.
- Two separate share models exist: company-level `company_shareholders` (founder ownership) and character-level `company_shares` (festival/public trading). They have not yet been merged into a safe cap table.

## Live baseline and non-destructive decisions

At the audit there were 11 company records, 10 non-festival owners backfilled to the missing `company_shareholders` table, and one festival with legacy character share ownership. The sum of `companies.balance` was 126,813,550.17 game currency units. Three of the 11 companies had no primary `financial_accounts` record; each of the other eight had a mismatch with its account's ledger balance (225,006,265 minor units in total absolute difference).

No player/company historical balance was changed. The missing ledgers cannot be safely reconstructed by simply setting one column equal to another. The weekly company processor may have posted income but only adjusted `companies.balance` for expenses. That worker, and every type of deposit/withdrawal or payout, must be traced to ledger receipts first.

Staffing baseline: 0 active company employees, 0 employment contracts, 12 company vacancies (none active), 1,138 shifts, 455 claims (195 completed, 260 claimed). The shift workflow is in use, but it is not a substitute for a reconciled payroll/employment model.

## Changes now present in production (2026-11-24)

1. Restricted client SQL writes to companies, shareholders, shares and company transactions. Company metadata editing remains allowed.
2. Created founder shareholders and backfilled non-festival owners without rewriting festival stakes.
3. Installed authenticated idempotent `found_company` and `close_company` RPCs. Closing a company preserves history and refuses operation while balance reconciliation or staff, contracts, claims, taxes or other shareholder obligations are outstanding.
4. Founding requires both the registration fee and owner-funded working capital, recorded through finance ledger operations. Replayed idempotency keys do not double-charge.
5. Disabled the legacy dividend RPC for players until a ledger-authoritative replacement is available.
6. Rewired frontend operations to RPCs, adjusted operating P&L classification, fixed subsidiary counting and paginated the finance rollups.

The SQL files in this branch reconstruct the already-applied production changes in versioned migration form; do not reapply as ad-hoc destructive data fixes.

## Next release gates

1. **Reconcile financial accounts:** identify every missing/mismatched company financial account, trace historical ledger events, and repair with idempotent, auditable compensation only after establishing the correct starting state.
2. **Weekly income, costs and payroll:** route every company charge or credit through unified finance functions and record an unambiguous company transaction and tax-period receipt. Preserve earnings periods and prevent double runs.
3. **Real staffing:** clarify player/NPC vacancy requirements, hiring, employment contract lifecycle, salary and shift claims; align company staff counts with records and enforce payroll funding.
4. **Ownership and dividends:** establish an authoritative cap table across `company_shareholders` and `company_shares`, verify 100% allocations and transfer constraints, then reintroduce payouts via the ledger.
5. **Verification:** exercise authenticated happy/failure paths with test users on a staging project, including double submissions, insufficient funds, company closure with obligations, weekly retries, taxes and RLS. Do not use real player data for these tests.

Read-only diagnostics: `supabase/diagnostics/company_finance_reconciliation.sql`.
