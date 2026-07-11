# Phase 5 PR 11 — Live Gig Beta Release Gate and Verification Harness

## Recommendation source

This release gate follows `PHASE_5_REVIEW.md`, which marked Phase 5 complete with accepted limitations and beta-ready only after database, dependency-backed, browser, mobile, accessibility, and performance gates are executed.

## Toolchain audit

- Node: CI pins Node 20; local run used Node 20.20.2.
- Package manager: npm with `package-lock.json`; `bun.lock` is present but CI uses npm.
- Install: `npm ci --legacy-peer-deps`.
- Typecheck: `npm run typecheck`.
- Lint: `npm run lint`.
- Build: `npm run build`.
- Unit/component/viewer tests: `npm run test:gig-experience:unit`, `npm run test:gig-experience:replay`, `npm run test:gig-experience:viewer`, `npm run test:gig-experience:component`.
- Browser/accessibility surrogate: `npm run test:gig-experience:browser` and `npm run test:gig-experience:a11y` run deterministic jsdom/RTL coverage because scoped package installation for Playwright/axe was blocked by registry policy.
- Release gate: `npm run test:gig-experience:release` runs typecheck, lint, production build, unit/replay/viewer/component, and browser/a11y surrogate checks in order and exits at the first failure.
- Supabase: `npm run test:gig-experience:db` starts Supabase, resets from zero, lists migrations, and runs `supabase/tests/phase_5_live_gig_release_gate.sql`.
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` for app/runtime; tests provide safe defaults. `SUPABASE_DB_URL` may override the local DB URL for SQL harnesses.
- Secrets not to commit: service-role keys, JWTs, production DB URLs, Supabase access tokens, npm tokens.

## Dependency findings

`@react-three/fiber` is still used by avatar/stage systems and is not a stale Phase 5 dependency. It was not removed. A package-policy 403 blocked adding `@axe-core/playwright`, so this PR does not claim real Playwright/axe execution. The previous dependency blocker remains environmental rather than evidence that the three.js packages are unused.

## Commands added

- `npm run test:gig-experience:release`
- `npm run test:gig-experience:db`
- `npm run test:gig-experience:unit`
- `npm run test:gig-experience:replay`
- `npm run test:gig-experience:viewer`
- `npm run test:gig-experience:component`
- `npm run test:gig-experience:browser`
- `npm run test:gig-experience:a11y`

## Clean reset result

Skipped/tooling unavailable in this container: Supabase CLI was not installed. The new DB gate command is executable and performs `supabase start`, `supabase db reset`, migration status inspection, and the Phase 5 release SQL harness when the CLI is available.

## DB harness result

Added `supabase/tests/phase_5_live_gig_release_gate.sql`. It verifies required Phase 5 schema/RLS/RPC prerequisites: `result_ready_at`, song-position uniqueness, progression RPCs, replay table, replay policies, one-ready-replay index, payload/status/version constraints, generation recovery columns, grants, and `SECURITY DEFINER` `search_path` safety. Fixture-level RLS/progression rows remain a recommended expansion after clean seeded local DB execution.

## Unit, lint, and build result

The release gate now makes these checks repeatable. In this environment, dependency installation did not complete cleanly because scoped package fetches were blocked by registry policy, so dependency-backed lint/build/test results are not claimed as passed.

## Browser, mobile, accessibility, and reduced-motion coverage

A deterministic RTL/jsdom gate covers the completed replay flow, controls, keyboard-only path, fallback states, mobile viewport class/touch wrapping, reduced-motion switch, lifecycle open/close stress, semantic timeline state, speed selected state, Canvas companion text, performer/current-song/crowd graph presence, and result access in fallback states. It is a surrogate, not a real browser substitute.

## Performance and lifecycle findings

The new tests stress repeated open/play/close cycles and reduced-motion control behaviour. Real frame-rate, memory-retention, hidden-tab, and mobile-device profiling remain unmeasured in this container and must not be reported as passed.

## Security findings

Frontend replay service selects an explicit column list for replay reads and does not select `*`. Viewer controls are local-only and no replay component issues start/process/complete mutation calls. The DB harness verifies client roles cannot claim generation and service role can.

## Compatibility cleanup

No obsolete completed-viewer path was removed. `TopDownGigViewer`/live presentation remains out of scope and should stay until a separate in-progress viewer migration is designed.

## Defects found and fixed

- P1: No single executable Phase 5 release gate existed. Fixed by adding orchestrated npm scripts and CI.
- P1: No consolidated Phase 5 SQL release harness existed. Fixed by adding a schema/RLS/RPC harness.
- P1: No automated browser/mobile/a11y surrogate coverage existed. Fixed with deterministic RTL/jsdom release-gate tests while documenting the absence of real browser execution.

## Remaining failures

- Clean Supabase reset was not run here because Supabase CLI was unavailable.
- Real Playwright browser, mobile, axe, and performance profiling were not run because installing new scoped packages hit registry 403 policy.
- Dependency-backed full gates are not claimed passed until `npm ci --legacy-peer-deps` succeeds in CI or a provisioned local environment.

## Final Phase 5 status

Complete with accepted limitations.

## Final beta-readiness decision

Ready with prerequisites. The release gate is now executable, but beta cannot be declared ready until the real database, dependency-backed, browser, mobile, accessibility, and performance gates pass.

## Recommended next area

Run the new release gate in CI/provisioned infrastructure, resolve the registry policy for real Playwright + axe, then address any P0/P1 defects before beta.
