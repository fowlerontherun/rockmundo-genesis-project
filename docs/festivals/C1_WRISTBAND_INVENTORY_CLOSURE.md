# Festival Attendee C1 — Wristband Inventory Closure

**Status:** COMPLETE  
**Closed:** 2026-08-25

## Authority

C1 extends the modern festival ticketing and attendee foundation. It does not create a second attendee or ticket authority.

The authoritative chain is:

1. `purchase_festival_tickets` issues a modern `festival_issued_tickets` admission ticket.
2. `_festival_create_player_attendance_from_ticket` creates at most one `festival_player_attendance` lifecycle for that character and edition.
3. `festival_attendance_issue_wristband_on_ticket` issues the single wristband representation from that canonical attendee row.
4. `get_my_festival_memorabilia` projects the same wristband to player inventory and festival ticket-wallet UI.

## C1 guarantees

- Wristbands are issued when valid admission creates canonical attendance; check-in is not required to create the keepsake representation.
- Each wristband links directly to `admission_ticket_id`, `festival_edition_id`, `festival_launch_id`, and `attendance_id`.
- Existing uniqueness on attendee/edition plus the ticket/item unique index prevents duplicate wristbands from retries or multiple admission products.
- Upgrade and add-on products do not create attendee lifecycles and are revalidated as non-admission before wristband issuance/backfill.
- Existing ticketed attendees are reconciled so pre-check-in admissions receive their wristband representation.
- Direct browser writes to the memorabilia table remain unavailable; the player reads through the narrow authenticated projection.
- The festival purchase mutation invalidates attendance, wallet, eligibility, and memorabilia caches together so the issued wristband appears without requiring a later check-in.

## Player surfaces

- **Inventory → Festival Keepsakes** uses `get_my_festival_memorabilia` and displays the issued wristband as a persistent collectible.
- **Public Festival → Tickets → My Festival Wallet** displays the character's tickets plus the single wristband associated with festival admission.

## Regression coverage

`src/features/festival-company/__tests__/festivalWristbandInventoryC1.test.ts` checks admission-only attendee authority, direct ticket linkage, uniqueness/idempotency, pre-check-in issuance, add-on exclusion, cache invalidation, inventory visibility, and ticket-wallet visibility.

## Next backlog dependency

C2 may now build check-in/readiness/leave lifecycle behaviour on top of the admission-backed attendee and wristband authority without moving wristband creation into the check-in transition.
