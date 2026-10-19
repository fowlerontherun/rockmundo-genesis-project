# Funded nightclub DJ bookings: escrow-safe booking, Schedule and settlement — 19 October 2026

## Production changes applied directly
The following migrations are applied to live Supabase project `yztogmdixmchsmimtent`. Each checked-in SQL file was copied from the corresponding **actual** `supabase_migrations.schema_migrations` record, not reconstructed from a guessed version:

- `20261019103736_dj_funded_offer_canonical_booking_bridge_20261019`
- `20261019103858_dj_escrow_backed_session_and_exact_settlement_20261019`
- `20261019104328_dj_verified_funded_booking_service_and_owner_cancel_20261019`
- `20261019104733_dj_booked_escrow_retry_after_terminal_status_20261019`
- `20261019105319_dj_verified_owned_club_require_escrow_reservation_20261019`

There were no existing live DJ offers/bookings when these migrations were applied. Existing unowned DJ booking settlement logic continues to use its existing server-defined payment formula.

## Booking and Schedule
A separate server-only `confirm_accepted_nightclub_dj_offer_internal` converts an accepted, unexpired **fully escrow-backed** offer to an actual `dj_bookings` row. It validates the selected DJ, the owner receipt and open club, shortlisted application, actor identity, held fee, and no earlier refund/payout. It delegates to the existing `reserve_dj_booking_internal` for music rights, fame, travel, local club hours, conflict checks and **automatic player_scheduled_activities projection**. The offer records the canonical `booking_id` and original unique `booking_request_id`. Exact retries continue returning that booked ID even after cancelled/missed/completed outcomes.

Browser users cannot call the conversion RPC. The existing JWT-verifying Edge Function `dj-booking-action` now has a `confirm_funded` action that authenticates a real JWT with `admin.auth.getUser(jwt)`, passes only that verified user to the **service-role-only** `dj_verified_funded_offer_booking_service`, and accepts no claimed user/profile from the browser.

**TWO default-closed server flags** are required before funded booking conversion can be called from the app: `DJ_SCHEDULED_BOOKINGS_ENABLED=true` and `DJ_FUNDED_OWNER_BOOKINGS_ENABLED=true`. The matching UI controls are visible only when both `VITE_DJ_SCHEDULED_BOOKINGS_ENABLED=true` and `VITE_DJ_FUNDED_OWNER_BOOKINGS_ENABLED=true` are enabled. Neither server flag was enabled by this work. In particular, ordinary DJ reservations are still governed by the separate scheduled booking flag.

## Exactly-once financial settlement
At session start, a funded booking's `promised_payout` is taken from the **actual owner-escrowed fee**, not the generic club payout setting. At performance settlement, the existing score calculation remains, but the DJ cash award is **capped at the held fee**. All other mixer requirements remain intact, including server-verified deck A/B plays, tempo and crossfade events spanning the real booked slot.

A funded completed show emits a single `payout` escrow movement; any surplus is credited back to the *original club owner's* profile with a unique refund movement and classified canonical financial-account journal context. `payout+refund=original held fee`. Subsequent settlement replay returns the same performance ID, not another payment. A transaction failure rolls back the DJ credit, owner refund, performance, skill experience and escrow state together.

Cancellation of a funded DJ booking, whether by the DJ or a verified active owner, updates its canonical `dj_bookings.status`, projects the Schedule status, and triggers a full owner refund exactly once. Missed shows and abandoned live sets use the existing missed-set worker and also refund the held owner fee. Booking cancellation and settlement serialize using the booking row lock, then the offer lock, preventing settlement/refund races.

## Verification performed against production in transaction ROLLBACK
`supabase/tests/dj_escrow_booking_settlement_contract.sql` uses two real active accounts, temporary same-city location, a temporary receipt-backed club purchase and cleared audio set. It finds legal venue-local DJ slots rather than assuming the device's local time. It verified:
- Four legitimate shortlisted accepted offers and distinct confirmed canonical bookings with Schedule entries
- $100 funded set starts with $100 promised payout, with six valid server-side live mixer events including deck A/B, tempo and crossfade across 60+ seconds with late-slot participation
- Exactly-once settlement and replay, total DJ cash never above $100, and surplus owner refund; no money minted
- Verified owner cancels another future booking, receives full refund, and can replay the exact cancellation ID
- A missed show receives no settlement and refunds the owner, while its Schedule entry becomes missed
- A DJ cancels another future booking with full owner refund
- Original booking request IDs remain replayable after completed and cancelled outcomes

`supabase/tests/dj_funded_booking_release_permissions.sql` executed with actual Postgres `authenticated` role: neither direct booking conversion nor service-wrapper impersonation is allowed, and the browser cannot mutate escrow or create raw bookings.

Both files are wired into `scripts/gigs/run-db-gate.sh`, with `psql -v ON_ERROR_STOP=1`.

## Release conditions and remaining work
**Keep the scheduled and funded owner booking release flags OFF until the wider CI/release gate succeeds**, including 3D/mixer audio, mobile Schedule display, real-world local-clock timing, production edge deployment, refresh/double-request tests and economy reconciliation at concurrency. This PR does not implement ongoing resident DJ contracts, recurring payroll, local fan outcomes or venue attendance modelling. Keep DJ epic #4264, scheduled DJ rollout #4246, financial/3D certification #4265 and historical club title reconciliation #4399 open.

## Closing the ordinary-reservation owner-approval bypass

The fifth production migration changes **`reserve_dj_booking_internal`** so a receipt-verified, player-owned nightclub **cannot be booked through the ordinary DJ reservation endpoint**. That endpoint now requires a trusted, transaction-local escrow conversion context referencing the *exact* accepted, fully-funded DJ offer and matching DJ, club, saved set, and proposed start. Only `confirm_accepted_nightclub_dj_offer_internal` sets that context during the validated reservation call and immediately restores the previous value. Public/anon/authenticated users cannot call that conversion function; only the separately dual-gated JWT-verified service route can invoke it. Ordinary bookings at nonverified/unowned clubs retain their previous behavior.

The live rollback test now explicitly attempts ordinary DJ reservation at a receipt-verified club before any owner payment and requires rejection with SQLSTATE 42501, then confirms the same club via a real escrow-funded booking. This protects owner autonomy and prevents minting DJ rewards while leaving the owner's escrow to expire/refund.
