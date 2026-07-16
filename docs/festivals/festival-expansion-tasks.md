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
