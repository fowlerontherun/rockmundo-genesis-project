# Nightclub purchase/ownership authority cutover — 19 October 2026

## Production (applied directly)
Migration receipt: **20261019073225_nightclub_ownership_atomic_purchase_and_settings_20261019**.
Corresponding versioned SQL: `supabase/migrations/20261019073225_nightclub_ownership_atomic_purchase_and_settings_20261019.sql`.

### Why this is a DJ prerequisite
The prior nightclub purchase hook read `profiles.cash` from a browser, wrote a stale balance without checking the response, and then inserted `player_owned_nightclubs` independently. INSERT/UPDATE/DELETE grants and RLS allowed a signed-in player to mint ownership rows or overwrite identity, revenue, price and reputation fields. This makes unverified owner control over booked DJ fees, resident contracts and approvals unsafe.

### Live changes
- New owner-scoped receipt table with `(user_id, request_id)` idempotency and unique club purchase.
- `purchase_nightclub_atomic(profile,club,request)`: authenticated active character, current city and canonical tier/price checked server-side; serialized club purchase, locked cash balance, one cash debit and financial account trigger, then one receipt and ownership in one transaction; exact retry returns original receipt without charging again.
- Existing owner claims are preserved with `verified_purchase_id = NULL`. Only **new receipt-backed** claims may be trusted for future DJ owner scheduling authority. Old claims require a separate historical audit; do not auto-verify these.
- `update_nightclub_settings` permits only server-validated cover ($0–500), markup (0–200 percent) and open/closed status of the active character's owned club. Browser INSERT/UPDATE/DELETE on the owner table is revoked.
- Two out-of-range legacy pricing rows were normalized to the canonical club cover and zero drink markup. No legacy cash, owners, staff or historic purchases were deleted or rewritten.
- The client purchase mutation reuses its request ID across ambiguous network failures and sends only the club identifier; neither price nor cash deltas are browser-authoritative. Owner pricing fields save on blur, not on every keystroke.

### Rollback-only production verification
`supabase/tests/nightclub_atomic_purchase_authority_harness.sql` ran against live with BEGIN/ROLLBACK:
- Genuine eligible active character in the same city, server-quoted price, one purchase and exactly one receipt/ownership.
- Identical retry returns same receipt and spends cash once; a second request for the same owned club is refused.
- Out-of-range settings refused; valid settings accepted; foreign/non-active actor changes refused.
- No auth/anon direct ownership writes; anonymous role denied purchase RPC.

After rollback: **0** live purchase receipts, **4** historical owner rows, **0** verified owner rows and **0** out-of-range pricing rows. Two separate character claims on one historical club are intentionally preserved for investigation, not overwritten.

### Remaining phase 8 requirements
- Do not enable DJ owner-approved schedules against legacy, unreceipted ownership.
- Resolve disputed historical ownership with financial/audit evidence before mapping any legacy receipt.
- Introduce separate approved/resident DJ booking budget/offer states and refund or club payment ledger, then certify real events and club-owner accounting.
- Review existing club staff hiring and general profile cash write authority separately; those paths are outside this checkout cutover.
- DJ release flags stay off pending #4265 and CI gate #4334.

Security advisor reference: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable

## Subsequent verified-owner DJ roster preview (20261019074244)
The live follow-up migration `20261019074244_verified_nightclub_owner_dj_roster_preview_20261019.sql` adds authenticated `get_owned_nightclub_dj_roster(owned_club_id)`. It returns only upcoming/live booked DJ names, set names, status and schedule at a club when the caller is the **active character** and the ownership record joins a matching immutable purchase receipt. Anonymous users, foreign owners and legacy unreceipted claimants are denied; it is read-only and awards nothing.

The Nightclub Management screen now shows a read-only DJ roster. Owner approval, residency contracts and payout budgets are still disabled. The rollback-only harness also verifies the roster and foreign-owner denial, leaving zero permanent receipts or bookings.
