# Phase 5 PR 13 — Real Browser, Audio and Admin Demo Verification Gate

## Recommendation source

This gate follows the Phase 5 PR 10–12 implementation notes and the Phase 5 review recommendation to add real Playwright, axe, dependency-backed build/lint, browser audio, mobile, lifecycle, and Supabase verification before beta.

## Package/install findings

- Local toolchain observed: Node `v20.20.2`, npm `11.4.2`.
- Documented clean install command remains `npm ci --legacy-peer-deps` because the existing lockfile and dependency graph were previously validated with that compatibility mode.
- No committed `.npmrc` file was found. npm reads `http-proxy=http://proxy:8080` and `https-proxy=http://proxy:8080` from the execution environment.
- Previous registry `403`/install failures are best explained by environment-specific proxy/registry configuration, not repository-private registry configuration: committed lockfile URLs point at `https://registry.npmjs.org/`, and there is no committed custom registry.
- A direct no-proxy install attempt reached public npm but failed with DNS `EAI_AGAIN`; a proxied `npm ci --legacy-peer-deps` hung after proxy warnings. That points to environment/proxy instability rather than an unavailable package version or peer dependency conflict.

## Dependency repairs

- Added `@playwright/test` and `@axe-core/playwright` to dev dependencies.
- Added the corresponding Playwright/axe entries to the lockfile so CI can perform a deterministic clean install when registry access is healthy.

## Real-browser setup

- Added `playwright.config.ts` with deterministic `http://127.0.0.1:4173` base URL, production build + preview web server, Chromium coverage, mobile/tablet projects, reduced-motion project, failure screenshots, and retained traces on failure.
- Added `test:gig-experience:e2e`, `test:gig-experience:e2e:headed`, and real `test:gig-experience:a11y` scripts.
- The release gate now invokes Playwright and axe after the lower-level Vitest/jsdom coverage.

## Admin-demo coverage

- Expanded `/admin/gig-viewer-demo` fixture controls for preset, venue, attendance, band size/roles, setlist length, momentum, encore, audio preset, reduced motion, and device preview.
- Added deterministic fixture scenarios covering empty/sold-out venues, poor arena booking, solo/four-piece/large ensemble, rising/recovery momentum, encore states, no/mixed/all/failed audio, unsupported, malformed, and legacy-unavailable scenarios.
- Playwright admin tests verify page load, fixture control interaction, viewer/report launch paths, demo warning, real replay inspector metadata rendering, URL redaction, and no blocked mutation requests.

## Audio activation coverage

- Browser tests install a deterministic `Audio` shim to verify user activation through Enable Audio, 1× playback, mute/unmute, pause/resume, next/previous song cleanup, restart/result cleanup, close/reopen, and no overlapping active audio.

## Speed/seek coverage

- The Playwright lifecycle test verifies that 2× stops/mutes audio and exposes the normal-speed explanation before returning to 1× and switching songs.
- Existing unit coverage continues to exercise deterministic excerpt selection and bounds.

## Hidden-tab behaviour

- The implementation already pauses audio on `visibilitychange` when the document becomes hidden. This PR documents the browser automation limitation: the current Playwright suite does not force an actual OS-level hidden tab in this container, so hidden-tab behaviour remains covered by implementation review and lower-level lifecycle checks rather than a full browser visibility assertion.

## Lifecycle stress result

- Added browser lifecycle instrumentation for audio element creation/active state. The full 10-cycle stress loop is configured as part of the browser gate design, but local execution was blocked by dependency installation/tooling availability in this environment.

## Mobile coverage

- Added Playwright viewport coverage for `360×800`, `390×844`, `768×1024`, and desktop, with assertions against horizontal body overflow and visible viewer/audio controls.

## Accessibility result

- Added axe coverage for the admin demo, viewer playing/audio state, and result reveal state with a strict failure on serious or critical violations.
- Added keyboard-only flow coverage through preset selection, viewer launch, audio controls, speed controls, highlight/result/report/close actions.

## No-mutation verification

- Browser tests intercept frontend requests and fail on gig lifecycle, replay mutation/generation, reward, audio generation, song update, profile update, or outcome mutation calls during fixture playback.

## Supabase reset result and SQL harness result

- `npm run test:gig-experience:db` remains the authoritative Supabase gate and still starts Supabase, resets the database, lists migrations, and executes `supabase/tests/phase_5_live_gig_release_gate.sql`.
- Local execution was not completed because dependencies/Supabase tooling were unavailable in this container run.

## CI changes

- Hardened `.github/workflows/phase-5-live-gig-release-gate.yml` into separate frontend, browser/a11y, and database jobs with lockfile cache keys, timeouts, cancellation for superseded runs, Chromium installation, and Playwright artifact upload on failure.

## Defects found and fixed

- Severity: P1 beta-gate tooling gap. Reproduction: Phase 5 release script only ran Vitest browser surrogates, and `test:gig-experience:a11y` did not run axe. Root cause: no Playwright/axe dependencies, config, or scripts. Fix: added Playwright/axe dependencies, config, scripts, tests, release-gate invocation, and CI browser job. Test added: `tests/gig-experience/*.spec.ts`. Blocks beta until executed green in CI.
- Severity: P1 admin-demo verification gap. Reproduction: fixture page lacked explicit selectors/options for several PR 13 required scenarios. Root cause: compact PR 12 demo implementation. Fix: expanded deterministic controls and scenario names. Test added: admin demo Playwright coverage. Blocks beta until executed green in CI.

## Commands and outcomes

| Check | Outcome |
| --- | --- |
| `npm ci --legacy-peer-deps` | Tooling unavailable |
| `npm run typecheck` | Passed |
| `npm run lint` | Tooling unavailable |
| `npm run build` | Tooling unavailable |
| `npm run test:gig-experience:unit` | Skipped |
| `npm run test:gig-experience:viewer` | Skipped |
| `npm run test:gig-experience:audio` | Tooling unavailable |
| `npm run test:gig-experience:component` | Skipped |
| `npm run test:gig-experience:browser` | Skipped |
| `npm run test:gig-experience:e2e` | Tooling unavailable |
| `npm run test:gig-experience:a11y` | Skipped |
| `supabase start` | Skipped |
| `supabase db reset` | Skipped |
| SQL harness | Skipped |
| `npm run test:gig-experience:release` | Failed |

## Final beta-readiness decision

Phase status: Not complete.

Beta readiness: Not ready.

Reason: the real browser, axe, clean install, and Supabase gates are now wired but were not executed successfully in this environment. PR 13 does not accept skipped P0 checks as passed.

## Recommended next area

Run the hardened CI gate in an environment with healthy npm registry/proxy access, Playwright browser installation, Supabase CLI, Docker, and `psql`; then fix any concrete browser, axe, or SQL failures surfaced by that execution.
