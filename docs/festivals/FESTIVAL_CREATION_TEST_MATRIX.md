# Festival Creation Test Matrix

## Executable SQL harness

`supabase/tests/festival_creation_phase1_harness.sql` now executes the creation RPCs inside a rollback-only transaction and verifies:

- Anonymous and non-admin creation rejection.
- Admin creation success.
- Festival, first edition, stage, lifecycle history, and audit history creation.
- City, currency, timezone, ticket values, edition status, and stage ownership persistence.
- No `game_events` festival row creation.
- Stable idempotent retry result.
- Material idempotency conflict rejection.
- Rollback for invalid dates, invalid city, venue/city mismatch, duplicate stage names, unsupported currency, and unsupported timezone.
- Server-authoritative later-edition numbering through edition 3.
- Request rows do not remain for failed creation attempts.

## Frontend checks added

- Reference data is loaded from `admin_festival_reference_data`.
- Country filters city options; city filters venue options.
- City selection projects timezone and currency into the draft.
- Venue capacity is displayed and blocks advancing when exceeded.
- Lifecycle controls render server-projected options.
- Application queries are explicitly edition-, festival-, or band-scoped.

## Not yet fully automated

- True two-session concurrent SQL execution remains a recommended database stress test outside the single-session harness.
- Screenshot capture was not performed in this headless change because the app could not be reliably run against a seeded Supabase instance in this environment.
