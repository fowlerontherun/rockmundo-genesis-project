# Festival Creation Workflow

Administrators create festivals from `/admin/festivals` with the **Create Festival** action. The wizard uses user-facing language for festival identity, first event, location, dates, stages, tickets, commercial setup and lifecycle status; it does not ask administrators for database IDs.

## Flows

- **Create Festival** creates the permanent festival and the first edition in one server transaction.
- **Create first edition** opens the same wizard with the permanent festival identity locked and creates setup for an existing festival with no editions.
- **Add new edition** creates a later edition for an existing festival. Safe setup can be entered from blank; contracts, applications, financial transactions, settlement records, outcomes, performance sessions and audit history are not copied silently.

## Fields and validation

The wizard validates required identity, future edition timestamps, application windows, city and venue selection, capacity, ticket ranges, at least one uniquely named stage, positive stage capacities, minimum five-minute changeovers, supported currency and supported time zone. Money is entered as major units and sent as integer minor units.

## Server transaction

`admin_create_festival_with_first_edition` and `admin_create_festival_edition_with_setup` are authenticated admin RPCs. They validate admin authority, city and venue references, dates, currency, stages and ticket ranges; create the festival or edition; insert initial stages; persist commercial setup on the edition metadata/budget fields; write lifecycle history through the canonical edition creation path; and write admin audit records. Any exception rolls back the full aggregate.

## Idempotency and ownership

The wizard generates one stable idempotency key when it opens. Retries reuse the same key. The server stores a request hash and returns the original aggregate for identical retries, while rejecting materially different payloads. Administrator-created festivals are platform/admin created with no arbitrary browser-supplied owner profile assignment.

## Lifecycle and recovery

New editions start in `planning`. Final submission is disabled while pending, form data is retained after recoverable failures, and the success state offers continuation, management workspace and public page links. If a later catalogue refresh fails, the returned route remains available from the creation result.

## Phase 1 hardening update

Festival creation now relies on server-projected reference data, server-authoritative edition numbering, authenticated actor idempotency, lifecycle/audit writes in the aggregate transaction, and explicit stage festival/edition consistency. Phase 1 is not considered fully verified unless frontend checks and the executable SQL harness pass in the target environment.
