# Festival booking UI migration

This PR wires the player and organiser festival surfaces to the hardened canonical booking journey introduced by the booking-domain migrations.

## Final player routes

- `/festivals` is the primary player festival hub.
- `/festivals/:festivalId` and `/world/festivals/:festivalId` remain bookmarked detail routes and resolve canonical editions through the shared resolver before falling back to legacy compatibility.
- The hub sections are Discover, My Applications, Offers, Contracts, Preparation and History.

## Final owner routes

- `/festivals/:festivalId/manage` remains the organiser console.
- Its Booking tab is the canonical workspace for edition applications, offers, signature queues, active bookings and setlist queues.

## Component ownership

- `CanonicalPlayerFestivalHub` owns player discovery, application status, offers, contracts and preparation.
- `CanonicalOrganiserBookingWorkspace` owns organiser review queues and canonical offer review.
- `ApplicationStatusCard`, `OfferRevisionCard`, `ContractWorkspace`, `FestivalSetlistEditorCanonical` and `CanonicalBookingProgress` are shared booking components.
- Legacy history and performance components stay outside canonical booking until performance sessions are introduced.

## Canonical versus legacy mode

`getFestivalBookingMode` returns `canonical`, `legacy` or `unavailable`. Canonical editions call only the canonical RPC-backed booking services. Unresolved legacy festival events keep their existing compatibility flows and development warnings identify accidental legacy mutations for canonical editions.

## Status-to-action mapping

- Applications: submitted/under review/shortlisted/waitlisted can be withdrawn; organisers can move to review, shortlist, waitlist, reject or create an offer.
- Offers: only the non-proposing side can accept the current revision; stale revisions are refetched and shown as an actionable error.
- Contracts: authorised sides sign the current version after acknowledgements; active contracts show confirmed schedule state.
- Setlists: drafts and changes-requested versions can be saved and submitted; submitted versions are read-only for bands and reviewable by organisers; approved versions can be locked where supported.

## Error mapping

Canonical booking errors are mapped to player-safe messages for authority failures, duplicates, closed application windows, stale offer revisions, expiry, lost reservations, contract version changes, schedule conflicts and setlist edit/version failures. Technical identifiers remain in logs.

## Mobile behaviour

The canonical hub uses stacked cards below desktop breakpoints, wrapped tab lists, scroll-contained dialogs and sticky save/submit action areas for long application and setlist forms. Offer commercial details and revision history are collapsed by default.

## Realtime behaviour

Booking query keys are centralised under `festivalBookingKeys`, allowing existing Supabase realtime/SSE invalidators to target application, offer, contract and setlist workspaces without subscribing each card independently.

## Deprecated and remaining legacy dependencies

- `useFestivals` is retained for legacy performance/history and unresolved legacy festival actions only.
- Legacy `festival_participants` writes must not be used for canonical applications.
- Legacy setlist no-op success paths are superseded by canonical setlist draft/submit RPCs.

## Deferred work

Canonical performance sessions, arrival/readiness validation, locked-setlist consumption during performance, rewards and financial settlement are deferred.
