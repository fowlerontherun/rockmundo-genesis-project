# Living Venue Phase 0/1 baseline

This note records the focused verification and containment slice from the
[implementation plan](../LIVING_VENUE_VIEWER_IMPLEMENTATION_PLAN.md). It does not
implement the Phase 2 descriptor or redesign venue archetypes.

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
