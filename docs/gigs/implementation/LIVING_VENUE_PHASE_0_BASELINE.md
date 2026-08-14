# Living Venue Phase 0/1 baseline

This note records the focused baseline/containment slice described by
[`LIVING_VENUE_VIEWER_IMPLEMENTATION_PLAN.md`](../LIVING_VENUE_VIEWER_IMPLEMENTATION_PLAN.md).
It is intentionally not a Phase 2 venue-layout redesign.

## Status matrix

| Contract | Status | Source and executable evidence |
| --- | --- | --- |
| 1280×720 authoring space and contain fit | Implemented | `viewer/engine/SceneLayout.ts`; `viewer/tests/sceneLayout.test.ts` |
| Flex-viewport sizing and four safe-area edges | Implemented | `viewer/hooks/useCanvasSize.ts`; `viewer/PlayerGigStageSurface.tsx`; `viewer/GigViewerShell.tsx` |
| Fixed-overlay fullscreen with optional native enhancement | Implemented | `viewer/GigViewerShell.tsx`; `viewer/tests/browser/gigReplayBrowserGate.test.tsx` |
| Wide/focus/auto camera preference and safe bounds | Implemented | `viewer/engine/CameraDirector.ts`; `viewer/hooks/useGigViewerPreferences.ts`; `viewer/tests/cameraDirector.test.ts` |
| Stable non-sensitive diagnostics | Implemented | `viewer/engine/ViewerDiagnostics.ts`; `viewer/tests/viewerDiagnostics.test.ts` |
| Typed performance tiers and budgets | Implemented as contract; renderer degradation deferred | `viewer/engine/ViewerDiagnostics.ts`; `viewer/tests/viewerDiagnostics.test.ts` |
| Environment fixture inputs | Implemented | `pages/admin/GigViewerDemo.tsx`; `viewer/tests/environmentRegistry.test.ts` |
| Phase 1 foreground/label-safe rectangles | Partial (foreground bounds exist; label reservations remain later work) | `viewer/engine/VenueSceneRegistry.ts` |
| Phase 2 descriptor/layout redesign | Missing by design | Deferred to the next PR |

## Viewport containment evidence

The Admin Demo exposes real `360×800`, `390×844`, `768×1024`, `1366×768`, and
`1920×1080` preview boxes. `ResizeObserver` measures the flex viewport remaining
after song information and independently scrolling controls. `containScene()` then
uses the smaller axis ratio, so the logical scene can letterbox but cannot crop.
Fullscreen uses a fixed `inset-0`, `100dvh` overlay and applies top, right, bottom,
and left safe-area insets. Browser-native fullscreen is optional enhancement.

## Counters and frame-time baseline

The representative crowd remains capped by `RepresentativeCrowd.ts`; diagnostics
publish the resolved count without attendee or ownership data. Tier budgets are:

| Tier | Counters | Ambience voices | Particles | Background movers |
| --- | ---: | ---: | ---: | ---: |
| low | 48 | 1 | 24 | 2 |
| standard | 96 | 2 | 64 | 5 |
| high | 160 | 3 | 120 | 8 |

No renderer-degradation rewrite is made in this slice. Automated frame-time
instrumentation is still missing, so no measured FPS/frame-time claim is made.
Existing rendering owns one replay clock and remains timestamp-derived.

## Known blockers and pre-existing failures

On 2026-08-14, dependency installation was attempted with repository Node 20
but the available npm executable was 11.4.2 rather than the pinned 10.9.2.
`npm ci` was blocked by an external HTTP 403 fetching
`@lovable.dev/vite-plugin-dev-server-bridge`; no manifest or lockfile mismatch was
reported before that registry failure. Checks that require an installed dependency
tree must be reported as not run rather than passed.

## Recommended next PR

Begin the plan's Phase 2 descriptor validation as a separate PR: version the
descriptor, validate normalized camera/path/queue bounds, and make the three
pub/club/theatre variations materially distinct. Do not combine that work with
schema, commerce-authority, or renderer-timing changes.
