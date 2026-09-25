# RockMundo Avatar V2 assets

This directory is the import boundary for the replacement avatar mesh system.

Do **not** put experimental meshes into the live `gig-demo-3d` asset family. V2
assets must pass the repository contract before their manifest status can move to
`validated`.

## Official authoring source

RockMundo Avatar V2 now uses **Blender Human Base Meshes v1.4.1** as the pinned
topology/sculpt starting point. The bundle is CC0 and is recorded in
`source-provenance.json`. It is an authoring dependency only: the game never
downloads it at runtime and no stock bundle asset may be marked as a RockMundo
validated avatar without completing the RockMundo rig, morph, materials, body
regions, LOD and visual-QA work.

Fetch and safely extract the pinned bundle with:

```bash
npm run fetch:avatar-v2-source
```

The helper refuses an unexpected archive size, validates ZIP magic and blocks
archive path traversal. It writes only under the ignored local
`work/avatar-v2-source` authoring directory.

Then use Blender to discover the object/collection names in the extracted .blend
file:

```bash
blender --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_seed.py -- \
  --source /path/to/extracted/<bundle-file>.blend --list
```

Create a clean working file. The default `stylized` preset automatically selects
`Body Male - Stylized` for the masculine frame and `Body Female - Stylized`
for the feminine frame:

```bash
blender --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_seed.py -- \
  --source /path/to/extracted/<bundle-file>.blend \
  --frame masculine \
  --preset stylized \
  --output work/avatar-v2-masculine-source.blend
```

Repeat with `--frame feminine`. Use `--preset realistic` or explicit
`--object`/`--collection` only when deliberately evaluating an alternative
source.

Next create the correctly named RockMundo deform-rig guide:

```bash
blender work/avatar-v2-masculine-source.blend --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_rig_guide.py -- \
  --frame masculine \
  --output work/avatar-v2-masculine-rigged-source.blend
```

The guide creates the production bone names, shoulders, toes and complete
three-joint finger chains, but deliberately does **not** auto-bind the body.
Open the generated file and fit every joint to the actual topology before
weighting. Automatic envelope weighting here would recreate the shoulder, hand,
elbow and hip deformation problems V2 is intended to remove.

After manual binding/weight cleanup, run the structural weight audit:

```bash
blender work/avatar-v2-masculine-rigged-source.blend --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_weight_audit.py -- \
  --armature RMV2_Armature
```

It rejects unweighted body/head vertices, more than four meaningful influences,
poorly normalised weights, incorrect armature modifiers and required deform bones
that never influence the body. Eyes, teeth, tongue and other separate close-up
surfaces are not incorrectly treated as body-region weight targets.

After the audit passes, assign the eight garment-occlusion regions **without
splitting the mesh**:

```bash
blender work/avatar-v2-masculine-rigged-source.blend --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_body_regions.py -- \
  --armature RMV2_Armature \
  --output work/avatar-v2-masculine-regions.blend
```

The helper duplicates the existing skin shader into region-tagged materials and
classifies polygons from the fitted RockMundo bone weights. Geometry remains
continuous, so region boundaries do not introduce cracks. Head/face/neck polygons
that are not garment-occlusion regions retain their original skin material. Review
the boundary assignments visually before export.

The seed helper stamps source provenance, normalises the source to a sensible
authoring height and embeds a RockMundo authoring checklist inside the .blend. It
does **not** fabricate a finished rig or empty shape keys and it does not export a
runtime GLB.

Run `npm run verify:avatar-v2-source` to ensure the repository remains pinned to
the reviewed source/version.

## Close-up nose and ear sculpt audit

Before exporting **either LOD0 or LOD1**, mark actual vertices on **one continuous
head/face skin mesh** with these Blender vertex groups (do not detach new
placeholder nose/ear meshes or use empty material slots):

- `RMV2_NoseBridge`, `RMV2_NoseTip`, `RMV2_NostrilRim.L/R`
- `RMV2_EarHelix.L/R`, `RMV2_EarAntihelix.L/R`, `RMV2_EarLobe.L/R`

Keep the face pointing toward **-Y in Blender** (+X = left) as used by the rig
guide. Give the nose tip visible forward projection, recess both nostril rims,
and sculpt distinct outer/inner ear contours and earlobes. Move
`EarAnchor.L/R` to the real piercing points, not just an estimated head width.
Groups are artist-selected on the original fitted topology so UV seams, tattoo
mapping and skin deformation are preserved.

Run the authoring audit before export:

```bash
blender work/avatar-v2-masculine-regions.blend --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_topology_audit.py -- \
  --armature RMV2_Armature \
  --json work/avatar-v2-masculine-face-topology.json
```

The audit reports missing or too-small vertex groups, a flat nose bridge/tip,
painted-on nostrils, collapsed/duplicated ear contours, left/right placement and
earring anchors more than 25mm from their sculpted lobes. It reads actual mesh
coordinates in metres and requires an armature-bound continuous head with a
used skin material. LOD0/LOD1 Blender export now runs the same landmark geometry
checks before generating a GLB. A source seed without manually authored face
detail intentionally fails. Repeat for the feminine frame and each close-up LOD.

The geometry rules have independent Python tests:

```bash
python -m unittest discover -s scripts/avatar-v2/tests -p test_facial_topology.py -v
```

### Audited export provenance

The LOD0/LOD1 Blender exporter now writes a companion file beside the GLB:
for example, base-lod0.glb.face-topology.json. It records the fitted
head-mesh identity, selected vertex-group counts, frame/LOD and SHA-256 of the
**exact exported GLB**. Commit both files together. The repository asset
validator refuses to accept a close-up model when this audit file is missing,
claims a different frame/LOD, points at a head that is not skinned in the GLB,
reports missing landmark vertices, or its checksum no longer matches the GLB.
Re-export both files after modifying a model.

This is integrity and authoring-process evidence, not an independent
assessment of sculpt quality. Blender must still perform its geometric audit
before export, and artists must still approve front/side close-ups, nostrils,
ears, eyebrow fit and expressions before marking an asset validated.
LOD2/LOD3 retain their lighter geometry and are exempt from close-up proof.

Run the provenance tests locally:

    node --test scripts/avatar-v2/tests/face-topology-provenance.test.mjs

## Coordinate and export contract

- GLB 2.0
- metres
- +Y up
- +Z forward
- A-pose rest pose
- one humanoid skeleton shared by body and garments within a frame family
- root transform applied/frozen before export
- no negative object scale
- no unapplied armature scale
- skin weights normalized, maximum 4 influences per vertex
- body/clothing transforms at identity in the exported rest pose

The renderer aliases common humanoid bone names into RockMundo's existing stage
bone names. The required semantic bones are defined in
`src/features/player-model/v2/avatarV2Contract.ts`.

## Head surface contract

Saved hairstyles, hats, glasses and earrings need a stable authored head/face
surface for fitting. LOD0/LOD1 also require non-deforming `EarAnchor.L` and
`EarAnchor.R` bones parented under `Head`; place them at the actual earlobe /
piercing attachment points. The runtime uses those anchors for earrings, glasses
temples and local hair-clearance instead of guessing the ear from the outermost
head vertex. At least one close-up skinned head/face mesh should either:

- use a name beginning with `RMV2_Head` or `RMV2_Face`; or
- set `rockmundoHeadSurface=true` in node extras/userData.

Keep the visible scalp/face skin in that surface and use a named skin material
such as `RMV2_Skin`. If a player uses a non-original saved hairstyle, a
separate authored hair mesh/material such as `RMV2_Hair` can be suppressed
cleanly before the selected hairstyle is rebuilt. The compatibility hairstyle
uses a V2-specific close-up quality uplift: High requests Ultra hair geometry and
fibre maps; Ultra/TOTP requests Cinematic hair. Balanced/crowd quality is left
unchanged so distant performers do not pay the close-up geometry/texture cost.

## Body and muscle contract

The base GLB must be a complete skinned body even when no garment is present.
Every body-region mesh listed below must have a skin material (normally
`RMV2_Skin`) rather than relying on a shirt/trouser surface to fill the character.

All LODs require these muscle-definition targets:

- `muscleToned`
- `muscleAthletic`
- `muscleMuscular`
- `muscleBodybuilder`

Natural uses the basis shape. Body width is controlled separately by
`bodySlim`/`bodyBroad`; do not use bone or whole-skeleton scaling to fake muscle
definition. Required shape keys must contain real vertex deformation: the Blender,
GLB and browser gates reject named zero-effect placeholders. This separation is
required so Topless, Tattoo Parlour close-ups and garment fitting all share the
same body.

## Facial contract

LOD0/LOD1 require morph targets equivalent to:

- blinkLeft
- blinkRight
- jawOpen
- mouthSmile

LOD0/LOD1 require mouth funnel/pucker plus AA, EE, IH, OH and OU visemes;
the stage renderer blends neighbouring visemes rather than snapping between them.
Close-up certification also requires `eyeSquintLeft/Right`, `browInnerUp`,
`browDownLeft/Right`, `cheekSquintLeft/Right` and
`mouthStretchLeft/Right`. These targets must contain measurable deformation;
named zero-delta placeholders fail browser, exported-GLB and Blender validation.
They are driven from vocal opening and performance energy so strong choruses
engage the lips, cheeks, eyes and brows as well as the jaw while quieter passages
remain subtle. Additional frown targets are still encouraged.
Eye direction is handled by dedicated eye bones, keeping gaze independent from
blink/squint facial morphs. LOD0 also requires separate left/right eyelid wetline
surfaces using `RMV2_Wetline`; each wetline stays Head-skinned and carries the
matching `blinkLeft` or `blinkRight` deformation so the tear line follows the
eyelid rather than floating across the eye. Teeth and tongue must be separate at
LOD0, and the mouth-interior mesh needs at least 25mm of real front-to-back depth,
so close-up vocals never expose a hollow or paper-flat mouth.

LOD0/LOD1 also require shoulder and toe-base articulation, dedicated `Eye.L` /
`Eye.R` gaze bones, non-deforming `EarAnchor.L/R` attachment bones, six deform-only twist helpers
(`UpperArmTwist.L/R`, `ForearmTwist.L/R`, `ThighTwist.L/R`), plus complete
three-joint thumb/index/middle/ring/little chains on both hands. `Toe.L/R` must be descendants of their matching `Foot.L/R` bones; the live performer uses them for walking push-off, drum-pedal press and standing weight-transfer flex instead of leaving the forefoot rigid. Both eye bones and both ear attachment anchors must be descendants of the
authored head bone so head turns carry gaze and accessories together. Ear anchors
must remain unweighted/non-deforming. They are driven at runtime for deterministic
micro-saccades and interaction-aware gaze; do not bake a permanently offset stare
into the mesh. They also require
the eight pose-space joint deformation targets `poseShoulderLeft/Right`,
`poseElbowLeft/Right`, `poseHipLeft/Right` and `poseKneeLeft/Right`.
These preserve joint volume after the final live IK pose rather than relying on
linear skinning alone. The twist helpers distribute only axial roll from the final
elbow/wrist/knee chain; they do not replace the control bones or double-apply limb
swing. LOD2/LOD3 may omit the twist helpers.

Common Blender,
Mixamo and VRM-style names are normalized to RockMundo's runtime finger names.
This is deliberate: the new mesh system must improve guitar fretting, pick/pluck
shapes, microphone wrap and drumstick fulcrum contact rather than only increasing
face resolution.

## LOD budgets

| LOD | Purpose | Max triangles | Max vertices | Texture target |
| --- | --- | ---: | ---: | ---: |
| 0 | editor/store/TOTP close-up | 55,000 | 65,000 | 2048 |
| 1 | stage performers | 30,000 | 38,000 | 1024 |
| 2 | medium-distance performers | 12,000 | 18,000 | 1024 |
| 3 | distant/crowd fallback | 5,000 | 8,000 | 512 |

These are whole-character base budgets before optional held instruments. Garments
have separate budgets and will be introduced after the base rig passes.

## Material naming

Use stable names where possible:

- `RMV2_Skin`
- `RMV2_Eyes` / `RMV2_Iris` / `RMV2_Sclera`
- `RMV2_Cornea` for the transparent/reflective eye shell
- `RMV2_Wetline` for the eyelid tear/wetline highlight
- `RMV2_Eyelashes` for authored lash cards/strips
- `RMV2_Eyebrows` for the authored natural-brow region on the skinned head
- `RMV2_Lips` for the used lip region on the skinned head
- `RMV2_Hair`
- `RMV2_Teeth`
- `RMV2_Tongue`
- `RMV2_MouthInterior`

LOD0 now requires dedicated iris, sclera, cornea, left/right wetline, left/right
eyelash, teeth, tongue and mouth-interior geometry using matching material roles;
the skinned head/face must also contain genuinely used `RMV2_Lips` and
`RMV2_Eyebrows` material regions; extra unused/material slots on the body or
face do not count. The eye surfaces must be split or skinned so both `Eye.L` and
`Eye.R` have real influence. Teeth must include both Head-driven upper teeth and
Jaw-driven lower teeth, the tongue must carry real Jaw influence, and the mouth
interior must remain Head-driven. Each surface sets `rockmundoBoneBinding` to the
bone it is authored for; Blender exports these custom properties into GLB extras.
LOD1 retains the lighter material-role checks. This prevents close-up singing from
passing certification with painted-on eyes, fake material slots, floating oral
geometry or a hollow mouth cavity. The runtime promotes cornea surfaces to a
physical material where needed, uses a realistic eye IOR/clearcoat response, gives
sclera a slightly warm white, and treats teeth/tongue/interior separately.

Recommended LOD0 surface layout:

- `RMV2_Iris.L` → `rockmundoBoneBinding=Eye.L`
- `RMV2_Iris.R` → `rockmundoBoneBinding=Eye.R`
- `RMV2_Sclera.L/R` → matching eye bone
- `RMV2_Cornea.L/R` → matching eye bone
- `RMV2_Wetline.L/R` → `Head`, with `rockmundoEyeSide=L/R` and the matching blink morph
- `RMV2_Eyelashes.L/R` → `Head`, with `rockmundoEyeSide=L/R` and the matching blink morph
- `RMV2_Lips` → used material region on the skinned `RMV2_Head`/`RMV2_Face` surface
- `RMV2_Eyebrows` → used natural-brow region on the same head/face surface
- `RMV2_UpperTeeth` → `Head`
- `RMV2_LowerTeeth` → `Jaw`
- `RMV2_Tongue` → `Jaw`
- `RMV2_MouthInterior` → `Head`

The browser gate verifies actual skin weights against the declared binding, so the
metadata cannot be used as a substitute for real deformation. Eyelashes must also
remain spatially fitted to the corresponding eye and visibly follow the matching
blink. The lip region receives a skin-relative colour plus controlled moisture/
specular response instead of inheriting the generic face shader. Natural eyebrows
receive the saved eyebrow colour independently from hairstyle colour. When a player
selects a non-natural eyebrow style, V2 suppresses the authored natural-brow region
and rebuilds the saved brow style on the Head bone. Existing freckles, beauty marks
and weathering are also rebuilt on V2 without reapplying V1 face scaling, so V2
face-shape morphs remain authoritative.

PBR maps should use glTF metallic/roughness convention. Authored skin normal and
roughness maps always win. When either is missing, RockMundo supplies its
quality-scaled procedural pore/roughness fallback instead of replacing better
artist-authored detail.

## Rollout

1. Export masculine and feminine LOD0.
2. Mark manifest rows `asset_ready`.
3. Run `npm run validate:avatar-v2`.
4. Fix all contract errors and visual QA issues.
5. Export LOD1 and repeat.
6. Mark rows `validated` only after both automated and visual checks pass.
7. Enable the V2 rollout gate after clothing/tattoo compatibility is certified.

Until then the live fitting room and gig viewer automatically keep using Avatar
V1. There is no player-facing partial migration.


## Blender validation/export helper

A Blender-side gate is included so bad topology/rig exports can be rejected before
they reach the browser validator.

```bash
blender avatar.blend --background \
  --python scripts/avatar-v2/blender/rockmundo_avatar_v2_export.py -- \
  --frame masculine --lod 0 \
  --output public/avatar-v2/masculine/base-lod0.glb
```

The helper checks geometry budgets, one-armature structure, required humanoid and
close-up bones, facial morphs, material roles, unapplied/negative scale and the
four-influence skin-weight limit before invoking Blender's GLB exporter.


## Body regions for clothing

LOD0 and LOD1 base bodies must expose eight **skinned** occlusion regions. Either
name the objects `RMV2_Body_<Region>` or set the glTF/Blender custom property
`rockmundoBodyRegion` to one of:

`torso`, `upper-arms`, `lower-arms`, `hands`, `hips`, `upper-legs`,
`lower-legs`, `feet`.

These meshes must remain armature-bound **and must carry a skin material**. The
garment system hides only the regions declared by a validated garment, which
prevents body/clothing interpenetration without hiding unrelated skin. The skin
requirement also guarantees that Topless and the Tattoo Parlour's unclothed
inspection presentation never reveal a missing-body hole.

## Hand and instrument contact

Close-up V2 performers use all three authored joints per finger. Guitarists receive
different fretting chord shapes over time; guitar picking uses a thumb/index pinch
with a visible pick, while bass alternates index/middle plucking. Vocalists wrap
the microphone with the right-hand finger chain. Drummers use thumb/index as the
stick fulcrum and the stick origin follows that finger contact rather than only the
wrist centre.

The performer still retains wrist/arm IK and guitar body clearance. The post-pose
clearance envelope now includes every finger joint, preventing a distal fingertip
from passing through the instrument even when the wrist itself is outside the body.
Admin candidate QA samples the animation and reports finger-contact drift alongside
wrist grip and drumstick drift. It also verifies that both normalized eye bones are
present, produce visible deterministic gaze motion across the sampled performance,
and stay inside the close-up rotation envelope.

The first V2 clothing proof set and per-garment budgets are defined in
`public/avatar-v2/clothing/manifest.json`. Garment hardware and prints must be
part of a skinned mesh or be rigidly weighted to the appropriate bone; loose
unskinned detail objects fail validation.

Close-up garment materials also consume the existing Skin Store material metadata.
Export authored PBR maps whenever possible: those maps always win. For LOD0/LOD1,
RockMundo promotes eligible garment surfaces to physical shading and can supply a
quality-scaled textile normal only when no authored normal exists. Smooth
materials such as leather/vinyl/latex/silk/satin keep smooth/reflective response
rather than receiving generic cloth weave, and named hardware surfaces are left
out of the fabric fallback. LOD2/LOD3 retain the lower-cost standard material path.

Every validated body-worn garment must also export the same fitting morph names as
the base body: `bodySlim`, `bodyBroad`, `muscleToned`, `muscleAthletic`,
`muscleMuscular` and `muscleBodybuilder`. The runtime copies the selected body
build and muscle weights onto the garment after rebinding it to the avatar
skeleton. If a selected shaped body requires a morph that a garment does not
provide, Avatar V2 fails closed to V1 instead of rendering clipping/intersection.

LOD0/LOD1 body-worn garments must also include the pose-space correctives for the
regions they cover: shoulder/elbow targets for upper-body coverage and hip/knee
targets for lower-body coverage. Sleeves covering `upper-arms` must carry real
vertex weights for both upper-arm twist helpers; `lower-arms` coverage requires
both forearm twist helpers; `upper-legs` coverage requires both thigh twist
helpers. Skeleton names without meaningful vertex influence do not count. These
deformations are driven together with the base body by the same V2 performance
path.
