# Festival edition migration notes

## Backfill rules

Every existing `festivals` row receives an initial `festival_editions` row when one does not already exist for the same brand and edition number. The migration preserves brand dates, city, venue, expected attendance, description, treasury and metadata. Existing `ticket_price_low` and `ticket_price_high` are decimal currency units, while the new edition ticket fields are cents, so the backfill multiplies those prices by 100 and records the compatibility decision in `legacy_metadata`.

## Status mapping

Dedicated festival statuses verified in repository code and migrations are mapped conservatively:

- `draft`, `upcoming` → `planning`
- `confirmed` → `booking`
- `published`, `announced` → `announced`
- `live` → `live`
- `completed` → `completed`
- `postponed` → `postponed`
- `cancelled` → `cancelled`
- unknown values → `planning` with the original status retained in `legacy_metadata`

## Legacy event handling

The migration creates explicit `dedicated_festival_row` mappings for all backfilled editions. Legacy `game_events` rows are mapped only when the match is deterministic: festival event type, exact/normalised title match, compatible venue when present, and overlapping dates. Unmatched legacy festival events are left unmapped for the later data-migration PR rather than creating placeholder brands.

## Compatibility rules

`festivals` remains the permanent brand and marketplace asset. Brand-level staff, permits, insurance and ledger screens continue to operate until later edition re-keying. Current player festival routes backed by `game_events` and `festival_participants` remain active.

## Rollback strategy

This change is additive. Rollback can drop the three new tables, the enum, policies, indexes, triggers and RPCs without changing existing festival primary keys or deleting legacy festival data. Because backfill writes only new canonical tables and mappings, existing `festivals`, `game_events`, `festival_participants`, stages, tickets and attendance data remain intact.

## Next migration PR

Recommended next PR: `feat(festivals): add canonical applications contracts setlists and performances`.
