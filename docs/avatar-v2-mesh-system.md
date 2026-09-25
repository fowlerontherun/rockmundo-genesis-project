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
the normal export gate will accept them. At high/ultra/cinematic quality, standard
glTF skin, hair, teeth and tongue surfaces are promoted to the physical shader path
without replacing authored maps: skin gains controlled specular/sheen response,
hair gains directional anisotropy and sheen, and teeth/tongue gain distinct
close-up moisture/specular behaviour. V2 also raises fallback texture detail one
tier above the shared V1 profile: High uses Ultra detail (1024px skin normal,
512px hair detail) and Ultra uses Cinematic detail (2048px skin normal, 1024px
hair detail). Balanced/crowd rendering keeps the cheaper standard path and normal
texture budgets. Shape-key names alone are not sufficient: required muscle, facial
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
- separate iris, sclera and cornea geometry with real `Eye.L` / `Eye.R` skin influence;
- separate left/right eyelid wetlines with a moist physical shader and side-specific blink deformation;
- authored left/right eyelash strips/cards fitted to the lid rim and carrying the matching blink deformation;
- a dedicated used lip material region on the skinned face for natural colour and moisture response;
- an authored natural-eyebrow material region, independently tintable from hair and replaceable by saved eyebrow styles;
- V1-compatible freckles, beauty marks and weathering projected onto the V2 head without applying V1 face-scale deformation;
- ears capable of accurate jewellery attachment, with authored `EarAnchor.L/R` earlobe markers;
- five-finger hands suitable for instrument grips;
- shoulders/elbows/knees with animation-friendly loops;
- shaped feet/toes for real footwear;
- clean neck/head transition for hairstyles;
- stable UVs for tattoos and skin detail;
- dedicated upper/lower teeth, tongue and mouth-cavity surfaces for open-mouth singing close-ups, with upper teeth on Head and lower teeth/tongue on Jaw;
- at least 25mm of authored mouth-cavity depth so a fully open jaw never resolves to a flat dark plane.

### Close-up facial sculpt landmarks and anatomy gate

LOD0/LOD1 now require **real selected vertices on the same continuous skinned
head mesh** for the nose bridge, tip, bilateral recessed nostril rims, bilateral
helix/antihelix and earlobes. The Blender authoring pass uses
`RMV2_NoseBridge`, `RMV2_NoseTip`, `RMV2_NostrilRim.L/R`,
`RMV2_EarHelix.L/R`, `RMV2_EarAntihelix.L/R` and
`RMV2_EarLobe.L/R` vertex groups. It measures depth/contour/side placement
in metres and checks that each `EarAnchor.L/R` falls near its real sculpted
lobe. Export rejects a face that is only textured to resemble these shapes or
uses a copied/flat group to satisfy the checklist. See
`rockmundo_avatar_v2_topology_audit.py` for the interactive authoring report
and `facial_topology.py` for testable geometric thresholds. These checks are
performed before GLB export; they do not claim to create real high-detail
masculine/feminine assets on their own.

The Blender LOD0/LOD1 exporter now emits a
base-lod*.glb.face-topology.json sidecar for each successful audited close-up
export. It binds the authoring audit to the exact GLB SHA-256 and records the
real head-mesh name and landmark counts. The repository's standalone asset
validator requires this sidecar and rejects a stale or mismatched GLB. This
closes the gap where Blender face vertex groups disappeared during normal
glTF export; the sidecar is provenance/integrity evidence, while geometric
measurements must still happen against the actual fitted sculpt in Blender.

### Author lower-resolution models from the real sculpt

Artist-retopologised LOD1–LOD3 meshes can now inherit actual shape-key
deformation, four-bone skin weights and optionally material-region assignments
from the corresponding fitted LOD0 surface using
`rockmundo_avatar_v2_retarget_lod.py`. It previews correspondence distances,
rejects overly distant topology or lost required morphs, and never invents
facial anatomy or decimates the source in place. Its standalone interpolation
tests are included in the Avatar V2 sculpt CI gate. The authored LOD1 head
still needs **new** real nose/ear landmark vertex groups, independently
audited before export; the artist must also verify UVs, silhouette, joint
deformation and all remaining separate surfaces. Full usage is in
`public/avatar-v2/README.md`.

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
rigs also require `Eye.L` and `Eye.R` gaze bones plus non-deforming
`EarAnchor.L` and `EarAnchor.R` markers parented to `Head`. The eye bones
provide exact lens/gaze centres; the ear anchors provide exact earring/temple-arm
attachment points and replace the old outer-head-vertex ear guess for V2. The runtime layers deterministic
micro-saccades over deliberate performer gaze, so eye direction follows bandmate,
audience and fretboard cues while Top of the Pops/gig replays remain deterministic.
Blink timing is slightly asymmetric with occasional deterministic double blinks,
and low-amplitude idle cheek/brow/squint motion prevents a frozen neutral face.

The eye bones own gaze; eye-look shape keys are not required. Blink, squint and
cheek morphs remain independent so the eyelids can animate naturally around a
moving eyeball.

Close-up certification now requires the full singing deformation set already
driven by the V2 runtime: mouth funnel/pucker, AA/EE/IH/OH/OU visemes,
eye squint left/right, brow inner-up/down left/right, cheek squint left/right and
mouth stretch left/right. These targets must contain measurable vertex movement,
so a mesh cannot pass by carrying empty shape-key names.

The fallback facial timing is now syllable-based rather than a repeating
AA→EE→IH→OH→OU loop. It deterministically varies vowel order, emphasis, lip
rounding/stretch and short consonant-like closures, so seeking or replaying the
same timestamp reconstructs the same face while close-ups read less mechanically.
Actual broadcast/gig phoneme timing can later feed the same expression controller
when a canonical audio-analysis track is available. Admin performance QA now also
samples the live vocalist path and verifies visible jaw motion, at least three
distinct active visemes, lip funnel/pucker/stretch contribution and brow/cheek
activity. This catches assets whose shape keys pass static validation but fail to
participate in the real performance controller. Additional mouth-frown targets can
still be layered on after the required set.

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

LOD0/LOD1 garment assembly now carries the Skin Store material profile into the
authored V2 mesh instead of leaving every GLB on a generic standard shader.
Cotton/denim/canvas and similar fabric surfaces receive bounded physical
roughness/sheen plus a high-resolution textile normal only when the artist did not
export one. Leather, vinyl, latex, silk and satin use their appropriate
clearcoat/sheen/anisotropy response without fabric-weave being forced onto smooth
surfaces. Authored color, normal, roughness, metalness, AO, emissive and
transparency/render flags are preserved. Hardware materials such as zips, studs,
buckles and eyelets are excluded from fabric fallback. LOD2/LOD3 stay on the
cheaper standard shader path.

## Performance budgets

The base budgets live in `avatarV2Contract.ts` and the asset README. The key
principle is selective quality:

- LOD0: close-up/editor/store/TOTP
- LOD1: primary stage performers
- LOD2: medium distance
- LOD3: distant/crowd fallback

Crowds never need the same topology or 2K textures as a singer in a close-up.
The live loader now routes scene quality into both the V2 base mesh and matching
garments. High-quality Top of the Pops television scenes request `ultra`, which
selects V2 LOD0; balanced television scenes keep LOD1, and low-quality television
steps down to LOD2. Ordinary high/balanced gig performers retain the existing
LOD1 target, while low-quality gigs may use LOD2. This fixes the previous hard
coded `high` path that prevented TOTP from ever loading its documented LOD0
close-up avatar.

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
  head/face surface and remain attached to the normalized `Head` bone. Close-up
  V2 hair receives a one-tier quality uplift: High uses Ultra geometry/fibre maps,
  while Ultra/TOTP uses Cinematic geometry/fibre maps. Balanced/crowd hair keeps
  its existing cost. LOD0/LOD1
  certification now fails if that skinned head surface (and a skin material) is
  missing, so a candidate cannot pass QA and then lose fitted cosmetics at runtime;
- hats retain measured head-surface fitting, while V2 glasses and left/right
  earrings prefer the authored `Eye.L/R` and `EarAnchor.L/R` rig markers.
  Hair-clearance uses the same anchors, preventing the old case where a stylised
  temple/cheek vertex was mistaken for the earlobe. V2 head meshes are recognised through explicit
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
