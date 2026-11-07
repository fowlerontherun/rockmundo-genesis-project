# Label Play Together suggestions

Label owners (including company owners) can recommend a headliner/support pairing from Label Management → Roster. Only active bands with current active contracts appear. Solo artists are excluded. The label can track both responses.

Bands review suggestions under Play Together → Friends & labels. “Interested & shortlist” records only the acting band's interest and adds the other band to its private shortlist in the same transaction. Either band may later decline; this does not remove an existing shortlist entry. Both bands' interest enables a Find Support shortcut for the headliner. Use the Shortlist filter when choosing an eligible support band for a saved gig or tour.

A recommendation creates no bookings, friendship, schedule entries or financial commitments. Normal availability, travel, revenue, invitation and acceptance checks remain in the existing booking flows. A label cannot answer for a band. Declining remains possible after roster changes, while expressing interest requires both bands still be active on that label.

There is one durable recommendation per label/band pair, regardless of role order. Retrying a suggestion keeps its original roles, note and responses. Lists show the most recent 100 recommendations. There are no inbox notifications or proposed dates in this increment.

Apply `20261107232830_label_play_together_suggestions.sql` after the existing discovery/shortlist migration and before deploying the client. This implementation does not apply migrations to the live database. The grouped-tour-offer changes are already on main. The integration PR brings the label suggestions and booked-tour invitation entry point onto main.

Verification:

- `node --test scripts/support-bands/*.test.mjs`: tests real label ownership helper and recommendation RPCs with PGlite; covers direct/company ownership, outsider/anonymous restrictions, private reads, direct-write rejection, current roster/date checks, independent responses, shortlist creation and idempotent retries.
- `npx vitest run src/features/support-bands --maxWorkers=1`: label creation, band response, mutual-interest booking shortcut and expired-roster/error states, plus existing picker/friendship checks.
- Targeted ESLint, full TypeScript check and production build.

## Inviting bands after booking

Tour Manager now has an “Invite bands to tour” button on your scheduled and active tour cards. It opens support matching directly for the saved tour. Headliners can select eligible bands and choose remaining open dates, including after the tour has started. Past dates, dates with existing pending/confirmed support, and infeasible candidate dates are excluded. Existing confirmed bookings remain protected by the server offer workflow.

UI regression: `npx vitest run src/components/tours/BookedTourSupportDialog.test.tsx src/components/tours/TourSupportPanel.test.tsx --maxWorkers=1` exercises opening invitations from a booked tour and sending invitations for scheduled/active tours while excluding past, occupied and infeasible dates.
