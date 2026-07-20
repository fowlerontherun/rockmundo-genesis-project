# Finance Phase 8B.9 — Band Deposit and Rehearsal Flow Audit

## Band deposit root cause

The merged Phase 8B.8 Band Finances implementation queried personal `bank_accounts` directly from the browser while `profileId` could still be unavailable. The query used a zero-UUID fallback for `owner_id`, so the first account request could legitimately return no accounts and leave the selector empty until another finance refresh happened.

The same deposit path also called `contribute_personal_funds_to_band` with parameter names that did not match the deployed SQL signature. The database function expects `p_player_bank_account_id` and `p_note`; the UI sent `p_personal_bank_account_id` and `p_notes`, so a repaired selector would still fail on submission.

Account-loading errors were previously ignored because the Promise result only read `data`. Relationship shape mismatches from `bank_accounts -> financial_accounts` were hidden with `any`, making an empty selector indistinguishable from RLS, join, or profile-loading problems.

## Phase 8B.9 fix scope in this PR

- Added `get_my_eligible_band_contribution_accounts(p_band_id, p_currency_code)` so the browser no longer supplies an owner profile ID for contribution account discovery.
- Added `contribute_my_personal_funds_to_band(...)` as a current-player wrapper around the existing contribution RPC.
- Updated Band Finances to wait for both `bandId` and `profileId`, expose account-section loading/errors, use typed account/contribution interfaces, preserve selection, and refresh balances/history in component state instead of reloading the page.

## Remaining rehearsal-funding audit items

The trusted rehearsal-funding slice still needs a follow-up implementation to make preview side-effect free, enforce the authoritative rehearsal-booking permission, validate payment status before booking insertion, wire the frontend to preview/confirm RPCs, and implement cancellation/refund routing to the original funding sources.
