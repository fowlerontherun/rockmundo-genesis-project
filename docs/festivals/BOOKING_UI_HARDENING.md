# Booking UI hardening audit

## PR #1195 implementation review

Reviewed the canonical player hub, organiser booking workspace, shared booking components, canonical services/hooks, generated Supabase types, festival routes, legacy festival dialogs, band/song/schedule patterns, currency helpers, responsive dialog conventions, notification patterns and test harnesses.

## Claim status

| PR #1195 claim | Status | Finding | Hardening in this PR |
| --- | --- | --- | --- |
| Canonical player hub | Partially implemented | The tabs existed, but several workflows were summary-only and depended on a raw `bandId` prop. | Hub now consumes typed domain projections, readable money helpers and focused workflow components. |
| Canonical organiser booking workspace | Partially implemented | Application queues existed, but many actions were rendered without per-state gating and other queues were placeholders. | Queue modules split application, offer, contract and setlist surfaces with counts, loading states and action gating. |
| Shared booking components | Partially implemented | A single `components.tsx` file mixed progress, application, offer, contract, setlist and workspace code. | Replaced with focused modules under `booking/components/`; `components.tsx` is now a re-export shim only. |
| Canonical/legacy mode resolution | Fully implemented for routing scope | The mode helper was present and had tests. | No change; hardening keeps canonical and legacy write paths separated. |
| Basic application actions | Partially implemented | Application submission used hardcoded USD and unstable `Date.now()` keys. Withdrawal existed but lacked stable action lifecycle. | Application form validates core fields, uses edition currency and stable deliberate-action idempotency keys. |
| Basic offer actions | Partially implemented | Counter-offer submitted unchanged terms with `No-change counter opened from UI`, acceptance happened directly from the card, and terms were partly raw JSON. | Added a real counter dialog requiring material changes plus acceptance confirmation and readable terms summary. |
| Basic contract actions | Partially implemented | Signing authority came from a component prop and private terms rendered as raw JSON. | Added a signing panel that takes an authority side projection, acknowledgement and readable terms sections. |
| Basic setlist actions | Partially implemented | Setlists required manual song IDs and lacked keyboard reordering. | Added explicit up/down controls and stable keys; repertoire-backed selector remains deferred until the song permission RPC is available. |
| `/festivals` and owner booking-tab integration | Partially implemented | Routes were wired, but the UI remained a scaffold. | Existing import path is preserved while internals are modularised. |
| Workflow test coverage | Not implemented | Only mode/type tests existed. | Added unit coverage for idempotency key construction, progress projection and currency fallback. |
| Repository and DB validation | Not implemented | Prior PR did not execute the full harness. | This PR attempted dependency installation, typecheck and targeted tests; database reset remains blocked by local Supabase/Docker availability. |

## Component architecture

`src/features/festivals/booking/components.tsx` no longer contains implementation. Focused modules now own progress, status cards, application dialog, offer revision/counter/terms, contracts, signatures, setlists and organiser queues.

## Idempotency lifecycle

`useStableMutationIdempotencyKey` creates one UUID-backed key per deliberate action, retains it through retries and exposes explicit success/cancel regeneration. Form fingerprints regenerate keys when material input changes.

## Player workflow

Players can discover canonical editions, submit validated applications using edition currency, withdraw applications, review readable offers, submit a changed counter-offer, accept with confirmation, sign authorised contracts, and prepare setlists after activation.

## Organiser workflow

Organisers receive separated queues for new, under-review, shortlisted and waitlisted applications plus offer, signature, active booking and setlist sections. Review actions are state-gated and send stable idempotency keys.

## Deferred work

The following remain intentionally deferred or blocked by missing server projections: direct invitation search UI, server-returned signing authority projection, repertoire-backed song picker, realtime subscriptions and full SQL harness repair. Performance sessions, audience simulation, rewards, payments and settlement remain out of scope.
