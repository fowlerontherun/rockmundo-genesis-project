# Band Treasury Consolidation Audit

Supabase migration order is filename-timestamp order, so the newest `CREATE OR REPLACE FUNCTION` in the clean reset chain wins for each RPC definition.

## Precedence finding

PR #1253 added `20291217080000_fix_deployed_band_treasury_dashboard.sql` as a forward repair for deployed Band Treasury dashboard functions. PR #1254 then added `20260720213000_finance_band_treasury_consolidation.sql`, but its 2026 timestamp means a clean reset applies it before the already-existing 2029 repair. As a result, before this finalisation migration, the 2029 repair won for `get_band_treasury_dashboard` and `preview_my_band_contribution`.

## Authoritative final migration

`20291217090000_finance_band_treasury_finalisation.sql` is intentionally later than both `20260720213000_finance_band_treasury_consolidation.sql` and `20291217080000_fix_deployed_band_treasury_dashboard.sql`. It is now the authoritative final definition for the consolidated Band Finances RPC contract overwritten by the 2029 repair.

The final migration preserves the historical migrations, reasserts the secure dashboard and preview function definitions, checks required `band_finance_permission` enum values during migration, enforces `view_band_balance` before exposing balances, and preserves first-contribution preview semantics with `treasuryWillBeCreated`.

## Function definition order inspected

- `current_player_profile_id`: first defined by `20260719220000_finance_phase8b_persistent_mortgages.sql`; final definition is the active-profile wrapper from `20260720213000_finance_band_treasury_consolidation.sql`.
- `current_active_player_profile_id`: defined by `20260720213000_finance_band_treasury_consolidation.sql`; no later migration replaces it.
- `is_bank_account_eligible_for_outgoing_payment`: defined by `20260720201000_finance_phase8b10_band_treasury_dashboard.sql`; final definition and private grants are from `20260720213000_finance_band_treasury_consolidation.sql`.
- `get_my_eligible_band_contribution_accounts`: defined by `20260720193000_finance_phase8b9_band_deposit_accounts.sql` and `20260720201000_finance_phase8b10_band_treasury_dashboard.sql`; final definition is from `20260720213000_finance_band_treasury_consolidation.sql`.
- `get_band_treasury_dashboard`: defined by `20260720201000_finance_phase8b10_band_treasury_dashboard.sql`, `20260720213000_finance_band_treasury_consolidation.sql`, and the overwriting `20291217080000_fix_deployed_band_treasury_dashboard.sql`; final definition is now from `20291217090000_finance_band_treasury_finalisation.sql`.
- `preview_my_band_contribution`: defined by `20260720201000_finance_phase8b10_band_treasury_dashboard.sql`, `20260720213000_finance_band_treasury_consolidation.sql`, and the overwriting `20291217080000_fix_deployed_band_treasury_dashboard.sql`; final definition is now from `20291217090000_finance_band_treasury_finalisation.sql`.
- `contribute_my_personal_funds_to_band`: defined by `20260720193000_finance_phase8b9_band_deposit_accounts.sql`, `20260720201000_finance_phase8b10_band_treasury_dashboard.sql`, and `20260720213000_finance_band_treasury_consolidation.sql`; it is also reasserted by `20291217090000_finance_band_treasury_finalisation.sql` because its active-profile and confirmation behaviour is coupled to preview.
