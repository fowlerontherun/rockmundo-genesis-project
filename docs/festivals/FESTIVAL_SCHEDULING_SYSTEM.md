# Authoritative annual-edition scheduling

## Canonical ownership

`festival_stages` and `festival_stage_slots` remain the canonical operational tables; this change does not introduce a third stage or slot model. Every active row is edition scoped. `festival_schedule_revisions` and `festival_schedule_items` provide the immutable publication snapshot/draft layer. Legacy event identifiers are compatibility inputs only and are resolved through `festival_legacy_mappings` before a mutation.

## Authority boundary

Browsers may read RLS-filtered stage and slot projections, but cannot insert, update, or delete stages, slots, schedule items, or revisions. All active mutations use authenticated `SECURITY DEFINER` RPCs with a fixed `search_path`. The old owner console is temporarily supported by `legacy_festival_*` RPC adapters; these resolve the edition and then apply server permissions, locking, idempotency and audit evidence. They are classified `legacy_rpc` and must be removed with the old owner route.

## Stage limits and configuration

Stage creation is edition locked and delegated to `create_festival_edition_stage`. Licence/upgrades remain the source for authoritative limits; clients must render the returned preview rather than calculate a maximum. Stages carry stable keys, capability/quality, accessibility, operating defaults, manager, lifecycle status, version and migration provenance. Published/completed stages are archived rather than deleted.

## Slot occupancy and soundchecks

A slot distinguishes `setup_start`, `performance_start`, `performance_end`, and `clearance_end`. Conflict checks use `[setup_start, clearance_end)`; public views use only performance timestamps. A GiST exclusion constraint prevents concurrent occupancy overlap on the same stage. Soundchecks are private schedule items linked to the same stage, edition, artist and contract and participate in stage/member conflict validation.

## Contracts, conflicts and reservations

Real artist assignment requires one active contract for the same edition and band. The contract and slot are locked together and a contract cannot be assigned twice. Canonical activity reservations link edition, slot, contract, band and required members; retries reuse their idempotency key, while moves/unassignments update or remove the same reservation. Conflict errors return stable codes and structured member/activity intervals. NPC fallback is allowed only on an empty slot and is auditable and deterministic.

## Drafts, publication and reads

Schedule lifecycle is `draft`, `review`, `published`, `locked`, and `completed`. Publication captures stage and slot snapshots, validation, change summary, previous revision and digest. Published snapshots are immutable; later edits fork a draft. Public readers receive only the latest published revision and never receive soundchecks, contracts, notes, staff, or travel. Artists receive only their contracted private schedule. Stage managers receive their stage's operational projection and cannot publish or edit contracts/finance.

## Legacy and migration

Migration provenance records source table/id, canonical edition/stage/slot, confidence, timestamp and migration version. Completed history remains read-only; ambiguous active mappings are flagged for admin repair and never receive invented contract terms. `FestivalBookingCalendar`, performance sessions and event-backed schedules are compatibility reads/redirects, not writers.

## Harness results

The disposable scheduling harness is `scripts/festivals/run-scheduling-db-gate.sh`. It refuses any database unless both the repository safety check and `FESTIVAL_TEST_DATABASE_DISPOSABLE=true` confirm disposal. Database results must be recorded from an actual reset database; a refusal is not a pass.
