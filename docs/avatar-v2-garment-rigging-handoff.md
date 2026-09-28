# Avatar V2: garment rigging handoff (15 staged blockouts)

Status: **authoring only**. Do not set any garment or body asset to `validated` or enable the V2 rollout on the basis of the staged blockouts, planar UVs, generated textures, or an unfitted rig guide.

## Existing body reference path

The repository already has a reproducible real-source route; a new invented body rig is not needed:

1. Run the [real-source seed workflow](../../.github/workflows/avatar-v2-real-source-seeds.yml) to fetch the pinned CC0 source and build separate masculine and feminine authoring scenes. Artifacts expire after 14 days.
2. Open each `*-unfitted-rig-guide.blend` or `*-joint-handles.blend`. The `RMV2_Armature` is a **guide**, not a skin-weighted production body. Use `scripts/avatar-v2/blender/rockmundo_avatar_v2_fit_rig.py` to move and apply artist-reviewed joint handles. Do not confuse the partial head-rig experiment with a fully skinned body.
3. Bind and paint the **body first** for both frames. Verify the required bones in `src/features/player-model/v2/avatarV2Contract.ts`, plus close-up and twist requirements. Prove shoulder, elbow, wrist, hip, knee, ankle and finger deformation in the game's performance poses.
4. Only then transfer weights from the *fitted, fully weighted* matching frame to clothing, correct penetration and weight gradients, and produce the four real LODs for each frame. Do not duplicate one LOD under four filenames.

## Garment-specific fitting work

| Family | Staged items | Main fit and motion checks |
|---|---|---|
| Tees | plain black, plain white, RockMundo logo, vintage charcoal | Shoulder/armpit and elbow reach, torso twist, logo distortion |
| Jeans | black straight, blue straight, dark slim | Pelvis/knee deformation, seated/drumming poses, boot overlap |
| Footwear | black boots, brown boots, canvas trainers, combat boots | Foot/ankle rotation, sole-ground contact, leg penetration |
| Punk | double-eyelet belt, patch jacket, safety-pin tee, studded wrist cuffs | Belt waist attachment; jacket sleeve and shoulder clearance; pin/patch anchoring; cuffs follow left/right wrists |

**Important:** The 15 staged GLBs are low-detail static blockouts. Automatically planar-projected UVs and procedural maps are for inspection, not finished authored UV atlases. Belts and wrist cuffs require attachment-specific handling; do not blindly transfer torso weights to wrist accessories.

## Evidence required for each garment

- Source `.blend` with editable geometry, authored UVs, embedded or traceable PBR textures and the matching fitted body-frame reference.
- GLB for each **distinct** frame/LOD path matching `avatar-v2/clothing/...-lod0.glb` through `-lod3.glb`; inspect the full manifest contract in `avatarV2Garments.ts`.
- Real glTF `skins`, `JOINTS_0`, `WEIGHTS_0`, skeleton name mapping and at most four meaningful influences per vertex.
- Front/side/back and animation-pose screenshots for **both** frames, including close shots of text, pins, cuffs and footwear.
- Occluded body regions, triangle/vertex/bone/texture budget report for each LOD, and explicit human sign-off on clipping and material placement.

Keep the private admin staging review separate from gameplay. A textured preview or successful GLB parse is not proof of fit, skeleton compatibility or animation quality.
