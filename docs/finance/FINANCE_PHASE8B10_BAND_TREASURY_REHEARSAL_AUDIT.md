# Finance Phase 8B.10 Band Treasury and Rehearsal Audit

## Decision

The authoritative spendable band balance for the Band Finances page is now the active ledger treasury account balance: `financial_accounts.available_balance_minor` for the selected band treasury currency.

`bands.band_balance` remains a deprecated compatibility mirror while older gameplay surfaces are migrated. New Band Finances reads must not use it for spendability.

## Current model inventory

| Area | Current source | Unit | Divergence risk |
| --- | --- | --- | --- |
| Band Finances summary | `get_band_treasury_dashboard()` reading band-owned `financial_accounts` | Minor units returned to the browser and formatted as major units | Low for ledger-backed contributions; avoids stale `bands.band_balance` |
| Legacy commercial income/expenses | `band_earnings.amount` | Major units | Can diverge from ledger because historical earnings triggers update `bands.band_balance`, not treasury ledger accounts |
| Legacy balance mirror | `bands.band_balance` | Major units | High; many older features still mutate it directly |
| Voluntary contributions | `band_financial_contributions` plus `financial_transactions` and `financial_ledger_entries` | Minor units | Low when shown through the dashboard RPC |
| Band treasury accounts | `financial_accounts` with `owner_type = 'band'` | Minor units | Authoritative for spendability |
| Rehearsal funding | `preview_rehearsal_booking_funding` and `confirm_rehearsal_booking_with_funding` | Minor units in funding RPCs; some legacy UI paths still supply major-unit costs | Still requires the full Phase 8B.10 rehearsal vertical slice |

## Direct `bands.band_balance` mutations found

Several legacy browser pages, hooks and edge functions still read or mutate `bands.band_balance` directly for gigs, tours, releases, PR, vehicles, recording, label flows and weekly pay. Those flows can diverge from ledger-backed band treasury balances until each is migrated to ledger posting or a database-maintained projection.

## Ledger-posting paths found

The newer finance migrations use `financial_accounts`, `financial_transactions`, `financial_ledger_entries`, `band_financial_contributions`, `band_expense_payments` and related reconciliation tables. Voluntary band contributions now surface through `get_band_treasury_dashboard()` instead of requiring the browser to query contribution rows directly.

## Migration strategy

Preferred strategy is adopted: deprecate `bands.band_balance` from new gameplay reads and writes. Keep it temporarily only for compatibility with unmigrated legacy features. During future migration work, legacy flows should either post balanced ledger journals or write to a database-maintained projection sourced exclusively from ledger entries; they must not independently mutate the mirror.

## Remaining rehearsal gap

This PR begins the treasury-authoritative Band Finances slice, but the larger rehearsal booking work still needs the dedicated quote, permission, atomic confirmation, cancellation and source-aware refund implementation described in the Phase 8B.10 acceptance criteria.
