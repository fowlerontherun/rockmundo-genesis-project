# Avatar V2 Phase 2 — face and customisation acceptance

Status: **in progress — not production certified**. This document is a sign-off checklist, not evidence that source assets have been authored. Keep V1 fallback and the V2 rollout flag unchanged.

## Required source deliverables (each masculine and feminine frame)
- Editable face/head scene with facial surface binding, close-up skin, eye, eyelid, lip, brow and hairline maps and source provenance.
- Independent eyelid blink, gaze, jaw, brow and mouth controls; phoneme/viseme poses for singing and natural transitions between expressions.
- Author-tested face and body morph extremes with no eye penetration, jaw tearing, broken normals or floating hairline.
- Distinct hairstyles, eyebrows, facial hair where applicable, and material/skin variants. Check original hairstyle replacement and no duplicate authored hair.
- Correctly fitted glasses and independently selectable left/right earrings using Eye.L, Eye.R, EarAnchor.L and EarAnchor.R. Verify placement at all face extremes.
- Creator save/reload and gig snapshot round trips for every selectable head and accessory field; preserve old V1 saves.
- Capture neutral, blink, gaze, smile, open-jaw, singing visemes and expressive close-ups in front, side and three-quarter views for both frames, with and without glasses/earrings and multiple hairstyles.

## Structural gate
Run `auditAvatarV2Face` on the loaded candidate root for each frame/LOD that supports close-up faces. Required channels are named in the audit source. Treat a structural pass as **candidate evidence only**, never as asset validation. Confirm the facial channels are actually driven by creator preview and singing playback, and that names match exported GLBs.

## Manual acceptance
Record for each frame: source asset version, exported GLB SHA, close-up capture sheet, morph-extreme video, hair/accessory clipping results, creator persistence test, gig replay test, reviewer and approval date. Any absent evidence blocks Phase 2 sign-off.

## Dependencies
Phase 1 certified body/head rigs are required for final fitting and deformation sign-off. Phase 3 owns the authored RockMundo tee. Phase 4 owns production LOD certification. Do not mark registry entries validated or enable the V2 rollout from this Phase 2 work alone.
