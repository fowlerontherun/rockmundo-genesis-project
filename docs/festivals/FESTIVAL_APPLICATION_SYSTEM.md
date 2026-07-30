# Festival artist application system

The authoritative artist-planning aggregate is edition-bound through the Festival company's ticket plan and artist programme. Its persisted records are `festival_artist_applications`, `festival_artist_invitations`, immutable `festival_artist_offer_revisions`, canonical `festival_artist_offers`, and `festival_artist_bookings`. A booking is the existing Festival contract aggregate; no client-side or parallel contract table is used.

## Authority boundaries

Browser code reads `get_my_festival_artist_opportunities` and invokes only the artist workflow RPCs. Submission, withdrawal, organiser review, invitation response, offer acceptance, financial commitment, audit evidence, and durable communication happen in database transactions. The tables deny `authenticated`, `anon`, and `PUBLIC` writes. Every mutation takes a UUID idempotency key and version where it changes an existing aggregate.

Application transitions are `submitted -> under_review -> shortlisted -> offer_pending -> accepted`, with terminal `rejected`, `withdrawn`, and `expired` branches. Invitations progress from `sent`/`viewed` to `interested` or `declined`, then through the canonical offer. Offers progress through `draft`, `sent`, `countered`, `accepted`, `declined`, `expired`, or `withdrawn`. Invalid transitions are rejected while the row is locked.

Eligibility is returned as `{ eligible, reasons[] }`; reason codes are stable Festival domain errors and may carry `required` and `actual` values. The same server decision must be used for discovery and mutation. React may display these reasons but does not decide eligibility.

Accepted offers create exactly one booking and one finance commitment. A booking remains `awaiting_schedule` until the canonical timetable/activity boundary can reserve a valid commitment; this workflow does not invent a performance slot. Notifications use the artist opportunity, public edition, owner application, and contract workspaces rather than legacy `/festivals/:id/manage` paths.

Legacy `festival_participants`, slot applications, and slot offers are compatibility/history sources only. Their write triggers and certification inventory prevent their use as application authority. Ambiguous historic identities remain read-only for administrative mapping rather than being promoted to an active contract.

## Verification status (2026-07-30)

Static TypeScript and Festival certification gates are run by this change. Database results may only be recorded after `scripts/festivals/run-artist-applications-db-gate.sh` and `scripts/festivals/run-upgrade-db-gate.sh` execute against an explicitly disposable reset database; absence of `SUPABASE_DB_URL` is not a pass.
