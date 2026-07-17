# Festival Admin Recovery Plan

## Why the admin interface is being simplified

Festival administration had drifted into multiple competing admin pages, duplicate catalogue tabs, manual database UUID entry, and technical support tooling shown as normal admin workflow. Phase 0 (completed) stabilises the current canonical implementation without restoring legacy `game_events` writes or rebuilding festival creation.

## Canonical page and routes

`src/pages/admin/FestivalsAdmin.tsx` is now the canonical festival administration page. The single primary destination is:

- `/admin/festivals`

Legacy or duplicate routes redirect to `/admin/festivals`:

- `/admin/city-festivals`
- `/admin/festival`
- `/admin/festival-admin`

Admin navigation should link directly to `/admin/festivals`.

## New tab structure

The visible top-level tabs are:

1. **Overview** - festival catalogue, selected festival summary, selected edition summary, lifecycle status, dates, city, stage count, confirmed-band count, and system-check warnings.
2. **Applications** - pending and reviewed application queues with accept/reject actions, offered payment, admin notes, and existing review functionality.
3. **Operations** - edition-specific stages, staff, permits, insurance, and live-event tools behind secondary navigation.
4. **Results** - outcomes and settlement for the selected edition.
5. **Advanced** - legacy records, system checks, and audit logs with a warning that these are technical support tools.

## Festival and edition selection

Administrators select a festival from the canonical catalogue. Once a festival is selected, its editions are loaded through existing authorised festival management services. The page automatically selects the most relevant available edition in this order:

1. Live edition.
2. Upcoming/planning edition.
3. Most recently completed edition.
4. First available edition.

Administrators no longer paste a festival edition UUID. When a festival has no edition, the UI displays `No edition has been created for this festival.` and the `Create first edition` action opens the guided edition setup workflow.

## Retained functionality

- Canonical festival catalogue and management links.
- Application review queue, history, accept/reject actions, offered payment, and admin notes.
- Edition-scoped operational tools for stages, staff, permits, insurance, live operation, outcomes, and settlement.
- Legacy records, system checks, and audit log access in Advanced.

## Completed Phase 1 functionality

- New festival creation.
- New first-edition creation.
- Guided festival creation wizard.
- Transactional canonical RPCs without restoring legacy `game_events` festival writes.

## Planned next phases

- **Phase 1 (completed by this PR):** Restore festival creation and first-edition setup.
- **Phase 2:** Unified stage, slot, lineup and application management.
- **Phase 3:** Commercial, staffing and operating decisions.
- **Phase 4:** Live festival execution and outcomes.

## Phase 1 hardening update

Festival creation now relies on server-projected reference data, server-authoritative edition numbering, authenticated actor idempotency, lifecycle/audit writes in the aggregate transaction, and explicit stage festival/edition consistency. Phase 1 is not considered fully verified unless frontend checks and the executable SQL harness pass in the target environment.

## Phase 1.1 deployment correction note

Phase 1 hardening is considered verified only after the new forward migration is applied and the executable checks pass. The forward migration preserves historical request rows, backfills actor identity from profiles where deterministic, enforces server creation modes, removes nested public creation for first editions, and requires one external idempotency request row per operation.

## Phase 2A scheduling recovery notes
If a schedule workspace fails to load, verify `festival_schedule_revisions`, `festival_schedule_items`, `festival_stage_operating_hours`, and `festival_edition_schedule_workspace`. Published public schedules should be recovered from the latest `published` revision; draft revisions may be discarded without affecting public output.
