## Next canonical booking task

After booking workspace completion, the next PR should be `feat(festivals): add canonical performance sessions and readiness`. That PR should add arrival, equipment, crew, soundcheck, health, locked-setlist consumption and performance-session lifecycle while leaving rewards and financial settlement for a later PR.

## Performance sessions and readiness

- [x] Add canonical performance-session tables, event stream and incident model.
- [x] Add idempotent session creation, check-in, readiness, soundcheck, stage-call, start, progression, cancellation and completion RPCs.
- [x] Add player session route, mobile-focused view, organiser controls shell and realtime invalidation hooks.
- [x] Add SQL harness and TypeScript unit coverage for transition, timing, readiness, progression, privacy and invalidation.
- [ ] Next: `feat(festivals): add audience simulation and performance outcomes`.


## Admin and edition management consolidation

PR #1201 consolidates admin and owner festival management onto canonical brands and dated editions. Legacy festival game events remain readable through compatibility mappings, while new creation, lifecycle, operations and migration actions use audited RPCs. The next PR should apply career effects and settle performance contracts using settlement readiness.

## 2029-12-12 operational completion update

The canonical edition operations PR completes the PR #1210 foundation by adding edition-scoped operational RPCs, deterministic operational backfill, migration issues, persistent system acts, persistent staff candidates, permit and insurance workflows, controlled ledger posting, data-health repairs, legacy migration apply, and expanded settlement readiness. Career effects and final financial settlement remain deferred to `feat(festivals): apply career effects and settle performance contracts`.

## Settlement PR

- Added canonical settlement lifecycle, effect applications, contract settlement instructions, reconciliation and final edition financial result storage.
- Next: `feat(festivals): add festival legacy history records awards and multi-year progression`.

## Stabilisation gate before further expansion

- [x] Stop unsafe edition-number-one operational backfills.
- [x] Remove universal USD ledger default for historical rows.
- [x] Add stage legacy-domain diagnostics and slot consistency enforcement.
- [x] Add frontend service validation for admin catalogue and owner workflows.
- [ ] Run the full Supabase reset and route smoke suite in an environment with the supported Supabase CLI.
