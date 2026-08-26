# F1 — Living Venue phases 0–3 closure audit

_Audited: 2026-08-26_

## Decision

Programme F1 is **COMPLETE**. The current repository has moved materially beyond the old Phase 0/1 baseline note: every F1 acceptance item is implemented in the shared player/admin viewer path and has executable contract coverage. No evidence-backed Phase 0–3 implementation gap remains, so F2 does not need a corrective code slice for this scope.

This is a closure audit only. It does not change the renderer, replay schema, gig outcomes, commerce, inventory, settlement, rewards, finance, or database state.

## F1 status matrix

| F1 contract | Status | Current implementation evidence | Executable evidence |
| --- | --- | --- | --- |
| Contain-fit at required viewport sizes | **IMPLEMENTED** | `viewer/engine/SceneLayout.ts`; `viewer/hooks/useCanvasSize.ts`; `viewer/GigCanvas.tsx`; Admin demo exposes the five canonical device frames | `viewer/tests/sceneLayout.test.ts`; `viewer/tests/browser/gigReplayBrowserGate.test.tsx` |
| Venue Wide / Stage Focus / Auto camera modes | **IMPLEMENTED** | `viewer/engine/CameraDirector.ts`; `viewer/GigViewerShell.tsx`; persisted viewer preference; `GigCanvas` passes the selected mode to the production renderer | `viewer/tests/cameraDirector.test.ts`; browser gate verifies the player camera controls and persisted selection |
| Seven venue archetypes and deterministic variations | **IMPLEMENTED** | `viewer/engine/VenueSceneRegistry.ts` defines pub, club, theatre, arena, stadium, festival and beach, three descriptors each, descriptor v2 and namespaced deterministic seeds | `viewer/tests/venueSceneRegistry.test.ts` validates all 21 descriptors, distinct fingerprints and deterministic resolution |
| Path graphs and service-point reachability | **IMPLEMENTED** | `VenueSceneDescriptor.routes`, distributed `bars`/`merchandiseStands`, approach/return route IDs, queues and staff positions | `venueSceneRegistry.test.ts` verifies every service route and validation failures; `venueActivity.test.ts` rejects missing/invalid routes safely |
| Deterministic representative crowd caps | **IMPLEMENTED** | `viewer/engine/RepresentativeCrowd.ts`; diagnostics expose the representative count; render budgets cap/degrade detail without attendee-scale simulation | `viewer/tests/representativeCrowd.test.ts`; `viewer/tests/performanceProfile.test.ts` |
| Bar activity | **IMPLEMENTED** | `viewer/engine/VenueActivity.ts` derives timestamp-based bar visits from ambient, aggregate or saved-event evidence and distributed stations | `viewer/tests/venueActivity.test.ts` covers deterministic visits, bar routing and service states |
| Merchandise activity | **IMPLEMENTED** | Same activity projection consumes immutable merchandise lines/events and maps safe carried-item visuals without posting sales | `venueActivity.test.ts`; `viewer/tests/replayChecksum.test.ts`; `viewer/tests/viewerNoMutation.test.ts` |
| Staff queues/service loops | **IMPLEMENTED** | Stable staff plans per service point; deterministic serving/restocking state derived from replay time | `venueActivity.test.ts` covers staff bounds, movement, restocking and customer handover assignment |
| Seek / restart / 2× / Fast reconstruction | **IMPLEMENTED** | Activity and camera state are pure functions of replay timestamp/input; no frame-count or timer authority | `venueActivity.test.ts` explicitly reconstructs pause, speed, seek and restart states; camera tests prove timestamp-derived direction |
| Reduced Motion equivalents | **IMPLEMENTED** | Camera snaps/stays stable; route sampling snaps between authored points; later environment/signage/performance layers also consume Reduced Motion | `cameraDirector.test.ts`; `sceneLayout.test.ts`; `venueActivity.test.ts`; accessibility/browser gates |
| Admin demo / player renderer parity | **IMPLEMENTED** | `src/pages/admin/GigViewerDemo.tsx` imports and renders the production `GigViewerShell`; both flow through `GigCanvas` → `CanvasRenderer`; demo controls alter fixtures/preferences rather than a renderer fork | browser gate exercises `GigViewerShell`; `viewerNoMutation.test.ts` scans the shared viewer surface |

## Phase-by-phase closure

### Phase 0 — baseline and executable contracts

**Implemented.** Stable diagnostics are exposed from `GigCanvas` for camera, archetype, variation, descriptor version/fingerprint, seed, representative crowd, evidence mode, performance tier and rollout state. The dependency tree is now installable in GitHub Actions, unlike the historical baseline note. Current CI reaches TypeScript checking after a successful dependency-lock check, `npm ci`, and dependency-tree verification.

The repository also contains focused viewer commands in `package.json` (`test:gig-experience:viewer`, component/browser, accessibility, release and DB gates), so Phase 0 is no longer blocked by the historical missing-dependency state.

### Phase 1 — wide scene and camera modes

**Implemented.** The production canvas uses contain-fit sizing, Venue Wide is the default, Stage Focus and Auto are available from the shared controls, and Reduced Motion produces stable/snap camera behaviour. The admin demo supplies the canonical 360×800, 390×844, 768×1024, 1366×768 and 1920×1080 fixtures through the same shell.

### Phase 2 — venue descriptor/layout system

**Implemented.** Descriptor version 2 now covers all seven archetypes, three deterministic variations each. The earlier Phase 2A small-venue work has been followed by Phase 2B large-venue layouts: arena/stadium/festival/beach have authored structural variation, distributed services, capacity bands, route graphs, queue/staff points and validation. All 21 checked-in descriptors are asserted valid and variation fingerprints are tested.

### Phase 3 — deterministic bar and merchandise activity

**Implemented.** `VenueActivity` prefers distributed service points, derives demand and visits from replay time, supports ambient/aggregate/event-replay evidence, preserves a minimum watching crowd, returns fans to seeded alternate crowd positions, and derives staff serving/restocking loops without timers. Seeking, restart and playback-speed changes reconstruct state from the target timestamp instead of replaying side effects. Reduced Motion uses snap positions. The no-mutation gate protects the viewer boundary.

## Later-phase preservation check

F1 deliberately leaves later shipped work untouched. The implementation plan already records the following later closures and the current code still exposes them: deterministic environment packs; canonical commerce evidence inspector and replay checksum; ambience buses; performance tiers; static-layer caching; DPR caps and degradation order; quality preference; hidden-tab pause; keyboard accessibility; no-mutation gates; capability rollout and legacy fallback; animated signage; and visual-regression fingerprints.

## Verification caveat outside F1

The current stacked branch inherits a repository-wide TypeScript gate failure from unrelated areas (`FMSidebar`, festival attendance/moments, relationships API and equipment store). GitHub Actions successfully completes dependency installation before reaching those errors. None of the reported errors is under `src/features/gig-experience/viewer`, and this audit does not relabel the repository-wide CI run as green.

## Follow-up decision

No F2 implementation ticket is created from this audit because no Phase 0–3 product gap is evidenced. Future Gig Viewer work should be driven by a newly reproduced defect, measurable performance/accessibility regression, or a new product requirement rather than reopening the historical Living Venue checklist.
