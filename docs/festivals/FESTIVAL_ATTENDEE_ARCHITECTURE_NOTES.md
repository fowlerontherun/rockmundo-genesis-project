# Festival Attendee Architecture Notes

**Implementation plan:** `FESTIVAL_ATTENDEE_IMPLEMENTATION_PLAN.md`  
**Phase:** Programme C — attendee foundation through C4  
**Status:** C1–C4 authoritative foundation complete

## Summary

RockMundo already has a modern, server-authoritative festival ticketing path in the simplified festival system. The attendee feature extends that path rather than introducing a second ticket model.

The attendee foundation now covers admission-backed lifecycle creation, wristbands/memorabilia, authoritative check-in/leave/completion, Festival Mode, and authoritative schedule reservation/booking conflict rules.

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

The existing `purchase_festival_tickets` RPC owns ticket purchase authority, including sale validation, ticket issuance, capacity locking/idempotency and finance handling.

The attendee system must **not** duplicate ticket sales or debit funds independently.

Instead, a valid issued admission ticket creates the attendee lifecycle automatically.

### Existing ticket wallet

`get_my_festival_tickets()` remains the ticket/wallet read model. The attendee system adds a separate lifecycle read model rather than replacing the wallet.

## Legacy systems intentionally not reused

The existing `festival_attendance` table and older `festival_tickets`/festival attendance hooks belong to the legacy festival/stage-view implementation. They do not provide the lifecycle, privacy or edition authority needed by the attendee mini-game.

They remain untouched so the new attendee work does not destabilise legacy gig/stage presentation paths.

## Authoritative attendee model

`festival_player_attendance` represents one active character's lifecycle for one festival edition.

Lifecycle states:

```text
ticketed
ready_to_check_in
attending
left_early
completed
cancelled
refunded
```

State transitions are server-authoritative and audited. Browser clients cannot directly mutate attendee lifecycle rows.

### Key invariants

- One attendee lifecycle per character/profile and festival edition.
- One admission ticket can back only one attendee lifecycle.
- Add-ons/upgrades do not create attendance.
- Browser clients cannot directly insert/update/delete attendee rows.
- A character can read only their own attendee state.
- The server creates attendee state from an authoritative issued admission ticket.
- Check-in, leave, completion, cancellation/refund propagation and schedule ownership remain server-authoritative.
- Festival-owned schedule rows cannot be edited/deleted directly by normal browser roles.
- Existing non-Festival commitments are never silently cancelled to make Festival attendance fit.

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

Lifecycle/readiness projections reconcile authoritative state before use.

## RLS / security model

`festival_player_attendance` has RLS enabled.

Direct mutation privileges are revoked from `anon` and `authenticated` roles. Authenticated players receive their data through permission-checked read/command boundaries and the own-row RLS policy remains defence in depth.

Internal Festival scheduling helpers are not exposed as browser RPCs. Their `SECURITY DEFINER` execution is paired with fixed `search_path` and explicit execute revocation from `PUBLIC`, `anon`, and `authenticated`.

## Wristband and Festival Mode authority

A valid admission-backed attendee has one Festival wristband/memorabilia representation. Add-ons cannot create duplicates.

After authoritative check-in moves the lifecycle to `attending`, the reduced Festival Mode shell replaces normal desktop/mobile gameplay navigation while retaining essential Inbox, safety/reporting, privacy/blocking, and bug-report paths.

Refresh/reconnect rehydrates Festival Mode from authoritative attendee state. Leave, completion, cancellation or refund restore the normal shell and the captured return route.

## C4 scheduling and activity authority

A Festival commitment now affects scheduling before and after check-in.

### Commitment window

The states below reserve the edition's full Festival-local date window against **new** incompatible commitments:

```text
ticketed
ready_to_check_in
attending
```

The window is derived from `festival_editions_v2.starts_on` / `ends_on` in the Festival city's timezone. Terminal states no longer reserve future gameplay.

### Existing commitments before admission/check-in

Existing committed activities are preserved. They are not cancelled or rewritten when an admission is created.

Readiness/check-in evaluates both the shared schedule and authoritative domain records. An overlapping existing rehearsal, recording, gig or travel commitment therefore produces `schedule_conflict` and keeps the attendee out of check-in until the player resolves that commitment normally.

This also repairs a historic projection weakness: check-in cannot be fooled by an authoritative booking whose `player_scheduled_activities` projection is missing.

### New normal activities after commitment

New overlapping normal activity fails closed at the database boundary with:

```text
festival_attendance_schedule_locked
```

The authority is enforced at:

- `player_scheduled_activities` for generic schedule writes;
- `band_rehearsals` for rehearsal booking;
- `recording_sessions` for solo/band recording;
- `gigs` for band gig booking;
- `player_travel_history` for travel booking.

Band guards evaluate every active real non-touring member, including legacy leader identity resolution. A leader cannot create a band booking that silently conflicts with another active member's Festival commitment.

Rehearsal/recording guards execute as `BEFORE` triggers on the authoritative booking row. When their atomic finance RPC has already prepared/debited payment earlier in the same transaction, a Festival conflict raises before the booking row commits and PostgreSQL rolls the whole transaction back, including the debit.

### Allowed Festival-only overlap

The only allowed schedule overlap is:

- the server-owned `festival_attendance` reservation itself; or
- a `festival_performance` / `gig` schedule row whose metadata identifies the **same canonical Festival edition**.

Unrelated gigs or Festival rows for another edition are not exempt.

### Releasing locks

Festival-owned schedule reservations are released by the existing authoritative lifecycle boundaries:

- early leave → reservation cancelled;
- cancellation/refund → Festival reservation cancelled;
- natural event expiry/completion → reservation completed.

Normal pre-existing commitments remain untouched.

## Verification evidence

The C4 migration was parsed successfully against the connected live RockMundo PostgreSQL schema inside an explicit `BEGIN` / `ROLLBACK` verification transaction. No production schema or data changes were retained by that check.

Focused Vitest contract coverage verifies:

- pre-check-in commitment states;
- allowed Festival-only overlap;
- generic and domain booking guards;
- all-active-band-member checks;
- check-in fallback to authoritative domain commitments;
- atomic paid rehearsal/recording rollback positioning;
- terminal Festival lock release behaviour;
- internal function permission/search-path hardening.

## Production-state audit at introduction

At the time the original attendee foundation was introduced:

- there were no launched modern festivals in production;
- there were no modern ticket plans;
- there were no issued modern festival tickets;
- therefore no live attendee migration or reconciliation was required.

The original migration still contains an idempotent backfill so environments with existing valid admission tickets can safely create corresponding `ticketed` attendee rows.

## Frontend boundary

The frontend attendance domain remains behind the attendee repository/hooks rather than introducing direct table mutation.

The public festival page may show the active character's attendee lifecycle and ticket/wristband state. Buying extra add-ons must remain possible after becoming an attendee, so the attendee badge must not globally disable the ticket shop.

During `attending`, Festival Mode intentionally removes normal gameplay routes; database scheduling authority remains necessary because browser navigation is not a security/consistency boundary and pre-check-in commitments exist before Festival Mode starts.

## Known debt kept outside this slice

The current festival purchase/finance implementation has changed across festival migrations. Any remaining finance-ledger reconciliation belongs in the finance/festival sales stream rather than expanding attendee scheduling authority.

C4 deliberately does not implement day planning, attendee condition simulation, random/social events, or completion rewards.

## Next implementation slice

With C1–C4 complete, the next attendee slice is **C5 — Festival day planner and stage schedule**:

1. Build a persisted per-day attendee plan.
2. Let players select bands/stages and Festival-area activities.
3. Include walking/travel time between Festival areas.
4. Detect intra-Festival timetable conflicts.
5. Show trade-offs before the plan is committed.

Do not duplicate the normal RockMundo scheduler for internal Festival day planning; C4 owns the external whole-Festival reservation while C5 should own the feasible plan *inside* that reservation.
