# Nightclub owner-funded DJ offers: escrow and refunds — 19 October 2026

## Live production cutover
Two migrations applied directly to production Supabase project `yztogmdixmchsmimtent`, with exact ledger SQL committed to `supabase/migrations/`:
- **`20261019100627_dj_owner_funded_offer_escrow_refund_20261019`**
- **`20261019100731_dj_nightclub_escrow_expiry_cron_20261019`**

This is a funded negotiation **before** a scheduled booking. No code in this PR or its migrations creates a `dj_bookings` row, DJ performance session, settlement ledger entry, fame/XP reward or DJ cash payout. The scheduled DJ booking release flag remains **OFF**.

## Verified club owner finances
For an already-shortlisted, future application belonging to another account, a verified open nightclub owner may lock a **$50–$1,250** fee (tighter: $250 per club quality tier, with a $250 minimum tier cap). Maximum 5 outstanding escrow offers per club. The proposed set must be at least 90 minutes away, and the offer expires at the earlier of **24 hours** or **60 minutes before performance start**.

The service-authorised `fund_nightclub_dj_offer` RPC:
- Checks caller `auth.uid()`, current active owner profile, original purchase receipt, club open state, matching application, shortlist state, actor separation and fee tier.
- Serializes offers for the club and locks the owner profile row before checking and debiting the balance.
- Debits **exactly once** via the existing profile financial-account journal trigger using classification `nightclub_dj_offer_escrow`.
- Records a durable offer, `fund` escrow movement, and immutable request receipt; changed-intent reuse is rejected.

**Client roles have SELECT only** under actor-scoped RLS for `nightclub_dj_funded_offers`, `nightclub_dj_escrow_movements` and `nightclub_dj_offer_actions`. Browser INSERT/UPDATE/DELETE is revoked.

## DJ response and exact refunds
The selected active DJ character may **accept the terms** or **decline** while an offer remains valid. Accept does **not** create a booked gig, and money **remains in escrow**. The active verified owner can cancel an offered or accepted agreement, crediting the original owner profile. Declining returns all escrow to the owner. A signed-in player may release an already-expired offer. `decide_nightclub_dj_offer` validates the actor and serializes against other decisions and background refunds.

All terminal refund paths create **exactly one** `refund` movement per offer (`UNIQUE(offer_id,kind)`) and restore the full held fee to its original owner with an explicit financial journal classification. Exact retries return the original outcome without moving money twice.

## Autonomous expired-offer release
Database cron job `nightclub-dj-expire-offer-escrows` was installed **active** with schedule `*/15 * * * *`. It invokes `private.expire_nightclub_dj_offer_escrows_internal(50)`. The procedure locks up to 50 expired active offers with `FOR UPDATE SKIP LOCKED`, returns the full fee, writes a unique refund movement and marks each expired. It is not exposed to browser callers. For production monitoring, check `cron.job`, `cron.job_run_details`, and that total unrefunded escrows equals the sum of outstanding offered/accepted fees.

## UI
- Nightclub Management adds the **Funded DJ offers** card after the owner application inbox. It shows eligible shortlisted applications, accepts a bounded whole-dollar fee, and displays escrow status and a cancellation/refund button.
- Nightclub detail adds the **Owner-funded DJ offers** card visible to the applicant. The DJ may accept terms, decline for a refund, and release an expired offer. Both cards explicitly say **not booked, no stage or Schedule commitment, no payout**.
- Requests preserve UUIDs in memory/session storage until the server acknowledges, so ambiguous network retries do not charge or refund twice.

## Verified directly against production (with ROLLBACK)
`supabase/tests/nightclub_dj_funded_offer_escrow_harness.sql`: synthetic verified club purchase, temporary second active DJ in same city, licensed audio fixture and two shortlisted applications; $100 debit exactly once, identical funding replay, changed-intent rejection, foreign cancellation denial, DJ acceptance **without payout**, owner cancellation with exact refund and repeat-safe cancellation, $125 second escrow then expiration worker returns exactly one refund. No booked DJ set was created.

`supabase/tests/nightclub_dj_escrow_authenticated_role.sql`: with Postgres role `authenticated`, verified owner can fund by RPC but direct INSERT into escrow is denied, target DJ can SELECT offer and decline by RPC.

Both tests passed on the live DB, are registered in the Phase 5 reset gate, and left no synthetic purchases, offers, cash movements, songs, bookings or settlements in production. Live end-state counts were all zero.

## Release blockers / next tasks
**DO NOT mark #4264, #4246, or #4265 complete.** A subsequent phase must convert accepted, funded offers to canonical `dj_bookings` safely, include Schedule reservation, owner-funded fee substitution inside `private.dj_settle_booking_at`, cancellation/refund rules once booked, missed-show outcomes, finance double-entry reconciliation, local audience/fan attribution and residency repetition. Until that code is fully tested, escrow offers never pay performers or schedule real gigs.

Four legacy nightclub owner records remain unverified (#4399); they cannot fund DJ offers until the duplicate ownership and transaction provenance is reconciled.
