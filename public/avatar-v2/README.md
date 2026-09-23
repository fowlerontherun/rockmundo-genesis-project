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

## Facial contract

LOD0/LOD1 require morph targets equivalent to:

- blinkLeft
- blinkRight
- jawOpen
- mouthSmile

Additional expressions are encouraged: frown, brow up/down and eye look directions.
LOD0/LOD1 should include mouth funnel/pucker plus AA, EE, IH, OH and OU visemes;
the stage renderer already drives those targets during singing. Teeth and tongue
must be separate at LOD0 so close-up vocals never expose a hollow mouth.

LOD0/LOD1 also require shoulder, toe-base and all five proximal finger bones on
both hands. This is deliberate: the new mesh system must improve guitar, bass,
drumstick and microphone grips rather than only increasing face resolution.

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
- `RMV2_Eyes`
- `RMV2_Hair`
- `RMV2_Teeth`
- `RMV2_Tongue`

PBR maps should use glTF metallic/roughness convention. Skin/hair/eyes receive
additional runtime physical-material treatment.

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
