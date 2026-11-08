# Play Together completion

## Player flow

1. Enable support gigs/touring in Play Together. Touring may use advertised cities/dates, selected countries, or worldwide interest, with optional dates and a per-journey travel limit. Single gigs continue to use city/date advertisements.
2. Discover bands from a gig, booked tour, band profile, accepted friendships, private shortlist or label suggestion. Profile links carry the selected band into booking. A notification for another band asks the player to switch characters rather than responding as the wrong band.
3. From a scheduled or active booked tour, select remaining open dates and send one saved proposal with an optional message. The proposal stores the reviewed itinerary, venues, 20% ticket share and response deadline (seven days or the earliest offered show, whichever is sooner).
4. Both bands receive actionable inbox entries. The support band accepts or declines the itinerary together; the headliner can withdraw it. Existing per-show slots remain the booking, scheduling and settlement authority. Legacy per-show offers remain supported separately.
5. Sending and accepting validate travel across selected dates and other committed gigs, the required members’ current cities, the time available for arrival, willingness to travel and maximum journey duration. Unknown locations fail closed. Actual transport and return travel are arranged through the existing Travel screen; acceptance never buys transport or teleports players.
6. A material date/end-time/venue/headliner/tour change or cancellation clears affected support consent and obsolete schedules without penalising the support band’s reliability. Pending proposals containing a changed date are closed and their remaining pending slots released. Other unchanged confirmed dates retain their bookings. A revised itinerary requires a new invitation.
7. Labels can attach a pairing to a saved gig/tour and track invited/confirmed dates. Labels cannot accept for either band or silently change a booking link after either band has reviewed it.
8. Confirmed slots, setlists, cancellation previews, history, fame/fan/reputation gains, member XP and payment status are available in Play Together. Completion ends member schedule entries. Pending finance is distinguished from money paid.

## Rewards and retries

The live band settlement formula is preserved. A snapshot of its 7 November definition is used in the isolated regression harness; this fixture is not a deployment migration. The test executes that real settlement and history integration while substituting the finance transport and fan-demand helper dependencies.

Support members now receive the same fame-based XP pool convention used by core gig completion: floor(support fame gain × 1.5), split across the members scheduled on that accepted support slot. Each slot/profile has a unique receipt linked to the normal experience ledger. Cancelled schedules are excluded. Finance retries cannot duplicate payments, band progression, history, reputation or member XP.

## Live verification

Applied directly to RockMundo during this implementation:

- `20261107235545_play_together_live_reconciliation.sql` restores missing shortlist, friendship, label suggestion, tour eligibility and grouped-offer objects using forward-only object guards. The relevant original migration tests pass.
- `20261107235708_play_together_complete_lifecycle.sql` adds broader touring interest, proposals, notifications, route validation, label booking links, consent invalidation, guarded results and member XP receipts.

Live catalogue checks confirmed all eleven required feature RPCs, RLS on the private tables, denial of anonymous proposal execution, denial of client execution of the internal route helper, authentication guards on proposals/results, and one active five-minute expiry job. The settlement function digest is unchanged (`2682efa1eb67eab59d6587b2391bbf58`). There were no existing support slots or settlements at verification time. No real player gigs or rewards were created to perform this check.

Security advisors were checked before/after deployment. Internal receipt tables intentionally have no client policies or grants. Authenticated API functions use explicit band/label authority checks; internal helper functions are not client executable. Notification receipts prevent duplicate delivery for the same event/user.

- The slot-authority repair migration explicitly revokes legacy client write grants and removes the obsolete INSERT/UPDATE policies. Authenticated clients can read involved slots; all booking mutations use server RPCs.

## Validation

- `node --test --test-concurrency=1 scripts/support-bands/*.test.mjs`: seven suites, including country/worldwide matching without city adverts, atomic proposals, deadlines/expiry, arrival checks, independent label/friendship consent, private results, rescheduling and finance-failure/retry settlement with exactly-once member XP.
- `npx vitest run src/features/support-bands src/components/tours/TourSupportPanel.test.tsx src/components/tours/BookedTourSupportDialog.test.tsx --maxWorkers=1`: profile actions, opt-in, proposal terms/permissions/errors, label pairing and booked-tour UI regressions.
- Targeted ESLint, full TypeScript check, production build and diff checks.

## Scope

This completes the one-headliner/one-support booking flow described in the review. Co-headlining, multiple support acts and negotiated fees remain separate gameplay expansions. Physical travel remains a player action with its existing costs and rules. Live verification is a schema/authentication smoke check; the full gameplay lifecycle is exercised with isolated fixture bands and mocked external finance transport, not real player bookings.

## Proposal authority follow-up

The review of #4762 identified two lifecycle gaps: closing an altered proposal left its remaining pending slots blocked, and the public per-show response API could accept proposal dates independently of the itinerary deadline and route check.

The forward-only `20261108090805_tour_proposal_response_authority.sql` moves per-show and batch execution for saved proposals into private, non-client-executable functions. Public legacy response APIs reject proposal-owned slots, including mixed batches, regardless of notification-suppression settings. The public proposal response retains all permission, deadline, itinerary and route checks. Ordinary standalone gigs and legacy tour batches keep their existing response APIs.

Removing or expiring a pending date now closes its proposal and releases remaining pending slots immediately. This also applies when acceptance of a competing proposal expires a conflicting date. The current response is scoped by proposal identity so legitimate multi-date acceptance, decline and withdrawal remain atomic. Expiry processing marks the proposal expired before releasing its slots, avoiding a false changed notification. A data repair releases pending slots from previously changed proposals while preserving accepted dates and their member schedules. The response fallback also handles missing slot rows.

Proposal cards show the current status of each date, clear status explanations, start/end times in the player's timezone, and a headliner action to release expired dates before the expiry worker runs.

Regression coverage: `node --test --test-concurrency=1 scripts/support-bands/proposal-authority.test.mjs` tests legacy API bypass attempts, deadline handling, unavailable member locations, private-function execute denial, mixed-batch rollback, competing offers, immediate removal cleanup, scheduled expiry, safe repair of an old partial acceptance, replacement invitations, and legacy API compatibility. The complete lifecycle and settlement harnesses now load this migration too.

Applied directly on 8 November 2026. Live checks confirmed both public legacy guards, private helper execute denial for authenticated clients, the enabled slot-cleanup trigger and no pending slots attached to changed proposals. The existing settlement function digest remains unchanged. The database had no proposal bookings at the time of deployment, so the repair changed no player commitments.

## Player usability follow-up

Play Together now starts with task shortcuts, saved availability status, booking reply counts and pending friendship/label suggestion counts. Availability controls come first; optional limits and city adverts are expandable. Unsaved preferences cannot be discarded by saving another availability form. Tab/section links preserve booking context and support reload and browser Back.

Tour proposals can be searched and filtered into awaiting replies, sent invitations, confirmed tours and history. Incoming decisions appear first, expired cached invitations lose their acceptance action, past itineraries collapse, and responsive date cards replace the wide table. Booked-tour invitations offer select-all/clear controls, named dates and explicit ticket-share terms. Discovery can sort connections first, fame or name; profile links preserve the current booking in another tab and empty filters can be reset.

Validation: 23 targeted UI tests cover reply counting, navigation, saved versus unsaved preferences, load-failure recovery, proposal filtering/deadlines, discovery sorting and date selection. Full TypeScript, targeted ESLint and production build checks run for this pass. Browser visual verification was unavailable because the shared browser could not reach the local preview. This follow-up changes no database objects or booking authority.
