# Finance Band Treasury Consolidation Audit

This audit consolidates the overlapping finance fixes from PRs #1249, #1250, #1251, and #1252. Existing migrations remain historical records; deployment repair is delivered by the new forward migration `20260720213000_finance_band_treasury_consolidation.sql`.

| Issue | Introduced in | Attempted fix | Current main behaviour | Required final fix | Test coverage |
|---|---|---|---|---|---|
| Treasury dashboard omitted `view_band_balance` | #1250 | Later PRs focused on fallbacks and membership | Active members could receive ledger treasury balances without balance permission | Dashboard now requires active membership and `view_band_balance`; detailed history remains separate | SQL definition checks and component permission-denied regression |
| Legacy `bands.band_balance` fallback leaked on denied statuses | #1250/#1251 | Duplicate fallback guards in #1251/#1252 | Fallback could appear for `profile_missing`/`permission_denied` and public band routes | Fallback only after authorised `treasury_missing` or technical failure with previously authorised dashboard | Component fallback/permission scenarios |
| Stale dashboard state while switching bands/profiles | #1251/#1252 | Partial request id guards | Previous band treasury/accounts could remain visible during new loads | State is cleared on band/profile change and request generations gate async responses | Component switch regressions |
| Contribution preview exposed balances without complete permission model | #1250 | Membership check added later | Non-members improved, but contribution and balance permissions were not consistently separated | Preview requires active profile, band, membership, and voluntary contribution permission; dashboard balance remains gated by balance permission | SQL function definition and component profile-missing coverage |
| Raw eligibility helper callable by clients | #1250 | None | `SECURITY DEFINER` helper could reveal account existence/eligibility | `PUBLIC`, `anon`, and `authenticated` execute revoked; service role only | SQL privilege regression |
| First contribution blocked when treasury missing | #1250 | Underlying delegated function could create treasury | Wrapper raised `band_treasury_missing` before delegate ran | Preview is write-free and reports `treasuryWillBeCreated`; confirmation delegates to creator | Component missing-treasury preview; SQL first-contribution scenario |
| Active profile helper returned arbitrary profile | Earlier finance helpers | UI used `profiles.is_active`; SQL used unordered `LIMIT 1` | Multi-character users could operate as a non-selected character | New `current_active_player_profile_id()` and repaired `current_player_profile_id()` resolve the UI-selected living active profile deterministically | SQL active-profile fixtures |
| Mixed ledger and legacy balances after contribution | #1250/#1251 | Refreshes loaded legacy core data | Successful deposits could leave displayed ledger stale | Contribution result updates local treasury/account balances immediately; dashboard refresh follows | Component contribution regression |
| Duplicate PR repairs | #1251/#1252 | Similar changes in both PRs | Review threads remained hard to trace | This audit maps each P1/P2 concern to the consolidation fix | This document plus migration/component tests |
| Edited historical migration | #1252 | `20260720201000...` edited | Deployed DBs could retain original broken functions | New forward migration redefines functions and privileges | Forward migration path check |
| GBP default versus USD tests | #1251/#1252 | Tests added but not reliably run | Expected dollar values could fail against GBP UI | Tests should assert `£` unless fixture currency is USD | Component currency coverage |
| Missing authenticated browser regression | #1250-#1252 | None | No browser proof of load/select/preview/deposit | Finance E2E scenarios are required before merge | Playwright finance suite |

## Schema verification notes

The consolidation used repository migrations as the historical schema source and verified these effective assumptions before writing the forward repair:

- `profiles`: `id`, `user_id`, `display_name`, `username`, `avatar_url`, `is_active`, `died_at`, timestamps.
- `bands`: `id`, `leader_id`, `band_balance`, `weekly_pay_percent`, `metadata`.
- `band_members`: `band_id`, `profile_id`, role fields, `member_status` with active membership represented by `COALESCE(member_status, 'active') = 'active'`.
- `band_finance_role_permissions`: `band_id`, `role_code`, `permission`; enum includes `view_band_balance`, `view_transaction_history`, `view_detailed_income_expenses`, and `make_voluntary_contributions`.
- `bank_accounts`: player-owned payment instruments with `owner_type`, `owner_id`, `linked_finance_account_id`, `status`, `currency_code`, provider and display metadata.
- `financial_accounts`: ledger accounts with `owner_type`, `owner_id`, `currency_code`, `default_currency_code`, `current_balance_minor`, generated `available_balance_minor`, `reserved_balance_minor`, `is_primary`, `account_status`, and `metadata->>'account_role' = 'band_treasury'` for treasuries.
- `financial_transactions` and `financial_ledger_entries`: immutable posted ledger rows keyed by idempotency and account entries.
- `band_financial_contributions`: contribution rows with contributor, source account, destination treasury, amount, currency, transaction, type, refundable status, notes, idempotency, and timestamps.

## Review-thread disposition

- P1/P2 permission leak comments: fixed in consolidation.
- P1/P2 eligibility helper exposure: fixed in consolidation.
- P1 active-profile mismatch: fixed in consolidation.
- P1 first-contribution blocker: fixed in consolidation.
- P2 stale UI state and mixed balance refresh: fixed in consolidation.
- P2 USD test expectations: fixed/required in consolidation test plan.
- Browser proof request: added to required test plan; if the environment cannot run it, merge must wait for CI evidence.
- Historical migration edit concern: fixed by forward-only migration; old files intentionally unchanged.
