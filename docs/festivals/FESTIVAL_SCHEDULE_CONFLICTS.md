# Festival Schedule Conflicts

Server conflict detection is exposed through `festival_schedule_conflicts` and the workspace RPC.

## Implemented conflict codes
- `stage_overlap`: placed items overlap on the same stage.
- `outside_operating_hours`: item is outside stage/day hours or shutdown buffer.
- `invalid_duration`: duration is not positive.

## Planned policy checks
The schema supports future checks for soundcheck overlap, missing changeover, performer double-booking, travel-time gaps, duplicate headline slots, locked item modification, wrong-edition items and capacity-vs-demand warnings.

Conflict payloads include code, severity, item IDs, stage ID, festival date, message, suggested resolution and publication blocking status.
