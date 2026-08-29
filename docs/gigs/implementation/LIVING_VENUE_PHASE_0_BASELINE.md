# Living Venue Phase 0/1 baseline

This note records the focused verification and containment slice from the
[implementation plan](../LIVING_VENUE_VIEWER_IMPLEMENTATION_PLAN.md). It does not
implement the Phase 2 descriptor or redesign venue archetypes.

> Historical baseline: this file records the state of the original Phase 0/1
> slice. The dependency-pending, partial, and missing labels below are superseded
> by the evidence-backed [F1 closure audit](../LIVING_VENUE_VIEWER_IMPLEMENTATION_PLAN.md#f1-closure-audit-2026-08-29),
> which verified phases 0–3 complete on 2026-08-29.

## Status matrix

| Contract | Status | Executable evidence |
| --- | --- | --- |
| 1280×720 authoring space and contain fit | Implemented; local rerun pending dependency access | `viewer/engine/SceneLayout.ts`; `viewer/tests/sceneLayout.test.ts` |
| Exact five-size demo frames and horizontal scroll | Hardened; component rerun pending | `pages/admin/GigViewerDemo.tsx` |
| Fixed-overlay fullscreen with optional native enhancement | Hardened; browser rerun pending | `viewer/GigViewerShell.tsx`; `viewer/tests/browser/gigReplayBrowserGate.test.tsx` |
| Wide/focus/auto camera and safe bounds | Hardened; unit rerun pending | `viewer/engine/CameraDirector.ts`; `viewer/tests/cameraDirector.test.ts` |
| Authoritative zero attendance | Hardened; unit rerun pending | `viewer/engine/AuthoritativeMetric.ts`; `viewer/tests/authoritativeMetric.test.ts`; `viewer/tests/viewerDiagnostics.test.ts` |
| Stable non-sensitive diagnostics and tier budgets | Implemented; unit rerun pending | `viewer/engine/ViewerDiagnostics.ts`; `viewer/tests/viewerDiagnostics.test.ts` |
| Environment fixture inputs | Implemented; unit rerun pending | `pages/admin/GigViewerDemo.tsx`; `viewer/tests/environmentRegistry.test.ts` |
| Phase 1 label-safe reservations | Partial | Foreground bounds exist; label reservations remain incomplete |
| Phase 2 descriptor/layout redesign | Missing by design | Deferred to Phase 2A |

## Containment and measurement contracts

The device preview is a responsive horizontal scrollport around a fixed border-box
frame. The inner frame is not `max-width` constrained and uses exactly 360×800,
390×844, 768×1024, 1366×768, or 1920×1080 CSS pixels. `containScene()` uses the
smaller axis ratio, so the 1280×720 logical scene letterboxes rather than crops.

Camera safe bounds are authored in normalized layout coordinates and converted to
the renderer's logical pixel space. Venue Wide remains the complete scene. Stage
Focus uses the bounding union of the stage and the intended front 42% of the crowd,
so asymmetric geometry affects both axes. Auto and Stage Focus clamp their visible
rectangles to the resolved safe bounds. Resolution remains a pure function of the
replay timestamp and inputs.

The plan's “stage occupies 40–50% of useful scene area” is measured as stage area
divided by the area of that stage/front-crowd bounding union
(`stageUsefulAreaRatio`). This is an executable geometry measurement, not a visual
assertion. Existing archetype geometry outside that target remains Phase 2A work;
this PR intentionally does not redesign layouts.

Fullscreen always uses the fixed `inset-0` overlay; native fullscreen is an optional
enhancement requested after React commits the presentation host. Browser-native
exit synchronizes overlay state, Escape and the button exit it, cleanup requests
native exit, and body scroll restoration remains effect-owned.

## Data authority

`resolveNumericMetric()` distinguishes an available finite non-negative value
(including zero), a missing metric, and malformed available data. An authoritative
attendance of zero produces zero representative fans. Since activity actors are
capped by the displayed crowd, it also produces zero fan service visits. Only a
missing attendance metric may use available capacity; invalid values do not invent
a replacement. Positive attendance and deterministic seed namespaces are unchanged.
No replay schema, finance, commerce, reward, audio, or canonical gig outcome code
changed.

## Dependency-lock evidence

PR #1507's GitHub Actions jobs failed at `npm ci` with `EUSAGE`: `package.json`
declared `@lovable.dev/vite-plugin-dev-server-bridge` and
`@lovable.dev/vite-plugin-hmr-gate`, while the root lock entries and dependency
trees were absent. Typecheck, lint, unit, build, browser, and accessibility steps
therefore never ran. The earlier npm 11/external-403 description was incorrect.

Repository search found neither package imported by Vite nor any other build or
development configuration. This PR intentionally removes both unused declarations.
The lockfile already omitted them, so no dependency versions were upgraded or lock
records hand-edited. In this checkout, `npm ci` passed the former manifest/lock
`EUSAGE` point and then failed unchanged with:
`E403 403 Forbidden - GET https://registry.npmjs.org/cssstyle`. Downloading npm
10.9.2 similarly returned `E403`. Dependency-backed checks are consequently **not
run locally**, rather than being mislabeled green.

The targeted viewer command now includes the complete `viewer/tests` tree and audio
source resolver, covering scene layout, venue registry, camera, environment,
representative crowd, diagnostics, and browser-surrogate contracts.

## Performance and visual evidence

The renderer still owns one replay clock. No FPS threshold or new timing authority
was added. Frame-cost measurement and the five production-shell/fullscreen
screenshots could not be captured without an installed dependency tree, so no
measurement or evidence image is represented as completed in this checkout. These
remain required before the draft PR can be promoted from draft.

## Next feature PR

Only after this verification PR is green, Phase 2A should add versioned descriptor
validation plus materially distinct pub, club, and theatre layouts. It must remain
separate from replay-schema, commerce-authority, and renderer-clock changes.

## Stage View closure (2026-08-14)

The local presentation compatibility boundary now reserves the complete saved
setlist before considering unmatched performance rows, gives unknown legacy
performance items stable row-and-position identities, bounds presentation-only
message parameters, and retains typed replay-build diagnostics. Viewer contract
repairs cover the medium fallback for missing capacity, deterministic distribution
across two and three entrances, the representative-crowd minimum, the calculated
Story Engine peak boundary, and the current **Setlist timeline** accessible name.
The component gate also exercises the real local builder through
`LiveGigStageView` and proves its input remains unchanged.

No canonical gig, outcome, scoring, settlement, reward, finance, commerce,
inventory, or replay-storage mutation path changed. No database data is rewritten.
This slice does not introduce or redesign venue descriptors.

The existing dependency tree is unavailable in this checkout (`vitest: not found`),
and dependency installation/lock work was explicitly out of scope. Consequently,
the four targeted Vitest commands and focused ESLint could not execute. The
TypeScript command was attempted and stopped before application checking with
`TS2688: Cannot find type definition file for 'vitest/globals'`; it therefore did
not reach the known unrelated `src/components/releases/MyReleasesTab.tsx:70:79`
`TS2345` baseline. `git diff --check` passed.

The next PR is **Phase 2A: versioned descriptor validation plus materially distinct
pub, club, and theatre layouts**.

## Final gate-closure attempt (2026-08-14)

The dependency lock was regenerated as a complete npm resolution (not by adding
transitive records by hand) after removing `node_modules`, using
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund --offline`.
The resulting diff replaces the incompatible jsdom 25 subtree, including cssstyle
4, data-urls 5, http-proxy-agent 7, tough-cookie 5, rrweb-cssom 0.7, and their
nested dependencies. The lock-only integrity diagnostic now reads only
`package.json` and `package-lock.json`; it passed before installation and its
mutation check proves a removed jsdom dependency is detected.

The requested npm 10.9.2 download and registry-backed clean install were blocked
by the execution environment's registry policy (`E403` for npm 10.9.2, followed
by `ENOTCACHED` for zustand when testing the generated lock offline). This checkout
has no authenticated GitHub remote, so the prescribed temporary Actions-artifact
fallback could not be pushed from this environment. Accordingly, `npm ci` and all
dependency-backed verification commands remain **not passed** here; no screenshot,
native-fullscreen capture, frame-cost result, or Actions-run URL is claimed.

| Command/evidence | Result in this environment |
| --- | --- |
| `node -v` | Pass: `v20.20.2` |
| `npx --yes npm@10.9.2 --version` | Blocked: registry `E403` |
| `npm run verify:dependency-lock` (before install) | Pass: 3/3 |
| `npm ci --ignore-scripts --no-audit --no-fund --offline` | Blocked: `ENOTCACHED` for zustand 5.0.8 |
| post-install dependency, type, lint, unit, browser, accessibility, and build gates | Not run because clean install did not complete |
| five device screenshots and fullscreen evidence | Not captured |
| renderer frame-cost sample | Not measured |
| GitHub Actions | Not available from this unauthenticated checkout |

The deterministic geometry assertion remains approximately `0.6047` for its
current fixture, outside the plan's 0.40–0.50 target. Per-archetype/per-variation
measurements remain pending a successful install and test execution; this Phase 1
exit gate is explicitly **not passed**. Geometry correction remains Phase 2 work.
The attendance, camera, and fullscreen changes are presentation-only and do not
change replay schemas or canonical gameplay, settlement, commerce, inventory,
rewards, finance, or audio authority.

## Phase 2A — versioned small-venue descriptors (2026-08-14)

Phase 2A promotes the living-venue layout to immutable, JSON-only descriptor
version `2`. Layout selection is namespaced `layout-v2`; decoration structure is
namespaced `decor-v2`. The singular active `bar` and `merchandise` fixtures remain
intentionally intact so the Phase 3 activity projection and canonical commerce
boundary do not change.

The registry now holds three deliberately authored pub, club, and theatre rooms.
Their stage widths in normalized useful-scene coordinates are, respectively:

- pub: `0.46`, `0.49`, `0.45`;
- club: `0.48`, `0.47`, `0.46`;
- theatre: `0.48`, `0.49`, `0.46`.

This is 40–50% of useful scene width for all nine layouts. Pub variants change the
room frontage, window/toilet/poster/table arrangement and side-bar relationship;
club variants change stage orientation, dancefloor, booths, rig and security
position; theatre variants change proscenium placement, curtain, stalls, balcony,
and separated aisle treatment. These structural differences are covered by
geometry/kind signatures rather than image snapshots.

`validateVenueSceneDescriptor` reports stable error codes for non-finite or
out-of-scene geometry, non-positive rectangles, unsafe UI/stage overlap,
stage/crowd and fixture/stage overlap, off-stage performer anchors, invalid queues,
short or stage-crossing routes, incorrect route endpoints, missing/invalid crowd
return anchors, duplicate IDs, and unreadable stages. Runtime external candidates
fall back deterministically to club variation 1, while tests validate all 21
checked-in descriptors directly so registry defects cannot be hidden by fallback.

Each descriptor exposes an identifier-free `venue-v2-*` structural fingerprint
computed from canonical descriptor structure and decoration choices. It is stable
across rendering state and viewport changes and differs between the nine authored
small layouts. The prior `scene-v1-*` `seedFingerprint` diagnostic remains for
compatibility, while descriptor version, variation, and structural fingerprint
have dedicated DOM diagnostics. The demo's nine named small-venue choices use a
production resolution helper that guarantees the requested variation rather than
assuming arbitrary A/B/C seeds.

Phase 2B remains responsible for redesigning arena, stadium, festival, and beach;
service-point arrays and capacity scaling; distributed concourse services; full
route/path graphs; and large-venue visual expansion. Their existing geometry and
singular service model are preserved in this slice.

Verification note: `npx tsc --noEmit --pretty false` completed successfully. The
focused Vitest command was attempted but collected zero tests because the existing
installed dependency tree lacks the transitive `redent` package required by
`@testing-library/jest-dom`. An attempted `npx tsx` static check was also blocked
by registry policy (`E403`). A local `vite-node` registry-validator audit did run
without installation and confirmed all 21 descriptors valid after authoring. No
blocked test is represented as passing.
