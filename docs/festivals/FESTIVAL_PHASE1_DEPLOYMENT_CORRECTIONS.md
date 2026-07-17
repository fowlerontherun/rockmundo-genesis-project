# Festival Phase 1.1 Deployment Corrections

## Confirmed findings from PR #1220 review

1. PR #1220 edited `20260717120000_admin_festival_creation_phase1.sql` after that migration was already part of merged history.
2. Environments that had recorded that migration would not automatically receive the edited SQL.
3. Historical `admin_festival_creation_requests` rows can have `actor_user_id` set to null.
4. `auth.uid()` is not a deterministic migration backfill source and can be null during database migrations.
5. First-festival creation nested through the public edition-creation RPC.
6. The nested request row was deleted after first-edition creation.
7. The created first edition was updated to edition number one after insertion.
8. `create_first_edition` and `add_edition` modes were not fully enforced by the server.
9. Lifecycle confirmation, severity and override projection existed without complete UI handling.
10. Wizard dirty-state detection compared against a newly generated idempotency key.
11. Large creation/admin component splits remained incomplete and should continue incrementally after deployability is safe.
12. The SQL harness used generic exception assertions for domain-error cases.
13. Frontend coverage for dirty-state behaviour was missing.
14. The implementation environment had not completed the requested lint, unit, build and SQL execution checks.

## Corrections made

- Added `20260717153000_harden_festival_creation_phase1_forward.sql` as a forward-only migration so deployed databases receive Phase 1.1 hardening without relying on edits to the historical Phase 1 migration.
- Backfilled `actor_user_id` through `admin_festival_creation_requests.actor_profile_id -> profiles.id -> profiles.user_id` and preserved unresolved historical rows with `actor_resolution_status = 'historical_unresolved'`.
- Replaced the full actor-user uniqueness with a partial idempotency index that only applies where `actor_user_id` is non-null, while public RPCs always write resolved authenticated user identities.
- Added the private `internal_create_festival_edition_setup` helper and revoked authenticated/anon execute grants.
- Reworked public creation RPCs so each external operation writes one request row. First-festival creation now inserts edition number `1` directly and does not delete an inner request row.
- Enforced `create_first_edition` and `add_edition` server modes with `FESTIVAL_CREATE_FIRST_EDITION_ALREADY_EXISTS` and `FESTIVAL_CREATE_ADD_EDITION_REQUIRES_EXISTING` domain errors.
- Improved reference-data projection with canonical fallback genres, stable country codes, city-derived time zones and projected stage-field options.
- Improved lifecycle projection text and authority checks.
- Added material draft dirty-state comparison that excludes idempotency keys.
- Rendered lifecycle blockers, warnings, confirmation, destructive typed confirmation and explicit override reason handling.
- Strengthened SQL assertions with expected message fragments and added a migration-upgrade contract harness.

## Verification status

Phase 1 is verified only after the forward migration and executable checks pass: typecheck, lint, unit tests, production build and the festival database gate.
