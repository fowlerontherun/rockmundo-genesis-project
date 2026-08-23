# Festival Attendee Architecture Notes

**Implementation plan:** `FESTIVAL_ATTENDEE_IMPLEMENTATION_PLAN.md`  
**Phase:** 0 — Discovery and Architecture Review  
**Status:** Implemented baseline / Phase 1 foundation started

## Summary

RockMundo already has a modern, server-authoritative festival ticketing path in the simplified festival system. The attendee feature must extend that path rather than introducing a second ticket model.

The first attendee slice therefore adds an authoritative character-level lifecycle that is created from a valid modern admission ticket.

## Existing systems to reuse

### Festival identity

The modern festival system uses:

- `festival_launches` — public launch/sales state.
- `festival_editions_v2` — the concrete festival edition and dates/location.
- `festival_ticket_plans` — the edition-linked ticket plan.
- `festival_ticket_products` — admission and add-on products.
- `festival_ticket_sales` — purchase records.
- `festival_issued_tickets` — authoritative issued ticket records.

`festival_ticket_plans.festival_edition_id` is the authoritative bridge from a purchased product to the festival edition the character will attend.

### Character identity

Festival attendance is character-level, not account-level. The existing `current_profile_id()` authority is used so a ticket purchase and attendee record belong to the active character/profile.

### Ticket purchase authority

The existing `purchase_festival_tickets` RPC already owns ticket purchase authority, including sale validation, ticket issuance, capacity locking/idempotency and finance handling.

The attendee system must **not** duplicate ticket sales or debit funds independently.

Instead, a valid issued admission ticket creates the attendee lifecycle automatically.

### Existing ticket wallet

`get_my_festival_tickets()` remains the ticket/wallet read model. The attendee system adds a separate lifecycle read model rather than replacing the wallet.

## Legacy systems intentionally not reused

The existing `festival_attendance` table and older `festival_tickets`/festival attendance hooks belong to the legacy festival/stage-view implementation. They do not provide the lifecycle, privacy or edition authority needed by the attendee mini-game.

They remain untouched so the new attendee work does not destabilise legacy gig/stage presentation paths.

## New authoritative attendee model

`festival_player_attendance` represents one active character's lifecycle for one festival edition.

Initial status:

```text
ticketed
```

Reserved lifecycle states:

```text
ticketed
ready_to_check_in
attending
left_early
completed
cancelled
refunded
```

The initial Phase 1 slice only creates and reads `ticketed` records. Later phases will introduce narrowly scoped RPCs for state transitions.

### Key invariants

- One attendee lifecycle per character/profile and festival edition.
- One admission ticket can back only one attendee lifecycle.
- Add-ons/upgrades do not create attendance.
- Browser clients cannot directly insert/update/delete attendee rows.
- A character can read only their own attendee state.
- The server creates attendee state from an authoritative issued admission ticket.
- Reward, check-in and completion mutation remains server-authoritative in future phases.

## Ticket → attendee flow

```text
purchase_festival_tickets
        ↓
festival_issued_tickets INSERT
        ↓
AFTER INSERT trigger
        ↓
resolve product class + ticket plan edition
        ↓
product_class = admission?
        ↓ yes
festival_player_attendance
status = ticketed
```

The `(festival_edition_id, profile_id)` unique constraint prevents multiple admission SKUs or retries from creating multiple attendee lifecycles for the same character and edition.

## Read API

`get_my_festival_attendance()` returns only the signed-in active character's attendee records, including:

- launch ID
- edition ID
- festival name/slug
- dates
- city ID
- admission ticket reference
- ticket type
- camping/VIP entitlement flags
- attendee lifecycle status
- lifecycle timestamps

This is intentionally a read-only RPC for the browser.

## RLS / security model

`festival_player_attendance` has RLS enabled.

Direct table privileges are revoked from `anon` and `authenticated` roles. Authenticated players receive their data through `get_my_festival_attendance()` and the own-row RLS policy remains defence in depth.

No client-facing mutation API exists in this phase.

## Production-state audit at introduction

At the time this foundation was introduced:

- there were no launched modern festivals in production;
- there were no modern ticket plans;
- there were no issued modern festival tickets;
- therefore no live attendee migration or reconciliation was required.

The migration still contains an idempotent backfill so environments with existing valid admission tickets can safely create corresponding `ticketed` attendee rows.

## Frontend boundary

The frontend gets a small attendance domain/repository/hook boundary:

```text
attendance/festivalAttendance.ts
attendance/festivalAttendanceRepository.ts
attendance/useFestivalAttendance.ts
```

The public festival page may use this only to show that the active character already has an attendee lifecycle for the festival.

Buying extra add-ons must remain possible after becoming an attendee, so the attendee badge must not globally disable the ticket shop.

## Known debt kept outside this slice

The current festival purchase/finance implementation has changed across recent festival migrations. Any remaining finance-ledger reconciliation should be handled in the finance/festival sales stream rather than expanding this attendee foundation.

This slice deliberately does not modify existing purchase accounting.

## Next implementation slice

After this foundation is stable:

1. Add wristband/memorabilia integration using the existing inventory model.
2. Add explicit check-in eligibility/readiness.
3. Add server-authoritative check-in and leave RPCs.
4. Introduce the Festival Mode shell only after check-in state is reliable.
5. Add scheduling locks after Festival Mode entry/exit is authoritative.

Do not implement rewards, day planning, random events or festival condition stats before the entry/exit lifecycle is stable.
