"""RockMundo Avatar V2 Blender validation/export helper.

Usage:
  blender avatar.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_export.py -- \
    --frame masculine --lod 0 \
    --output public/avatar-v2/masculine/base-lod0.glb

The script fails before export when a candidate violates the close-up rig,
morph, weighting or geometry budget. It does not generate a character; it
certifies an authored mesh for the RockMundo V2 import boundary.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

import bpy

BUDGETS = {
    0: {"triangles": 55_000, "vertices": 65_000, "bones": 96},
    1: {"triangles": 30_000, "vertices": 38_000, "bones": 96},
    2: {"triangles": 12_000, "vertices": 18_000, "bones": 80},
    3: {"triangles": 5_000, "vertices": 8_000, "bones": 64},
}

REQUIRED_BONES = {
    "hips": ["hips", "pelvis", "root_hips", "j_bip_c_hips"],
    "spine": ["spine", "spine1", "spine_01", "j_bip_c_spine"],
    "chest": ["chest", "spine2", "spine_02", "upperchest", "j_bip_c_chest"],
    "neck": ["neck", "neck1", "j_bip_c_neck"],
    "head": ["head", "j_bip_c_head"],
    "leftUpperArm": ["leftupperarm", "upperarm_l", "left_arm", "j_bip_l_upperarm"],
    "leftLowerArm": ["leftlowerarm", "lowerarm_l", "left_forearm", "j_bip_l_lowerarm"],
    "leftHand": ["lefthand", "hand_l", "left_hand", "j_bip_l_hand"],
    "rightUpperArm": ["rightupperarm", "upperarm_r", "right_arm", "j_bip_r_upperarm"],
    "rightLowerArm": ["rightlowerarm", "lowerarm_r", "right_forearm", "j_bip_r_lowerarm"],
    "rightHand": ["righthand", "hand_r", "right_hand", "j_bip_r_hand"],
    "leftUpperLeg": ["leftupperleg", "thigh_l", "left_thigh", "j_bip_l_upperleg"],
    "leftLowerLeg": ["leftlowerleg", "calf_l", "left_calf", "j_bip_l_lowerleg"],
    "leftFoot": ["leftfoot", "foot_l", "left_foot", "j_bip_l_foot"],
    "rightUpperLeg": ["rightupperleg", "thigh_r", "right_thigh", "j_bip_r_upperleg"],
    "rightLowerLeg": ["rightlowerleg", "calf_r", "right_calf", "j_bip_r_lowerleg"],
    "rightFoot": ["rightfoot", "foot_r", "right_foot", "j_bip_r_foot"],
}

CLOSEUP_BONES = {
    "leftShoulder": ["leftShoulder", "shoulder_l", "clavicle_l", "mixamorigLeftShoulder"],
    "rightShoulder": ["rightShoulder", "shoulder_r", "clavicle_r", "mixamorigRightShoulder"],
    "leftToes": ["leftToes", "toe_l", "toebase_l", "mixamorigLeftToeBase"],
    "rightToes": ["rightToes", "toe_r", "toebase_r", "mixamorigRightToeBase"],
    "leftThumb": ["leftThumbProximal", "leftHandThumb1", "thumb_01_l", "mixamorigLeftHandThumb1"],
    "leftIndex": ["leftIndexProximal", "leftHandIndex1", "index_01_l", "mixamorigLeftHandIndex1"],
    "leftMiddle": ["leftMiddleProximal", "leftHandMiddle1", "middle_01_l", "mixamorigLeftHandMiddle1"],
    "leftRing": ["leftRingProximal", "leftHandRing1", "ring_01_l", "mixamorigLeftHandRing1"],
    "leftLittle": ["leftLittleProximal", "leftHandPinky1", "pinky_01_l", "mixamorigLeftHandPinky1"],
    "rightThumb": ["rightThumbProximal", "rightHandThumb1", "thumb_01_r", "mixamorigRightHandThumb1"],
    "rightIndex": ["rightIndexProximal", "rightHandIndex1", "index_01_r", "mixamorigRightHandIndex1"],
    "rightMiddle": ["rightMiddleProximal", "rightHandMiddle1", "middle_01_r", "mixamorigRightHandMiddle1"],
    "rightRing": ["rightRingProximal", "rightHandRing1", "ring_01_r", "mixamorigRightHandRing1"],
    "rightLittle": ["rightLittleProximal", "rightHandPinky1", "pinky_01_r", "mixamorigRightHandPinky1"],
}

REQUIRED_EXPRESSIONS = {
    "blinkLeft": ["blinkLeft", "blink_l", "eyeBlinkLeft", "eye_blink_l"],
    "blinkRight": ["blinkRight", "blink_r", "eyeBlinkRight", "eye_blink_r"],
    "jawOpen": ["jawOpen", "jaw_open", "mouthOpen", "mouth_open"],
    "mouthSmile": ["mouthSmile", "mouth_smile", "smile"],
}

RECOMMENDED_EXPRESSIONS = [
    "visemeAA", "visemeEE", "visemeIH", "visemeOH", "visemeOU",
    "mouthFunnel", "mouthPucker",
    "eyeSquintLeft", "eyeSquintRight",
    "browInnerUp", "browDownLeft", "browDownRight",
    "cheekSquintLeft", "cheekSquintRight",
    "mouthStretchLeft", "mouthStretchRight",
]

REQUIRED_MUSCLE_MORPHS = [
    "muscleToned", "muscleAthletic", "muscleMuscular", "muscleBodybuilder",
]

CUSTOMIZATION_MORPHS = [
    "bodySlim", "bodyBroad",
    *REQUIRED_MUSCLE_MORPHS,
    "faceOval", "faceAngular", "faceSoft", "faceWide",
]

BODY_REGIONS = [
    "torso", "upper-arms", "lower-arms", "hands",
    "hips", "upper-legs", "lower-legs", "feet",
]

MATERIAL_ROLES = {
    "skin": re.compile(r"rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])", re.I),
    "eyes": re.compile(r"rmv2[_-]?eyes|(^|[_-])(eye|eyes|iris|cornea)($|[_-])", re.I),
    "teeth": re.compile(r"rmv2[_-]?teeth|teeth", re.I),
    "tongue": re.compile(r"rmv2[_-]?tongue|tongue", re.I),
}


def clean(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def has_alias(names: list[str], aliases: list[str]) -> bool:
    available = {clean(name) for name in names}
    return any(clean(alias) in available for alias in aliases)


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame", choices=["masculine", "feminine"], required=True)
    parser.add_argument("--lod", type=int, choices=[0, 1, 2, 3], required=True)
    parser.add_argument("--output", required=True)
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render]


def armatures() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE" and not obj.hide_render]


def count_geometry(meshes: list[bpy.types.Object]) -> tuple[int, int]:
    triangles = 0
    vertices = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            vertices += len(mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    return triangles, vertices


def shape_key_names(meshes: list[bpy.types.Object]) -> list[str]:
    result: list[str] = []
    for obj in meshes:
        keys = obj.data.shape_keys
        if not keys:
            continue
        result.extend(key.name for key in keys.key_blocks if key.name != "Basis")
    return result


def material_names(meshes: list[bpy.types.Object]) -> list[str]:
    result: list[str] = []
    for obj in meshes:
        for slot in obj.material_slots:
            if slot.material:
                result.append(slot.material.name)
    return result


def max_vertex_influences(meshes: list[bpy.types.Object]) -> tuple[int, str | None]:
    maximum = 0
    offender = None
    for obj in meshes:
        for vertex in obj.data.vertices:
            active = sum(1 for group in vertex.groups if group.weight > 0.0001)
            if active > maximum:
                maximum = active
                offender = f"{obj.name}:vertex:{vertex.index}"
    return maximum, offender


def validate(args: argparse.Namespace) -> tuple[list[str], list[str], dict[str, int]]:
    errors: list[str] = []
    warnings: list[str] = []
    meshes = mesh_objects()
    rigs = armatures()

    if not meshes:
        errors.append("No renderable mesh objects found.")
    if len(rigs) != 1:
        errors.append(f"Expected exactly one visible armature, found {len(rigs)}.")

    triangles, vertices = count_geometry(meshes) if meshes else (0, 0)
    bone_names = [bone.name for bone in rigs[0].data.bones] if len(rigs) == 1 else []
    morphs = shape_key_names(meshes)
    materials = material_names(meshes)
    budget = BUDGETS[args.lod]

    if triangles > budget["triangles"]:
        errors.append(f"Triangle budget exceeded: {triangles:,} > {budget['triangles']:,}.")
    if vertices > budget["vertices"]:
        errors.append(f"Vertex budget exceeded: {vertices:,} > {budget['vertices']:,}.")
    if len(bone_names) > budget["bones"]:
        errors.append(f"Bone budget exceeded: {len(bone_names)} > {budget['bones']}.")

    for semantic, aliases in REQUIRED_BONES.items():
        if not has_alias(bone_names, [semantic, *aliases]):
            errors.append(f"Missing required humanoid bone: {semantic}.")

    if args.lod <= 1:
        for semantic, aliases in CLOSEUP_BONES.items():
            if not has_alias(bone_names, aliases):
                errors.append(f"Missing close-up articulation bone: {semantic}.")

    # Topless and Tattoo Parlour can select any LOD, so every export must remain a
    # complete skinned bare body. Close-up-only articulation stays gated above.
    authored_regions = set()
    unskinned_regions = set()
    bare_skin_regions = set()
    for obj in meshes:
        matched_regions = set()
        explicit = str(obj.get("rockmundoBodyRegion", "")).lower()
        if explicit in BODY_REGIONS:
            matched_regions.add(explicit)
        cleaned_name = clean(obj.name)
        for region in BODY_REGIONS:
            cleaned_region = clean(region)
            if f"rmv2body{cleaned_region}" in cleaned_name or f"body{cleaned_region}" in cleaned_name:
                matched_regions.add(region)
        object_materials = [slot.material.name for slot in obj.material_slots if slot.material]
        for region in matched_regions:
            authored_regions.add(region)
            if not any(modifier.type == "ARMATURE" for modifier in obj.modifiers):
                unskinned_regions.add(region)
            if any(MATERIAL_ROLES["skin"].search(name) for name in object_materials):
                bare_skin_regions.add(region)
    for region in BODY_REGIONS:
        if region not in authored_regions:
            errors.append(f"Missing garment-occlusion body region mesh: {region}.")
        elif region in unskinned_regions:
            errors.append(f"Garment-occlusion body region has no Armature modifier: {region}.")
        elif region not in bare_skin_regions:
            errors.append(f"Body region has no skin material for topless/tattoo preview: {region}.")

    for morph in REQUIRED_MUSCLE_MORPHS:
        if not has_alias(morphs, [morph]):
            errors.append(f"Missing required muscle definition target: {morph}.")

    for expression, aliases in REQUIRED_EXPRESSIONS.items():
        if not has_alias(morphs, [expression, *aliases]):
            if args.lod <= 1:
                errors.append(f"Missing required facial target: {expression}.")
            else:
                warnings.append(f"Missing distant-LOD facial target: {expression}.")

    if args.lod <= 1:
        for expression in RECOMMENDED_EXPRESSIONS:
            if not has_alias(morphs, [expression]):
                warnings.append(f"Missing recommended singing target: {expression}.")
        for morph in CUSTOMIZATION_MORPHS:
            if morph in REQUIRED_MUSCLE_MORPHS:
                continue
            if not has_alias(morphs, [morph]):
                warnings.append(f"Missing Avatar Designer shape target: {morph}.")

    if args.lod <= 1:
        for role in ("skin", "eyes"):
            if not any(MATERIAL_ROLES[role].search(name) for name in materials):
                errors.append(f"Missing named close-up material role: {role}.")
    if args.lod == 0:
        for role in ("teeth", "tongue"):
            if not any(MATERIAL_ROLES[role].search(name) for name in materials):
                errors.append(f"LOD0 needs separate {role} geometry/material.")
    elif args.lod == 1:
        for role in ("teeth", "tongue"):
            if not any(MATERIAL_ROLES[role].search(name) for name in materials):
                warnings.append(f"LOD1 should retain separate {role} geometry/material.")

    influences, offender = max_vertex_influences(meshes)
    if influences > 4:
        errors.append(f"Skin weighting exceeds 4 influences ({influences}) at {offender}.")

    for obj in [*meshes, *rigs]:
        scale = obj.scale
        if scale.x <= 0 or scale.y <= 0 or scale.z <= 0:
            errors.append(f"{obj.name} uses zero/negative object scale {tuple(round(v, 4) for v in scale)}.")
        if max(scale) - min(scale) > 0.001:
            errors.append(f"{obj.name} has unapplied non-uniform scale {tuple(round(v, 4) for v in scale)}.")

    return errors, warnings, {
        "triangles": triangles,
        "vertices": vertices,
        "bones": len(bone_names),
        "morphs": len(morphs),
        "materials": len(set(materials)),
        "max_influences": influences,
    }


def export_glb(args: argparse.Namespace) -> None:
    output = pathlib.Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [*mesh_objects(), *armatures()]
    for obj in export_objects:
        obj.select_set(True)
    if armatures():
        bpy.context.view_layer.objects.active = armatures()[0]
        armatures()[0]["rockmundoAvatarV2"] = {
            "version": "2.0",
            "frame": args.frame,
            "lod": args.lod,
        }

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_morph=True,
        export_yup=True,
    )
    print(f"[avatar-v2/blender] Exported {output}")


def main() -> int:
    args = cli_args()
    errors, warnings, stats = validate(args)

    print(
        "[avatar-v2/blender] "
        f"{args.frame} LOD{args.lod}: {stats['triangles']:,} tris, "
        f"{stats['vertices']:,} vertices, {stats['bones']} bones, "
        f"{stats['morphs']} morphs, max {stats['max_influences']} weights/vertex"
    )
    for warning in warnings:
        print(f"[avatar-v2/blender] WARN: {warning}")
    for error in errors:
        print(f"[avatar-v2/blender] ERROR: {error}")

    if errors:
        print("[avatar-v2/blender] Export blocked. Fix the errors above.")
        return 2

    export_glb(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
