# Canonical booking workspace completion

This note records the completion pass after PR #1196. PR #1196 modularised the booking UI and introduced canonical actions, but left projection gaps that caused the UI to depend on placeholder eligibility, raw song identifiers, client-selected authority and broad invalidation.

## Represented bands and eligibility

The additive migration `20291208090000_complete_festival_booking_workspaces.sql` adds `festival_represented_bands()` so the player hub can load every active band linked to the current authenticated player. The projection delegates authority to the canonical helpers `can_apply_for_band`, `can_negotiate_for_band`, `can_sign_for_band` and `can_manage_festival_booking` instead of reimplementing role rules in React.

`festival_application_eligibility(p_edition_id, p_band_id)` preflights authority, edition state, application-window state, active applications, active contracts and advisory schedule overlap. Eligibility is read-only and does not create schedule blocks.

## Invitation candidates and slots

`festival_invitation_candidates(p_edition_id, p_search)` exposes organiser-authorised candidate rows with deterministic search and excludes already contracted bands from invitation eligibility. It avoids private finances and private schedule details.

`festival_booking_slots(p_edition_id)` projects canonical stage slots with stage name, times, slot type, reservation state, public band information and availability. Organiser offer flows should use this projection rather than free-text stage names when a slot exists.

## Authority, repertoire and setlist preflight

Workspace clients now have mapping functions for server-projected authority, eligibility, repertoire and setlist preflight data. The hand-written Supabase facade was removed in favour of the typed project Supabase client, with narrowly isolated RPC casts while generated database types catch up.

`festival_contract_repertoire(p_contract_id)` returns songs belonging to the contracted band and marks current setlist usage. `festival_setlist_preflight(p_contract_id, p_items)` validates duration, invalid song identifiers, duplicates and repertoire availability before authoritative save or submit RPCs run.

## Realtime and idempotency

The React idempotency hook no longer dispatches state updates during render. It keeps keys stable across retries and unrelated rerenders, regenerates after successful or cancelled action lifecycles, and changes keys only after material input changes are committed through React lifecycle.

Targeted booking query keys were added for represented bands, eligibility, invitation candidates, booking slots, repertoire and preflight so realtime/SSE invalidation can refresh only the active workspace scope.

## Organiser queues and prompts

The organiser application rejection flow no longer uses `window.prompt`; it uses an accessible dialog with a required reason and stable idempotency. Contract and setlist queue projections are documented as real workspace queues backed by canonical contracts and setlists.

## Validation results

Implemented validation in this pass:

- `npm run typecheck` passed.
- Booking-feature Prettier passed; SQL formatting was not run because the repository Prettier configuration has no SQL parser.
- Focused Vitest coverage was added for the idempotency hook and projection mappers.

Local Supabase reset and SQL harnesses still require a fully bootstrapped Supabase validation environment. Canonical performance sessions, performance outcomes, rewards and financial settlement remain deferred.
