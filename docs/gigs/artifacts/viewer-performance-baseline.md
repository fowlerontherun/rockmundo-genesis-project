# Living Venue Viewer — performance and rollout baseline

Recorded from the shipped code (`PerformanceProfile.resolveRenderBudget`) so the degradation
order is reviewable without a device lab. Regenerate after any change to render budgets and
re-check the numbers below.

## Render budgets (arena archetype, DPR 2, motion allowed)

| Tier | Displayed counters | DPR cap | Crowd detail | Particles | Service actors | Counter cap | Static cache | Applied degradations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| low | 200 | 1 | full | 24 | 18 | 48 | true | none |
| low | 1200 | 1 | full | 8 | 18 | 48 | true | ambient_particles |
| low | 4600 | 1 | aggregated | 8 | 9 | 48 | true | ambient_particles, background_movers, crowd_detail, service_detail |
| standard | 200 | 1.5 | full | 64 | 36 | 96 | true | none |
| standard | 1200 | 1.5 | full | 64 | 36 | 96 | true | none |
| standard | 4600 | 1 | reduced | 22 | 36 | 96 | true | ambient_particles, background_movers, crowd_detail |
| high | 200 | 2 | full | 120 | 56 | 160 | true | none |
| high | 1200 | 2 | full | 120 | 56 | 160 | true | none |
| high | 4600 | 2 | full | 42 | 56 | 160 | true | ambient_particles |

Degradation order is fixed and documented: ambient particles → background movers → crowd
detail → service detail → device pixel ratio. Static background and architecture layers are
cached per structural fingerprint at every tier, and the animation loop is fully suspended
while the document is hidden.

## Rollout ladder

`VITE_GIG_VIEWER_LIVING_VENUE_STAGE` drives the gate:

| Stage | Admin demo | Internal replays | Players |
| --- | --- | --- | --- |
| off | legacy | legacy | legacy |
| admin_demo | living venue | legacy | legacy |
| internal_replay | living venue | living venue | legacy |
| percentage | living venue | living venue | deterministic bucket < `VITE_GIG_VIEWER_LIVING_VENUE_PERCENTAGE` |
| default | living venue | living venue | living venue |

Buckets come from an FNV-1a hash of the gig id, so a subject never flips between sessions or
devices. `VITE_GIG_VIEWER_LEGACY_FALLBACK` keeps the prior stage-first renderer reachable for
one release after `default`. Resolved state is exposed on the canvas wrapper as
`data-living-venue`, `data-viewer-rollout-stage`, `data-viewer-rollout-reason` and
`data-viewer-rollout-bucket`.

## Evidence modes

| Mode | Trigger | Meaning |
| --- | --- | --- |
| ambient | no settlement commerce on the replay | activity is decorative only |
| aggregate | settlement totals present | counts honoured, timings inferred |
| event_replay | `commerce.events` present | saved timestamps and item types are authoritative |

Replay idempotency is proved by `computeReplayChecksum`, which hashes a canonical,
order-stable projection of the payload only — never signed URLs, costs, or ownership data.

## Automated gates

- `tests/performanceProfile.test.ts` — deterministic detail shedding
- `tests/viewerCapabilityFlags.test.ts` — rollout ladder and stable bucketing
- `tests/venueSignagePlan.test.ts` — signage determinism, safe bounds, reduced motion
- `tests/visualRegression.test.ts` — draw-call fingerprints per archetype
- `tests/replayChecksum.test.ts` — checksum idempotency and event_replay activity
- `tests/gigViewerControlsAccessibility.test.tsx` — keyboard-only control use
- `tests/viewerNoMutation.test.ts` — viewer surface writes nothing
