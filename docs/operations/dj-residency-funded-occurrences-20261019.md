# Individually funded resident DJ performances — 19 October 2026

## Production cutover
Applied directly to live Supabase project `yztogmdixmchsmimtent`, then mirrored the exact migration-ledger SQL:
`20261019121903_dj_residency_per_show_preparation_funding_guard_20261019`.

This is the next milestone for [#4436](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4436), following merged DJ residency PR #4435 and merged escrow booking PR #4432.

## Player journey
1. The owner sends a mutually agreed 2–4-week residency as before. **The agreement itself does not charge or book anything.**
2. The DJ visits the club city, selects the appropriate residency date and **prepares** that individual occurrence within the existing 14-day booking/application horizon and more than 90 minutes before start. Preparation revalidates the active selected DJ character, setlist, local city, DJ slot configuration and schedule conflicts by calling `apply_for_nightclub_dj_slot`.
3. The first date reuses the pre-existing source shortlisted application. Additional dates receive new applications that are automatically marked shortlisted, **only because that exact venue-local date and DJ were explicitly approved by both parties in the signed residency**.
4. The verified owner sees each prepared date and pays the **exact agreed per-show fee** using the same `fund_nightclub_dj_offer` transactional cash escrow as standalone offers.
5. The DJ sees the held fee in the normal Owner-funded DJ offers panel, chooses Accept, then confirms the actual canonical gig with the previously implemented doubly flagged `confirm_funded` Edge action. Only **after** confirmation does the slot appear as scheduled; payout requires a real verified mixer performance. No bulk automatic booking or owner money creation.
6. The residency row displays per-date status: Not prepared, Prepared, Fee held, Accepted, Booked, Completed/Paid or Cancelled/Expired/Refunded. Ending the residency **does not silently cancel previously confirmed shows**.

## Authoritative safety contract
- New `nightclub_dj_residency_occurrences` table has a unique `(residency_id,occurrence_number)` and `application_id`, idempotent request receipts, RLS restricted to the signed DJ and receipt-verified owner, **authenticated SELECT only** and no browser DML.
- `prepare_nightclub_dj_residency_occurrence` validates `auth.uid()` and `current_active_player_profile_id()`, signed residency and local venue/clock constraints. All duplicate requests return the same application; changed-intent ID reuse is rejected. No implicit payouts, booking, financial ledger or automatic Schedule entries.
- The existing `fund_nightclub_dj_offer` additionally rejects any residency-linked application unless it is associated with an **agreed, prepared** residency and exactly the signed fee for the verified owner. Generic nonresident club offers retain their previous limits.
- `confirm_accepted_nightclub_dj_offer_internal` rejects booking an unconverted resident offer after the residency has been ended. Already-booked gigs are unaffected by ending the plan; cancellation goes through the normal DJ/owner cancellation and refund machinery.
- Individual held offers still expire within 24 hours and are refunded by the existing 15-minute `pg_cron` worker. **Ending a residency does not instantly release an independently held, unbooked fee**; the owner can cancel immediately or it will automatically expire/refund. Follow-up improvement: automatic same-transaction refund of future unbooked residency holds at termination with lock-safe concurrency tests.
- Future occurrences beyond the 14-day application horizon cannot be prepared yet, avoiding a bypass of existing scheduling validations. Dates are stored as exact venue-local wall-clock-derived instants from the signed contract, including daylight-saving safety checks.

## Verified directly against production in BEGIN/ROLLBACK
`supabase/tests/dj_residency_per_occurrence_escrow_contract.sql`: independent owner and DJ, temporary receipt-backed club, rights-checked saved DJ set, venue-local two-week proposal, signature and **two distinct prepared DJ applications**; identical retry returns same application, changed-intent reuse and foreign prep blocked. Owner attempts $125 instead of agreed $100 and receives an error. Two $100 holds debit exactly $200. Both are accepted and converted to distinct `dj_bookings` + `player_scheduled_activities`; one receives verified deck A/B, tempo/crossfade performance, pays at most its actual hold exactly once, and refunds surplus. The other is cancelled and fully refunded. **Owner debit = performer award + owner refunds**, and ending the residency leaves the original booking terminal states intact.

`supabase/tests/dj_residency_occurrence_authenticated_role.sql`: actual `authenticated` role prepares individual occurrences, checks owner/DJ scoped row visibility, denies browser INSERT and a foreign actor's preparation, rejects altered contractual fee, and charges the verified owner $100 per date through the normal escrow RPC. Passed live inside rollback.

Both tests are wired into `scripts/gigs/run-db-gate.sh` with `-v ON_ERROR_STOP=1`. No production fixture data remains. Scheduled and funded DJ release flags remain OFF pending #4265 full certification.

## Ending a residency: automatic refund of unbooked holds

Production follow-up migration **`20261019122803_dj_residency_ended_unbooked_escrow_refunds_20261019`** updates the existing private `expire_nightclub_dj_offer_escrows_internal` worker, preserving its every-15-minutes cron, `FOR UPDATE SKIP LOCKED` and unique `(offer_id,kind)` refund receipts. For a signed residency with status `ended`, offered/accepted **unbooked** escrow is now refunded and the offer status set to `cancelled`. Canonical booked shows are *not* selected. Live rollback test `dj_residency_ended_escrow_refund_contract.sql` passed: two independent $100 fee holds, end contract, first cron sweep refunded both (2), next sweep refunded none (0), owner cash fully restored, zero booked gigs. It is wired into the Phase 5 DB gate.
