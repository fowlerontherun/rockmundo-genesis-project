# ADR: Festival domain canonicalisation

## Status

Accepted

## Context

RockMundo currently has overlapping festival implementations. The older player flow uses `game_events`, `festival_participants`, and `src/hooks/useFestivals.ts`. Newer owner/admin and marketplace features use a dedicated `festivals` table plus staff, permits, insurance, sale, ownership and ledger tables. Several expansion tables bridge the two by using festival-specific names while still referencing `game_events`.

This split creates unclear ownership for dates, lifecycle, applications, slots, ticketing, performance outcomes, finance and rewards. It also allows direct client-side status, money and fame mutations.

## Decision

Dedicated festival-domain tables will become authoritative. `festivals` represents the permanent festival brand or organisation. A later additive migration will introduce `festival_editions` for dated occurrences. Generic `game_events` will become a calendar/world-event projection that may reference a festival edition, but it will not be the authoritative festival record.

This ADR does not create the schema. It records the proposed direction for follow-up PRs.

## Canonical ownership rules

- `festivals` owns brand identity, ownership and marketplace sale state.
- `festival_editions` will own dates, lifecycle, capacity, occurrence-level finances and public availability.
- Edition stages and stage slots will own scheduling and booking positions.
- Applications and contracts will own the booking lifecycle before slot assignment is final.
- Performances and immutable edition results will own outcomes, reviews, fame, rewards and history.
- `game_events` can mirror public edition data for discovery, calendars and world news only.

## Data-flow rules

- Player reads should go through a canonical festival adapter while legacy compatibility remains necessary.
- Player writes for applications, withdrawals, negotiations, performance completion and reward claims should move to RPC/Edge/server services.
- Owner/admin writes for stages, slots, lifecycle and operations should target edition-scoped tables.
- Finance summaries should be derived from immutable ledger entries wherever possible.
- Compatibility views/adapters must be temporary and documented with removal criteria.

## Security rules

- Browser code must not calculate authoritative festival performance rewards.
- Browser code must not directly update band money or fame for festival settlement.
- Booking, settlement and reward endpoints must be idempotent.
- Application, contract and slot state transitions must be validated server-side.
- RLS policies should be scoped to owners/admins/band members rather than broad authenticated writes.

## Migration strategy

1. Add `festival_editions` and a scoped lifecycle model without removing legacy data.
2. Add canonical applications, contracts, setlists and performances.
3. Add compatibility adapters/views for existing routes.
4. Migrate legacy `game_events`/`festival_participants` data into canonical entities.
5. Move player reads, then player writes.
6. Move owner/admin reads and writes.
7. Convert calendar integration into `game_events` projection from editions.
8. Move settlement to server-authoritative idempotent services.
9. Stop legacy writes and monitor.
10. Remove legacy tables only after verification.

## Alternatives considered

- Keep `game_events` as the authoritative festival table. Rejected because owner/admin marketplace and operations already require richer dedicated concepts.
- Keep both systems indefinitely. Rejected because status, finance, schedule and reward authority remain ambiguous.
- Immediately drop legacy tables. Rejected because active player routes and many foreign keys still depend on them.

## Consequences

- Future festival PRs must avoid adding new writes to legacy festival tables except compatibility/projection writes required during migration.
- The next schema PR must be additive and reversible.
- Some pages will remain hybrid until adapters and canonical tables exist.
- Documentation and inventory must be kept updated as migration steps land.

## Follow-up PRs

1. `feat(festivals): introduce canonical festival editions and lifecycle model`
2. `feat(festivals): add canonical applications contracts setlists and performances`
3. `refactor(festivals): add compatibility adapters for legacy festival reads`
4. `feat(festivals): move performance settlement server-side`
5. `refactor(festivals): migrate owner and admin tools to festival editions`
6. `chore(festivals): stop and remove legacy festival writes after verification`

## Accepted foundation implementation

This PR establishes the first additive canonical schema layer:

- `festival_editions` owns dated occurrence state, city, venue, capacity, ticket-price cents, budget allocation and lifecycle timestamps.
- `festival_edition_status` is a PostgreSQL enum with: `concept`, `planning`, `applications_open`, `booking`, `announced`, `on_sale`, `setup`, `live`, `settling`, `completed`, `postponed`, `cancelled`, and `abandoned`.
- `festival_edition_lifecycle_events` records immutable server-side lifecycle history with idempotency keys.
- `festival_legacy_mappings` bridges canonical editions to `dedicated_festival_row`, conservatively matched `game_event`, and `festival_lineup_source` identifiers.
- Owners derive edition-management rights from `festivals.owner_profile_id`; admins continue to use `public.has_role(auth.uid(), 'admin')`.
- Direct browser writes are denied for edition, lifecycle and mapping tables. Mutations go through `create_festival_edition`, `update_festival_edition_planning`, and `transition_festival_edition`.
- Compatibility remains explicit: owner tools may display canonical edition lifecycle, but brand-scoped staff, permits, insurance, marketplace and legacy event-backed player flows remain unchanged until later migrations.

Unresolved migration items remain canonical applications, contracts, setlists, performances, stage/slot re-keying, tickets, attendance, settlement, reward ledgers, audience/incident/vendor/staff-shift systems, and final legacy withdrawal.

## Correction: deployable edition foundation

The edition foundation is hardened by additive migration rather than by renaming the historical `20291204090000` migration. This preserves compatibility with any environment that may already have recorded that migration while allowing clean databases to apply a deterministic follow-up correction.

The public edition projection is explicitly privacy-scoped and rebuilt after its helper function. Creation and transition RPCs now persist idempotency request records and reject mismatched idempotency reuse. Planning writes use JSONB patch semantics so clients can distinguish omitted values from intentional clears. Owner UI flows derive managed state from a shared edition selector and save occurrence planning to editions rather than permanent festival brands.

Remaining canonicalisation work is intentionally deferred: applications, contracts, setlists, performance settlement, stage re-keying, ticket/attendance re-keying and reward/fame settlement are not included in this correction.

## Booking contract layer update

Canonical festival booking now follows application -> offer revision -> contract -> signature -> active lineup. Applications and offers are not bookings; only fully signed active contracts can reserve a compatible stage slot. Public projections exclude contract economics and signatures. Performance simulation and settlement remain deferred.

## Booking hardening decision

Canonical festival booking mutations are database-authoritative. Band authority follows leader/founder/co-leader/manager roles, idempotency is centralised in `festival_booking_requests`, offers/contracts/setlists are versioned immutably, and public reads use safe projections only.

## 2026-07-16 booking UI migration decision

The primary player festival route (`/festivals`) and organiser management booking tab (`/festivals/:festivalId/manage`) consume the hardened canonical booking services for applications, offers, contracts, signatures and setlists. Legacy festival rows remain available only through explicit compatibility mode for unresolved identifiers and historical performance data. Canonical performance sessions and reward/financial settlement remain outside this decision.

## Booking UI hardening addendum

Canonical booking UI code is now organised by workflow component rather than a monolithic shared file. The UI treats idempotency keys as deliberate-action state that survives retries, renders terms through typed projections, and keeps legacy booking/history reads separated from canonical writes. Performance sessions, audience simulation, settlement and rewards remain outside this ADR checkpoint.

## Booking workspace completion decision

Canonical booking workspaces use additive server projections for represented bands, application eligibility, invitation candidates, booking slots, repertoire and setlist preflight. Client components may map these projections into view models, but they must not invent booking authority, song permissions or application blockers. Performance sessions, outcomes, rewards and settlement remain outside the booking-workspace boundary.

## Follow-up: canonical performance sessions

After booking activation, festival performance execution is canonicalised through `festival_performance_sessions` and its attendance, equipment, crew, incident and event-history child tables. The gig viewer and live UI are presentation consumers of this session state; they must not implement a parallel festival lifecycle or calculate rewards directly.
