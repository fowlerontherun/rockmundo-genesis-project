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

1. Band-profile discovery and friendship notifications; broader country/worldwide touring interests instead of mandatory city/date advertisements.
2. A single tour proposal with selected dates, transactional acceptance, itinerary version checks and a unified inbox. This increment still sends per-show offers.
3. Support applications and proposals before dates have been booked.
4. Label management's Live & Touring section and label-initiated proposals requiring both bands' acceptance.
5. Co-headlining rules and explicit shared billing/payment terms.

## Verification

- `node --test scripts/support-bands/discovery.test.mjs` runs the migration in PGlite and tests ownership, idempotency, self-shortlisting rejection, private reads/deletes, anonymous access and expired/future label contracts.
- `npx vitest run src/features/support-bands/PlayTogetherPicker.test.tsx --maxWorkers=1` exercises filtering, selection, shortlist removal and recommendation-service failure.

The migration is forward-only. It does not change existing bookings or backfill legacy tour support assignments.

## Tour eligibility follow-up

The invitation and acceptance RPCs now derive tour eligibility from the saved gig's `tour_id`. The gig-page support search passes the same context, so a tour-only band can receive and accept tour invitations without enabling single gigs. A band that disables touring between invitation and acceptance is rejected without changing the pending offer or creating schedule entries.

Apply `20261107075018_tour_support_offer_eligibility.sql` to update both RPCs. Validate with `node --test scripts/support-bands/tour-offer-eligibility.test.mjs`; the harness executes the real invitation/acceptance functions with an isolated eligibility matcher to test mode selection and revalidation.

## Band friendships increment

- Search active bands by name independently of booking availability, or request friendship from candidate cards in the shared gig/tour picker.
- Manage incoming requests, outgoing requests and accepted friends in Play Together → Friends.
- Accepting requires the receiving band's gig-management permission. Sending a reciprocal request does not implicitly accept.
- Either band can end a friendship; only the sender can withdraw a pending request. Declines impose a seven-day resend cooldown.
- Friends filter includes only accepted friendships among the existing eligible candidates. It does not change booking consent, preferences, travel checks or schedules.
- The friendship table is readable only by involved bands' authorised organisers. All state changes use authenticated RPCs with a canonical band-pair lock.

Apply `20261107152322_band_touring_friendships.sql` before deploying this client. No migration has been applied live by this implementation. Database regression: `node --test scripts/support-bands/friendships.test.mjs`. UI regression: `npx vitest run src/features/support-bands/PlayTogetherPicker.test.tsx src/features/support-bands/BandFriendsPanel.test.tsx --maxWorkers=1`.

Band-profile actions, notifications, broader availability and label-initiated proposals remain follow-ups.

## Grouped tour dates increment

Tour organisers can deselect dates before inviting a band. The selected dates are sent atomically with retry-safe request keys. Incoming pending offers from the same tour/headliner can be accepted or declined together; individual responses remain available. Acceptance checks the reviewed dates, venues and revenue shares before invoking the existing per-show scheduling workflow. Any failure rolls back the whole response.

Apply `20261107153611_grouped_tour_support_offers.sql` before deploying this client. This is grouping of existing per-show slots, not a new negotiated proposal entity. Band-profile actions, notifications, broader availability and label-initiated proposals remain follow-ups. Database regression: `node --test scripts/support-bands/*.test.mjs`. The grouped test covers authorization, rollback, retry idempotency, stale terms and schedule creation using the real per-show offer RPCs with isolated candidate matchers.
