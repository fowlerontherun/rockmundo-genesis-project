# Festival Phase 2A Scheduling Audit

## Current tables and RPCs
- `festival_stages` is the canonical edition-owned stage table. Recent hardening adds edition ownership, stage capability metadata, curfew/changeover defaults, archive flags, and management policies.
- `festival_stage_slots` is the canonical legacy performance-slot table. It already stores `festival_id`, `edition_id`, `stage_id`, `start_time`, `end_time`, `slot_type`, `public_status`, soundcheck/changeover metadata, reservation metadata, system-act flags, contract links, archive fields, and idempotency keys.
- Existing RPCs include `create_festival_edition_stage`, `generate_festival_stage_slots`, slot update/archive operations, booking workspaces, edition operations summaries, and public lineup projections.

## Data ownership
Festival editions own stages, slots, staff, permits, insurance, finance, contracts, applications, sessions and outcomes. Stage slots are edition scoped after Phase 1 hardening and must match their stage edition.

## Existing slot types and date handling
Existing generated slots use `slot_type` values such as opener, support, headline and DJ/intermission-like blocks. Times are stored as `timestamptz`. Previous generation accepted a local date/time input but did not expose a full revisioned local festival-day model.

## Constraints and admin UI
Slot consistency triggers prevent mismatched stage/edition/festival ownership and overlapping active slots. The existing admin UI combines stage configuration and slot generation in `FestivalStageManagement` and `FestivalStageSchedule`, so it is useful for stage operations but is not a complete visual scheduling workspace.

## Legacy or duplicate implementations
Older public lineup and performance-session records reference `festival_stage_slots`. They remain consumers of scheduled performance slots. Phase 2A adds a revisioned schedule-item layer rather than replacing booking/session records.

## Migration risks
- Published schedule edits need history; editing only `festival_stage_slots` in place is unsafe.
- Existing overlap triggers are too strict for draft revisions unless schedule items are separate from legacy slots.
- Local festival dates must not be inferred from UTC dates.
- Public projections must exclude draft revisions and internal notes.

## Reusable functionality
Stage creation, stage permissions, slot generation concepts, idempotency patterns, operations summaries, and audit conventions are reused.

## Missing functionality addressed by Phase 2A
Revision state, public/draft separation, unified schedule items, operating hours per stage/day, templates, conflict/readiness projections, unscheduled items, visual desktop/mobile schedule UI, publication workflow, and public-safe schedule projection.
