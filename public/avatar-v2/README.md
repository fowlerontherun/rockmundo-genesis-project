# RockMundo Avatar V2 assets

This directory is the import boundary for the replacement avatar mesh system.

Do **not** put experimental meshes into the live `gig-demo-3d` asset family. V2
assets must pass the repository contract before their manifest status can move to
`validated`.

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
surface for fitting. At least one close-up skinned head/face mesh should either:

- use a name beginning with `RMV2_Head` or `RMV2_Face`; or
- set `rockmundoHeadSurface=true` in node extras/userData.

Keep the visible scalp/face skin in that surface and use a named skin material
such as `RMV2_Skin`. If a player uses a non-original saved hairstyle, a
separate authored hair mesh/material such as `RMV2_Hair` can be suppressed
cleanly before the selected hairstyle is rebuilt.

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
definition. This separation is required so Topless, Tattoo Parlour close-ups and
garment fitting all share the same body.

## Facial contract

LOD0/LOD1 require morph targets equivalent to:

- blinkLeft
- blinkRight
- jawOpen
- mouthSmile

LOD0/LOD1 should include mouth funnel/pucker plus AA, EE, IH, OH and OU visemes;
the stage renderer blends neighbouring visemes rather than snapping between them.
For expressive close-ups, also author `eyeSquintLeft/Right`, `browInnerUp`,
`browDownLeft/Right`, `cheekSquintLeft/Right` and
`mouthStretchLeft/Right`. These are driven from vocal opening and performance
energy so strong choruses engage the cheeks/eyes/brows as well as the jaw while
quieter passages remain subtle. Additional frown targets are still encouraged.
Eye direction is handled by the dedicated eye bones, keeping gaze independent from
blink/squint facial morphs. Teeth and tongue must be separate at LOD0 so close-up
vocals never expose a hollow mouth.

LOD0/LOD1 also require shoulder and toe-base articulation, dedicated `Eye.L` /
`Eye.R` bones, plus complete three-joint thumb/index/middle/ring/little chains
on both hands. Both eye bones must be children/descendants of the authored head bone so head turns
carry the eyes with them. They are driven at runtime for deterministic micro-saccades
and interaction-aware gaze; do not bake a permanently offset stare into the mesh.
They also require
the eight pose-space joint deformation targets `poseShoulderLeft/Right`,
`poseElbowLeft/Right`, `poseHipLeft/Right` and `poseKneeLeft/Right`.
These preserve joint volume after the final live IK pose rather than relying on
linear skinning alone. Common Blender,
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
- `RMV2_Hair`
- `RMV2_Teeth`
- `RMV2_Tongue`
- `RMV2_MouthInterior`

LOD0 now requires separate cornea, teeth, tongue and mouth-interior roles; LOD1
warns when they are missing. This prevents close-up singing from showing flat
painted eyes or a hollow mouth cavity. The runtime promotes cornea surfaces to a
physical material where needed, uses a realistic eye IOR/clearcoat response, gives
sclera a slightly warm white, and treats teeth/tongue/interior separately.

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

Every validated body-worn garment must also export the same fitting morph names as
the base body: `bodySlim`, `bodyBroad`, `muscleToned`, `muscleAthletic`,
`muscleMuscular` and `muscleBodybuilder`. The runtime copies the selected body
build and muscle weights onto the garment after rebinding it to the avatar
skeleton. If a selected shaped body requires a morph that a garment does not
provide, Avatar V2 fails closed to V1 instead of rendering clipping/intersection.

LOD0/LOD1 body-worn garments must also include the pose-space correctives for the
regions they cover: shoulder/elbow targets for upper-body coverage and hip/knee
targets for lower-body coverage. These morphs are driven together with the base
body by the same V2 performance controller.
