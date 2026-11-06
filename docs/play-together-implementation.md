# Play Together implementation

## First increment

- Shared searchable candidate cards in gig support discovery and tour support management.
- Private band-level shortlists, visible and editable only by users allowed to manage that band's gigs.
- Labelmate suggestions derived from active, currently effective contracts, without exposing contract finances.
- Suggestions only decorate candidates returned by existing authoritative eligibility searches; they cannot bypass availability or opt-in.
- Mount tour support management in the current band's tour details.
- Remove automatic support-band assignment and scheduling from the tour wizard. Support bands must accept offers through the existing workflow.
- Display stored offer revenue shares; refresh tour coverage after a partially failed send.

Apply `20261106070014_play_together_discovery.sql` before deploying the client. Existing support preferences and invitation functions remain required. Shortlist/labelmate failures are shown with retry; ordinary eligible candidates remain usable.

## Remaining increments

1. Band-profile discovery and mutual band friendships; broader country/worldwide touring interests instead of mandatory city/date advertisements.
2. A single tour proposal with selected dates, transactional acceptance, itinerary version checks and a unified inbox. This increment still sends per-show offers.
3. Support applications and proposals before dates have been booked.
4. Label management's Live & Touring section and label-initiated proposals requiring both bands' acceptance.
5. Co-headlining rules and explicit shared billing/payment terms.

## Verification

- `node --test scripts/support-bands/discovery.test.mjs` runs the migration in PGlite and tests ownership, idempotency, self-shortlisting rejection, private reads/deletes, anonymous access and expired/future label contracts.
- `npx vitest run src/features/support-bands/PlayTogetherPicker.test.tsx --maxWorkers=1` exercises filtering, selection, shortlist removal and recommendation-service failure.

The migration is forward-only. It does not change existing bookings or backfill legacy tour support assignments.
