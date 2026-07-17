# Festival Creation Phase 1 Audit

## Confirmed working behaviour

- The merged workflow exposed admin festival creation from `FestivalsAdmin` and routed submissions through `admin_create_festival_with_first_edition` and `admin_create_festival_edition_with_setup`.
- Existing canonical edition constraints already include `UNIQUE (festival_id, edition_number)`, which is retained as the authoritative duplicate-edition guard.
- Existing lifecycle and audit tables are available and the hardened creation RPC now writes both lifecycle history and admin audit events in the same transaction as the aggregate creation.

## Untested behaviour before this PR

- The previous SQL harness only asserted function and column existence; it did not execute the RPCs under anonymous, non-admin, or admin authentication contexts.
- Rollback behaviour for invalid dates, invalid locations, duplicate stages, and unsupported reference values was not executable in CI.
- Retry behaviour and material-payload mismatch handling were not proven.

## Defects found

- Idempotency uniqueness used nullable `actor_profile_id`, allowing duplicate request rows for the same actor/key when a profile could not be resolved.
- First-festival creation called the public edition creation RPC with a derived key, leaving nested request semantics that could confuse retries.
- The frontend treated a single location selector as both country and city, and queried `cities`/`venues` directly instead of using a server-projected admin reference-data contract.
- Lifecycle controls hardcoded transition options in React.
- Application review code passed `editionId || festivalId` into a hook whose implementation filtered only by `festival_id`.
- `festival_stages.festival_id` had been made nullable even though legacy projections, joins, and compatibility queries still use it.

## Security risks

- Browser-provided payloads could influence edition numbering and reference-like fields without complete server-side validation.
- Admin authority checks existed, but idempotency actor identity was profile-based instead of `auth.uid()`-based.
- Creation retry conflicts were surfaced as generic errors.

## Compatibility risks

- Older code joins `festival_stages` by `festival_id`; leaving it nullable could hide stages from admin and public projections.
- Direct frontend reference table reads are more brittle than a stable projection and can overexpose future columns.
- Copy-from-previous-edition services exist, but their safe category model requires a dedicated follow-up before claiming full copy support.

## Deferred Phase 2 work

- Drag-and-drop scheduling, unified lineup management, performer recommendation, offer/contract redesign, setlist readiness, live simulation, sponsorship gameplay, and player festival licensing remain out of scope.

## Phase 1.1 deployment correction note

Phase 1 hardening is considered verified only after the new forward migration is applied and the executable checks pass. The forward migration preserves historical request rows, backfills actor identity from profiles where deterministic, enforces server creation modes, removes nested public creation for first editions, and requires one external idempotency request row per operation.
