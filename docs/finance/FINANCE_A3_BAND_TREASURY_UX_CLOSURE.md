# Finance A3 — Band Treasury and Insufficient-Funds UX Closure

## Scope closed

A3 aligns booking-time funding displays with the same band treasury authority used by the atomic rehearsal and recording booking RPCs.

## Player-facing changes

- Band-funded activities continue to default to band funds.
- `useBandPaymentSource` now reads spendability only from `get_band_treasury_dashboard()` and no longer falls back to `bands.band_balance` for booking affordability.
- The shared payment-source selector shows the selected payer, current available balance, booking cost, expected balance after payment, and a precise shortfall message.
- A missing treasury is distinguished from a genuinely empty treasury and band-funded confirmation is disabled instead of being presented as a generic insufficient-funds failure.
- Missing treasury UX links the player to Band Finances for recovery.
- Personal funding copy makes clear that the funding is recorded against the band activity and identifies who actually covered the cost/shortfall.

## Compatibility repair

Recording and a small number of older booking surfaces still display `bands.band_balance`. Until those screens are fully migrated, `band_treasury_sync_legacy_balance_projection` keeps that compatibility field equal to the primary treasury's **available** balance (`balance_minor - reserved_balance_minor`) in major units. This prevents an older screen from showing money that is already reserved and therefore cannot actually be spent.

`ensure_my_band_treasury(uuid)` is an authenticated, membership-checked recovery RPC. It can create an empty treasury, but it never creates money; funding remains a separate explicit player action.

## Contribution correctness

Legacy activities that allow a personal shortfall use `prepareFunds()`, which calculates only the actual missing amount and passes that exact amount to the canonical `fund_my_band` path. That path writes the matching `band_treasury_transactions` contribution record. Atomic rehearsal/recording bookings continue to charge the explicitly selected payer directly and record the selected source in `booking_payments`.

## Verification

`supabase/tests/finance_a3_treasury_ux_harness.sql` verifies:

- the treasury recovery RPC exists and is authenticated-callable;
- the compatibility projection trigger exists;
- the compatibility balance equals authoritative available treasury funds;
- bands without a treasury cannot retain a stale positive compatibility balance.

Full browser E2E remains part of backlog item A4 rather than being duplicated here.
