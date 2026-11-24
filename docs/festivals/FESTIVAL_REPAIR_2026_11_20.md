# Festival repair verification

## Delivered

- Reject invalid owner money/capacity inputs without substituting earlier values.
- Refresh owner readiness after planning/booking changes and periodically; link blockers to remediation.
- Preserve simulation availability independently of unavailable live gates.
- Block final simulation until the festival's final city-local day has ended; repeated completed-result reads remain allowed.
- Resolve real lineup names, edition-specific timetable links and currencies.
- Hide stale history/attendance after failed reads; recover ticket-plan failure rendering.
- Reuse the public ticket/check-in page on mobile and persist Festival Mode sections in the URL.
- Authenticated counteroffers use version, identity, budget, deadline, idempotency and audit checks.
- Current band bookings accept saved ordered song selections and backstage preparation choices through an authenticated private implementation. Ownership, duration, version and start-day locks are enforced.

## Explicit limitations

Canonical live gates, crowd ticks, stage actions and receipt infrastructure are absent from the live schema. Availability deliberately reports unsupported rather than enabling unsafe calls. Setlists and backstage choices are persisted preparation, not yet connected to live performance effects or rewards; legacy contract-bound gameplay is not reactivated. Solo preparation is not included.

## Checks

- 46 focused tests passed, including PostgreSQL final-local-day behavior and saved-preparation readback.
- 3 nested-route resolver tests passed; active-system inventory check certified 47 routes.
- Full festival suite: 793 passed, 27 failures across 22 files remain, including legacy wiring/source contracts and database-contract expectations. These are not certified as repaired.
- Preview build log: build OK.
- Authenticated purchase, check-in, counteroffer and preparation UI journeys remain unverified because this project uses external unmanaged authentication; no credentials were requested.
- Existing Supabase linter findings predate these migrations; relocation of exposed implementations to private wrappers introduced no additional findings.

No manual festival settlements or gameplay reward grants were executed.