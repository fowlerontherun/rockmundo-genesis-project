# Festival edition migration notes

## 2029 timestamp anomaly

`supabase/migrations/20291204090000_create_festival_editions.sql` is retained under its historical identity. This workspace cannot confirm whether the merged migration has already run in a shared or production Supabase environment, so renaming it would only repair clean installs and could strand deployed databases that already recorded the 20291204090000 version.

The corrective migration is therefore additive: `supabase/migrations/20291205090000_harden_festival_editions.sql`. Future festival migrations that depend on canonical editions must be timestamped after `20291205090000` or include explicit idempotent guards if they are ever backported.

## Dependency correction

PR #1190 created `public_festival_editions` before `is_public_festival_edition_status`. PostgreSQL cannot create a view with an unresolved function reference, so the corrective migration creates/replaces the helper first, then drops and recreates the public-safe view and reapplies grants.

## Public/private read contract

Public discovery reads use `public.public_festival_editions`, which exposes only edition identity, brand ID, title/description, city, venue, dates, public capacity/attendance, ticket price range, currency, public lifecycle status, public metadata and public lifecycle timestamps. It deliberately excludes budgets, treasury allocation, lifecycle metadata, legacy metadata, reasons, idempotency data, ownership and moderation fields.

Owner/admin reads continue to use protected `festival_editions` access behind RLS and owner/admin checks.

## RPC hardening

- `create_festival_edition` accepts an optional idempotency key and records request hashes in `festival_edition_creation_requests` so retries return the original edition and mismatched reuse is rejected.
- `update_festival_edition_planning` now accepts a JSONB patch, making omitted keys distinct from keys explicitly set to null.
- `transition_festival_edition` locks the edition before checking transition idempotency, records transition request hashes, rejects mismatched idempotency reuse and returns unchanged rows for no-op requests without lifecycle events.
- Lifecycle validation keeps free ticket ranges valid (`0..0` is allowed) while enforcing non-negative prices, date ordering, readiness and explicit admin override metadata for live launch exceptions.

## Owner workflow correction

Owner screens now share deterministic managed-edition selection. The run wizard saves occurrence planning values to the current edition instead of mutating permanent festival brand occurrence fields. When no edition exists, owner workflows present an explicit create-edition action rather than silently falling back to legacy lifecycle writes.

## Validation

`supabase/tests/festival_editions_harness.sql` now checks schema contracts, view privacy, idempotency objects, transition graph invariants and legacy mapping uniqueness inside a rollback-only transaction. `scripts/festivals/check-edition-migration-order.mjs` statically verifies helper-before-view ordering and documents the 2029 anomaly.

## Canonical booking dependent migration

`supabase/migrations/20291206090000_festival_booking_contracts.sql` intentionally sorts after both historical edition migrations. It depends on `festival_editions`, `festival_legacy_mappings`, public edition lifecycle statuses and owner/admin helpers introduced and hardened by `20291204090000` and `20291205090000`.

The booking migration also corrects public edition reads before introducing player-facing application RPCs by adding the `public_festival_editions_read()` security-definer function. The function returns only the same safe public projection as `public_festival_editions`, grants execution to `anon` and `authenticated`, and does not add direct public `SELECT` policies on private `festival_editions` columns.


- `20291207090000_harden_festival_booking_contracts.sql` sorts after the booking foundation (`20291206090000`) and records the corrective hardening for idempotency, slot reservations, immutable versions, schedule blocks and public/private projections.
