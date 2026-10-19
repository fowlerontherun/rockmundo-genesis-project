# Club owner recurring genre nights — 19 October 2026

## Production rollout
Migration **`20261019084646_nightclub_verified_owner_game_weekly_genre_nights_20261019`** was applied **directly to the production Supabase database** and copied into `supabase/migrations/` from the exact applied migration ledger.

This is a bounded Phase 8 (#4264) feature: it allows receipt-verified nightclub owners to promote their club's recurring musical genre nights without granting DJ contract, attendance, finance, booking, or performance-settlement authority.

## RockMundo game calendar
Club nights are defined by the existing `nightclub_events.day_of_week` integer convention: **Sunday=0 through Saturday=6**. The `getTonightsEvent` UI uses `gameWeekday()`, calculated from the accelerated 360-day game year / 30-day game months. The owner selects this game weekday; it is **not the player's device weekday**. Recurring events are already shown in the public `ClubEventsSection`.

## Ownership and economy guard
- Owners are authenticated against the currently selected living profile, their `player_owned_nightclubs` row and the exact matching `nightclub_purchase_receipts` row for that profile, club and authenticated user. Legacy owner claims with no purchase receipt cannot publish a genre night until they are audited (#4399). Admin-owned historical events are left unchanged.
- `manage_owned_nightclub_theme_night(owned_club, weekday, action, request_id, title, genre)` provides `set` and `disable`. Club row locking serializes owner actions, and the unique index permits at most one owner-managed night per weekday (including disabled rows for reactivation).
- Reusing the same authenticated `request_id` for identical intent returns the original event ID; changed-intent reuse is rejected. The browser persists an intent-scoped request ID before each call, to recover from a lost acknowledgement.
- A database CHECK constraint **permanently pins** owner-managed rows to `event_type='theme_night'`, recurring game weekday 0–6, no single real-world DATE, no cover override or special guest, and precisely **1× fame / 1× XP**. No cash or DJ payout rows are touched. A duplicate active recurring admin event on the same weekday blocks owner creation instead of silently overriding the admin programme.
- Owner action receipts are immutable and owner-readable under RLS. Only the dedicated RPC may mutate normal owner theme nights; preexisting privileged admin management policies are preserved.

## Client
Nightclub Management now includes a seven-day weekday editor for verified owners, allowing setting/editing a title and genre, disabling a night, and viewing a current recurring/disabled list. Legacy owners see why management is not unlocked. `nightclub-events` is invalidated after success, refreshing the existing public club-event display. The UI states clearly that a theme night alone does not book or pay any performer.

## Verification
`supabase/tests/nightclub_verified_owner_theme_night_contract.sql` passed on live production under `BEGIN/ROLLBACK`, creating a synthetic verified club purchase then creating, idempotently retrying, editing and disabling an event. It tested foreign-owner access denial, invalid weekdays/names, rejection of changed-intent replay, stable event ID, server-fixed reward multipliers and no unintended extra rows.

`supabase/tests/nightclub_owner_theme_night_authenticated_role.sql` separately ran under actual Postgres `authenticated` role and verified that a legitimate synthetic owner can set and disable a night and read the resulting events.

Both tests are wired into `scripts/gigs/run-db-gate.sh`. The client has Vitest request-identity regression tests. **After rollback, production has 0 owner theme-night receipts, 0 scheduled events, 0 purchase receipts, 0 DJ bookings and all 4 legacy owner records unchanged.**

## Still not finished
- There are no verified historical owners yet, because old purchases cannot be safely backdated without financial evidence. #4399 must resolve the disputed claims separately.
- Owner-approved booking applications, real DJ residency contracts, fee budgets/escrow and payout reconciliation have **not** been implemented in this slice. User-facing DJ booking releases stay gated off until #4265 and #4334 are certified.
- Events with one-off non-Gregorian game dates require separate explicit game year/month/day columns; existing recurring weekday behavior is correct for the 30-day game months.
