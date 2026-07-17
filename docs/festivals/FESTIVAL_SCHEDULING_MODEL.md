# Festival Scheduling Model

Phase 2A uses the festival edition as the schedule boundary. A schedule item belongs to one festival, edition, revision, and either a placed stage/day/time or an unscheduled holding area.

## Tables
- `festival_schedule_revisions`: draft, review, published, locked and archived schedule revisions.
- `festival_schedule_items`: unified schedule item projection for performances, changeovers, soundchecks, hosts, DJ/intermissions, ceremonies, buffers, closures, maintenance and curfew boundaries.
- `festival_stage_operating_hours`: stage/day opening, curfew, closure, changeover, soundcheck and shutdown-buffer settings.
- `festival_schedule_audit_events`: successful persisted schedule operations.

`festival_stage_slots` remains the canonical booking slot table and can be linked from `festival_schedule_items.stage_slot_id` where a schedule item represents a bookable performance slot.

## Required item fields
Items expose IDs, festival/edition/stage/day ownership, type, start/end/duration, title/status, band/application/contract links, soundcheck and changeover fields, locked/public visibility, notes, version and creator/updater metadata.

## Time zone
`festival_editions.time_zone` is the source for deriving local festival dates and converting template local times into `timestamptz` values.
