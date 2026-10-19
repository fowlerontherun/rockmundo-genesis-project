# Verified-owner paid DJ promotion — 19 October 2026

## Production migrations, applied directly to live Supabase
- `20261019141440_dj_owner_paid_advertising_confirmed_gigs_20261019`
- `20261019141515_dj_paid_promotion_bounded_attendance_settlement_20261019`

The exact applied SQL was copied from the live `supabase_migrations.schema_migrations` ledger to GitHub. No production player was charged and no real DJ bookings were created as part of the deployment; all financial test fixtures used `BEGIN/ROLLBACK`.

## Real advertising expense, never invented revenue
A verified nightclub owner can buy one optional advertising package for an **already confirmed, escrow-funded DJ booking** at that exact purchased club, only while the booking is at least three hours from its scheduled start and still booked/ready. The owner must hold sufficient actual character cash, which is locked and debited **once** with the existing canonical financial account trigger. The immutable receipt records booking, owner, exact cash spend, idempotency UUID and crowd effect.

Budgets and effects, bounded by the nightclub's authoritative quality level:
- **$100 → 2%** additional demand, club quality 1+
- **$250 → 5%** additional demand, club quality 3+
- **$500 → 10%** additional demand, club quality 5

The purchase is an actual **non-refundable advertising expense**, not a DJ fee deposit. If a gig is later cancelled, the **separate held DJ performance fee** still refunds through the existing escrow machinery, but advertising already purchased does not refund. The UI states this before offering the action.

Promotion never creates ticket/door revenue, restaurant drinks, venue wages, XP, additional DJ salary or synthetic followers on its own. Venue capacity remains the hard ceiling. At real server-verified DJ settlement, `private.dj_settle_booking_at` reads the one original purchase receipt and adjusts the base crowd: `attendance = min(capacity, round(base_demand × (1 + boost%)))`. Attendance then drives the pre-existing actual new solo DJ followers. The immutable crowd `model_inputs` records the paid budget and boost for audit and replay.

## Security, retries and actor controls
The `nightclub_dj_paid_promotions` table uses RLS and owner-scoped authenticated **SELECT only**, with all direct browser writes revoked. `public.purchase_nightclub_dj_promotion` is authenticated only (no anon/PUBLIC grant) and checks:
- `auth.uid()` and active selected owner character;
- the exact canonical purchased-club receipt, current ownership and open state;
- a booking locked `FOR UPDATE` that is `booked/ready`, at least three hours in the future, and linked to a fully held owner escrow;
- exactly one promotion per booking, fee-tier checks and actual owner cash lock;
- a unique owner/request ID and immutable intent so lost responses/retries never double debit.

Because the booking row locks are shared with cancellation and start transitions, a promotion cannot race another booked-set status transition.

## Direct live rollback tests
- `supabase/tests/dj_owner_paid_promotion_escrow_crowd_contract.sql`: temporary 2-account genuine receipt-backed club and licensed DJ set, two real canonical booked shows, two separate **$100 marketing purchases**, exact replay without extra debit, changed-budget request ID rejected, proper mixer evidence, settlement audience shows exactly **2%** bounded uplift, DJ rewards and local fans paid once, while the second cancelled show refunds only the escrowed DJ fee and does **not** reimburse advertising. No phantom crowd on missed/cancelled gigs.
- `supabase/tests/dj_paid_promotion_authenticated_role.sql`: genuine Postgres `authenticated` role; foreign DJ cannot spend club funds, verified owner buys a $100 promotion through the RPC, browser cannot INSERT forged receipts, and the performing DJ cannot inspect the owner's private marketing spending.

Both tests passed against production inside transaction `ROLLBACK` and are wired into `scripts/gigs/run-db-gate.sh`.

## Still excluded from release
No DJ booking release flags were enabled. This phase does not simulate genre-targeted audience affinities or club-city organic street marketing; in production the `nightclub_events` table currently has no scheduled events, so applying made-up theme-night boosts would produce false demand. Genre/city campaign tuning should be a separate authoritative feature once event management, time and music-genre snapshots are certified. It does not constitute release certification for #4265 (mixer/audio/WebGL/mobile/concurrency/CI checks).
