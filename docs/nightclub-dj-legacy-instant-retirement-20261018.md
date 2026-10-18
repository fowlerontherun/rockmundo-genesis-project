# DJ legacy instant-set retirement (18 October 2026)

## Why this change exists

The old city and nightclub "Queue for DJ Slot" actions used
`useDjPerformance.ts` to randomly calculate an outcome in the browser,
then independently write energy, cash, fame, skills and DJ history.
Failures could leave partial rewards or false successes; repeated tabs
could overwrite account balances. Those writes could not safely coexist
with the authoritative booked-set ledger already implemented on the server.

## Changes

- Remove both instant DJ queue actions, their result dialogs, and the
  `useDjPerformance.ts` direct-payout hook.
- The city action now opens the club's DJ mixer/booking page.
- The individual club offers a **Book DJ Set** shortcut only when
  `VITE_DJ_SCHEDULED_BOOKINGS_ENABLED=true`; otherwise an explicit
  notice sends players to **reward-free mixing practice**.
- Keep existing DJ performance history read-only. Its summary now clearly
  says **last 10** rather than treating the fetched slice as a lifetime total.
- Add a regression test ensuring the client instant settlement path does
  not creep back into either page.

## Activation / release

**This does not enable scheduled paid DJ gigs.** The booking UI is still
controlled by the frontend flag and the JWT-verified
`dj-booking-action` function still requires its separate server-side
`DJ_SCHEDULED_BOOKINGS_ENABLED=true` switch. With flags off, DJ
practice remains available; immediate cash/XP gigs are intentionally
unavailable rather than silently recording untrusted payouts.

No database migration or production setting change is part of this PR.

## Remaining blockers (do not close umbrella issues)

- Verify database RLS/grants also prevent ordinary clients from directly
  forging payouts or DJ performance rows. Removing browser callers is
  an **application mitigation**, not a complete server authorization audit.
- Complete real game-clock slot semantics, club-owner approvals, city
  fan conversion, attendance, 3D audience, mobile/browser audio QA and the
  optional minigame before switching on player bookings.
- Run full authenticated E2E tests in a staging environment, including
  failed/duplicate settlements, refreshes and multi-character access.

Related issues: #4234, #4246, #4258 and #4265.
