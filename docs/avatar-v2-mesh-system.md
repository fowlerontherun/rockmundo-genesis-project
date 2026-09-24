# RockMundo Avatar V2 mesh system

## Why this exists

The current stage avatar is reliable and lightweight, but its Quaternius donor
topology is now the visual ceiling. Increasing texture resolution improves
materials, but it cannot add facial topology, finger definition, better joint
loops, garment thickness or convincing close-up deformation.

Avatar V2 introduces a replacement mesh/rig layer without throwing away the
gameplay systems already built around the current avatar.

## Core rule

**Do not switch players to V2 until it is complete enough to be safer than V1.**

The fitting room and stage renderer now pass through a dual-engine adapter. V2 is
attempted only when:

1. the requested frame/LOD is marked `validated`;
2. the rollout gate is enabled;
3. the runtime contract passes;
4. the avatar does not require a compatibility feature that V2 has not certified.

Otherwise the exact existing V1 assembly is used.

## Target architecture

```
PlayerAppearance
      |
      v
Avatar mesh engine
   /       \
V1 fallback  V2 authored humanoid
              |
              +-- shared semantic skeleton
              +-- facial morph targets
              +-- authored LOD0..LOD3
              +-- V2 skinned garments
              +-- hair/accessory sockets
              +-- tattoos / decals
              +-- existing stage IK adapter
```

The V2 rig is normalized into the bone names already understood by RockMundo's
performance code (`Hips`, `Spine1`, `Spine2`, `UpperArm.L`, `Hand.R`,
etc.). That lets the existing singing, guitar, bass and drum animation systems be
reused while the visible character mesh is replaced.

## Base topology source

The production base-mesh workflow is now pinned to Blender Studio/community
**Human Base Meshes v1.4.1 (CC0)**. The source is used only as clean topology and
sculpt material; it is not a runtime dependency and is never shipped unchanged as
the RockMundo player avatar. Provenance is locked in
`public/avatar-v2/source-provenance.json`.

The source helper
`scripts/avatar-v2/blender/rockmundo_avatar_v2_seed.py` can list the source
objects/collections in the extracted Blender bundle and create separate masculine
or feminine working .blend files. The follow-up
`scripts/avatar-v2/blender/rockmundo_avatar_v2_rig_guide.py` creates the exact
RockMundo semantic bone names, shoulder/toe articulation and complete three-joint
finger chains over the source proportions. It intentionally stops before binding:
joint centres and weights must be fitted to the actual topology so V2 does not
inherit generic auto-weight deformation. After manual binding,
`rockmundo_avatar_v2_weight_audit.py` checks that body/head surfaces are bound to
the intended armature, every vertex is weighted, no vertex exceeds four meaningful
influences, weights are normalised and every required deform bone actually affects
the character.

Those working files still require the complete RockMundo facial/shape-key set,
body-region split, PBR surfaces, performance deformation and LOD authoring before
the normal export gate will accept them. Shape-key names alone are not sufficient: required muscle, facial
and pose-corrective targets must produce measurable vertex deformation, preventing
placeholder morphs from passing certification.

This gives Phase B a real high-quality topology starting point without weakening
the fail-closed production contract or tying the game to an external avatar
provider.

## Mesh quality target

LOD0 is intended for the Avatar Designer, Skin Store and TOTP close-ups. The
target is a stylised premium character rather than a photoreal scan.

Priority topology areas:

- eyelids and lips with deformation loops;
- nose/nostril definition;
- separate eye/cornea geometry with dedicated `Eye.L` / `Eye.R` gaze bones;
- ears capable of accurate jewellery attachment;
- five-finger hands suitable for instrument grips;
- shoulders/elbows/knees with animation-friendly loops;
- shaped feet/toes for real footwear;
- clean neck/head transition for hairstyles;
- stable UVs for tattoos and skin detail.

## Foot and toe-base articulation

LOD0/LOD1 use `Toe.L/R` as live deformation bones rather than contract-only
markers. Each toe base must inherit from its matching `Foot.L/R`; browser
candidate validation, the exported-GLB validator and the Blender export gate all
reject disconnected forefoot chains.

The live performer solves leg/ankle placement first, then applies toe flex around
a hinge axis derived from the authored ankle-to-toe direction. This avoids
assuming imported local bone axes and means toe motion cannot move the ankle IK
target. Walking uses stronger swing/push-off flex, drum performers press the
forefoot during pedal cycles, standing performers alternate subtle load between
feet, and running crowd poses retain visible toe articulation.

The runtime clamps toe lift to about 24 degrees and downward pedal/load press to
about 11 degrees. Admin performance QA checks for both toe bones, finite motion,
visible movement and the same upper range bound.

## Shoulder girdle participation

LOD0/LOD1 shoulder bones are part of the live performance solve, not decorative
rig entries. Each `Shoulder.L/R` must inherit from the chest and its matching
`UpperArm.L/R` must inherit from that shoulder; browser validation, exported-GLB
validation and the Blender export gate all reject a disconnected shoulder chain.
Before each V2 arm IK pass, the matching shoulder receives a small bounded share
of the hand reach direction; the upper/lower arm then finishes the exact target solve. This gives raised microphones, guitar grips, drum reaches
and crowd gestures visible clavicle/scapular participation without moving the
authoritative hand contact point.

The controller always re-solves from the authored shoulder rest rotation. Guitar
collision correction can therefore retry an arm target without accumulating extra
clavicle rotation. Runtime motion is capped at roughly 14 degrees and Admin V2
performance QA checks for both shoulder bones, finite motion, visible activity and
the same range bound.

## Limb twist distribution

LOD0/LOD1 use six deform-only helper bones:
`UpperArmTwist.L/R`, `ForearmTwist.L/R` and `ThighTwist.L/R`. The runtime
extracts the axial component of the final live child-joint rotation after IK and
wrist articulation, then distributes a bounded share of that roll onto the helper.
This reduces candy-wrapper collapse around shoulders, forearms and thighs without
changing hand/foot target positions or double-bending the control chain.

The helpers must inherit from their matching `UpperArm`, `LowerArm` or
`UpperLeg` control bone and must carry meaningful body weights. LOD2/LOD3 can
drop them for budget. Close-up garments must also weight the helpers for the limb
regions they cover; merely exporting the helper names is insufficient at runtime.

## Pose-space joint deformation

LOD0/LOD1 should include authored deformation correctives for both shoulders, elbows,
hips and knees: `poseShoulderLeft/Right`, `poseElbowLeft/Right`,
`poseHipLeft/Right` and `poseKneeLeft/Right`. The runtime measures the final local
joint rotation after stage IK, finger articulation and instrument posing, then blends
the matching corrective automatically. This preserves shoulder volume and prevents
elbows, hips and knees from collapsing during guitar, bass, drum and vocal poses.

Correctives are additive to skinning and do not alter the skeleton or saved appearance.
All eight are required for LOD0/LOD1 validation, so a close-up candidate cannot be
marked production-ready with collapsing joint deformation. LOD2/LOD3 do not carry
this requirement because their distance and topology budgets make the extra shapes
unnecessary.

Body-worn LOD0/LOD1 garments must carry the matching twist weights and pose-space
correctives for the regions they cover. Tops/upper-body garments require shoulder and elbow targets; trousers
and other lower-body garments require hip and knee targets. Garment assembly fails
closed to V1 if these are absent, avoiding a corrected body deforming through a
rigid-looking garment during the same pose.

## Facial animation and gaze

The initial hard gate requires blink left/right, jaw open and smile. Close-up V2
rigs also require `Eye.L` and `Eye.R` bones. The runtime layers deterministic
micro-saccades over deliberate performer gaze, so eye direction follows bandmate,
audience and fretboard cues while Top of the Pops/gig replays remain deterministic.
Blink timing is slightly asymmetric with occasional deterministic double blinks,
and low-amplitude idle cheek/brow/squint motion prevents a frozen neutral face.

The eye bones own gaze; eye-look shape keys are not required. Blink, squint and
cheek morphs remain independent so the eyelids can animate naturally around a
moving eyeball.

The next authoring pass should continue expanding phoneme/viseme targets so singer
mouth motion can later be driven by broadcast/gig audio rather than only the
deterministic performance clock.

Suggested follow-up targets:

- mouthFrown
- mouthPucker
- mouthFunnel
- browInnerUp
- browDownLeft / browDownRight
- AA / EE / IH / OH / OU visemes

## Clothing

V2 clothing will be actual skinned garments authored against the shared V2
skeleton. The current curated catalogue remains available on V1 until each item
has a V2 garment asset or an approved V2 compatibility mapping.

No browser-generated garment geometry is part of the V2 target.

Every V2 garment will require:

- masculine/feminine fit where needed;
- LODs;
- PBR material maps;
- body occlusion mask;
- tattoo coverage metadata;
- instrument-pose QA;
- no detached detail meshes;
- store turntable certification.

## Performance budgets

The base budgets live in `avatarV2Contract.ts` and the asset README. The key
principle is selective quality:

- LOD0: close-up/editor/store/TOTP
- LOD1: primary stage performers
- LOD2: medium distance
- LOD3: distant/crowd fallback

Crowds never need the same topology or 2K textures as a singer in a close-up.

## Asset workflow

1. Author/export candidate GLB to `public/avatar-v2/<frame>/base-lodN.glb`.
2. Change the matching manifest status from `planned` to `asset_ready`.
3. Run `npm run validate:avatar-v2`.
4. Fix rig/morph/budget/export errors.
5. Run visual QA in the V2 admin surface.
6. Mark `validated`.
7. Only enable rollout after both frames have validated LOD0/LOD1 and compatibility
   work for clothing/tattoos is complete.

## Phase plan

### Phase A — foundation (this PR)

- semantic rig contract;
- LOD and topology budgets;
- GLB validation command;
- V2 asset registry;
- safe V1 fallback engine;
- fitting room/stage wiring;
- admin readiness surface.

### Phase B — base meshes

- pin and prepare the CC0 Blender Human Base Meshes source;
- masculine LOD0/1;
- feminine LOD0/1;
- face/eyes/teeth/tongue;
- hands and feet;
- initial facial blendshapes;
- direct A/B visual comparison.

### Phase C — compatibility

- V2 hairstyles;
- hats/glasses/earrings;
- tattoo projection;
- first V2 tee, jeans and boots;
- guitar/bass/drum grip certification;
- pose-space shoulder/elbow/hip/knee deformation certification.

#### Phase C1 — shared appearance bridge

The V2 body can now use the saved RockMundo appearance systems without bringing
the legacy V1 body mesh back into the scene:

- saved procedural hairstyles and facial hair are rebuilt around the authored V2
  head/face surface and remain attached to the normalized `Head` bone. LOD0/LOD1
  certification now fails if that skinned head surface (and a skin material) is
  missing, so a candidate cannot pass QA and then lose fitted cosmetics at runtime;
- hats, glasses and left/right earrings use the same measured face/ear fitting
  logic as V1, but V2 head meshes are recognised through explicit
  `RMV2_Head...` / `RMV2_Face...` naming or
  `rockmundoHeadSurface=true` metadata;
- Tattoo Parlour visuals attach to the normalized V2 skeleton instead of forcing
  the whole avatar back to V1;
- authored V2 clothing mappings now also accept headwear, eyewear and accessory
  slots. These assets must still be bone-weighted GLBs; detached rigid details
  remain rejected;
- body occlusion metadata is mandatory for tops, bottoms and footwear, but is
  deliberately optional for hats/glasses/accessories that do not cover a body
  region;
- the admin candidate lab runs valid V2 meshes through the production vocal,
  electric-guitar, bass and rock-drum performance rigs. It samples multiple
  motion frames, rejects non-finite hand bones, reports left/right grip drift,
  verifies two drumsticks and reports stick-to-hand drift. The current automated
  hand/stick clearance target is 14 cm; visual clipping review is still required.

This is a compatibility bridge, not a rollout switch. Any missing head surface,
unknown garment bone, absent exact LOD asset or failed contract still causes a
clean V1 fallback. The registry remains locked until real masculine/feminine
base assets and the proof garments are validated.

#### Phase C2 — complete body, muscle types and tattoo fitting view

Avatar V2 now treats the base character as a complete unclothed body rather than
a clothing-dependent donor:

- body width/build remains its own control;
- muscle definition is a separate saved choice with Natural, Toned, Athletic,
  Muscular and Bodybuilder states;
- V2 authoring requires dedicated `muscleToned`, `muscleAthletic`,
  `muscleMuscular` and `muscleBodybuilder` morph targets so changing muscle
  definition never relies on scaling the skeleton;
- each of the eight V2 body-region meshes must be skinned and use a skin material.
  A candidate that would leave a hole when clothes are removed now fails both the
  browser contract and Blender export gate;
- Topless is a real free top state. It reveals the skinned base torso rather than
  drawing a transparent fake T-shirt. While V2 remains rollout-locked, V1 adds a
  neutral skinned underlay behind its clothing-first donor meshes so the preview
  cannot collapse into a missing torso;
- Tattoo Parlour uses a dedicated `tattoo` presentation. Garments are temporarily
  suppressed only for that preview and every owned tattoo is rendered, while the
  character's saved outfit remains untouched;
- the admin V1/V2 candidate lab can switch muscle types so each authored morph can
  be reviewed with the same performance rig before rollout.

The server-side appearance validator accepts the optional muscle field and the
topless starter item while continuing to accept every legacy version-1 appearance
that has no muscle field.

### Phase D — production rollout

- LOD2/3;
- migrate curated clothing;
- TOTP close-up certification;
- staged player opt-in;
- default V2 after telemetry/QA;
- retain V1 fallback for old replay snapshots until no longer needed.


## Phase B2 — authored garment compatibility

The V2 renderer now has a fail-closed skinned-garment adapter. Existing live
clothing remains on Avatar V1 until an item has an explicit validated V2 mapping.

V2 garment metadata lives inside the existing `garment_config.avatarV2` JSON, so
the catalogue does not need a parallel ownership or purchase system. A future
validated item uses this shape:

```json
{
  "avatarV2": {
    "version": 1,
    "status": "validated",
    "frames": {
      "masculine": {
        "lod0": "avatar-v2/clothing/masculine/example-lod0.glb",
        "lod1": "avatar-v2/clothing/masculine/example-lod1.glb"
      },
      "feminine": {
        "lod0": "avatar-v2/clothing/feminine/example-lod0.glb",
        "lod1": "avatar-v2/clothing/feminine/example-lod1.glb"
      }
    },
    "occludeBodyRegions": ["torso"],
    "colourMode": "zones",
    "materialZones": {
      "main": ["RMV2_Garment_Main"],
      "trim": ["RMV2_Garment_Trim"]
    }
  }
}
```

Every visible garment object must be a `SkinnedMesh`. Rigid details such as
zips, studs, badges and eyelets are still bone-weighted (usually 100% to one
bone) rather than being loose scene objects. The runtime and offline validator
reject unskinned garment details so the V2 pipeline cannot reintroduce floating
logos/hardware.

The base body exposes eight skinned garment-occlusion regions:

- torso
- upper arms
- lower arms
- hands
- hips
- upper legs
- lower legs
- feet

The preferred V2 authoring method keeps one continuous body mesh and assigns
region-tagged skin materials such as `RMV2_Skin_Torso` and
`RMV2_Skin_UpperArms`. The runtime hides only the material groups covered by a
garment, avoiding visible geometry seams between body chunks. Existing
region-specific skinned objects remain supported for compatibility.

`rockmundo_avatar_v2_body_regions.py` can seed these material assignments from
the manually fitted skin weights without splitting topology. Every V2 LOD keeps all eight used body regions because
Topless and Tattoo Parlour presentations can expose the bare body regardless of
render quality. Garments declare which regions they cover, preventing skin from
clipping through shirts, jeans and boots during performance animation.

The first authored proof set is reserved in
`public/avatar-v2/clothing/manifest.json`:

1. Rockmundo Logo Tee
2. Dark Slim Jeans
3. Black Boots

All remain `planned` until real GLBs exist and pass both
`npm run validate:avatar-v2` and visual performance QA.

Avatar V2 assets resolve from `/avatar-v2/...`; they are intentionally separate
from the legacy `/gig-demo-3d/...` donor directory. The loader understands both
roots so V1 and V2 can coexist during migration.
