# Festival invitation withdrawal

- Keep the organiser’s existing **Withdraw invite** control, improve its visibility and require confirmation.
- Add **Withdraw interest** for invited real bands in Festival opportunities, with confirmation, progress and error feedback.
- Allow withdrawal only before conversion to a formal offer; retain invitation history and leave confirmed bookings unchanged.
- Refresh both the organiser’s line-up and the band's invitations after withdrawal.
- Add focused tests and update the banner and version history.

## Technical details
- Add an authenticated invitation-withdrawal action using existing band-representation and festival-management permission checks.
- Use row locking, invitation versions, idempotency and audit records; preserve existing edition organiser withdrawal.
