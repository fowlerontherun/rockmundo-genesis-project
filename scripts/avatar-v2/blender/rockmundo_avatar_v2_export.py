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
      "leftShoulder": ["leftShoulder","shoulder_l","clavicle_l","mixamorigLeftShoulder"],
      "rightShoulder": ["rightShoulder","shoulder_r","clavicle_r","mixamorigRightShoulder"],
      "leftToes": ["leftToes","toe_l","toebase_l","mixamorigLeftToeBase"],
      "rightToes": ["rightToes","toe_r","toebase_r","mixamorigRightToeBase"],
      "leftEye": ["Eye.L","leftEye","eye_l","mixamorigLeftEye","j_bip_l_eye"],
      "rightEye": ["Eye.R","rightEye","eye_r","mixamorigRightEye","j_bip_r_eye"],
      "jaw": ["Jaw","jaw","jaw_bone","mixamorigJaw","j_bip_c_jaw"],
      "leftEarAnchor": ["EarAnchor.L","leftEarAnchor","ear_anchor_l","earring_anchor_l"],
      "rightEarAnchor": ["EarAnchor.R","rightEarAnchor","ear_anchor_r","earring_anchor_r"],
      "leftUpperArmTwist": ["UpperArmTwist.L","upperarm_twist_l","upper_arm_twist_l","leftUpperArmTwist"],
      "rightUpperArmTwist": ["UpperArmTwist.R","upperarm_twist_r","upper_arm_twist_r","rightUpperArmTwist"],
      "leftForearmTwist": ["ForearmTwist.L","forearm_twist_l","lowerarm_twist_l","leftForearmTwist"],
      "rightForearmTwist": ["ForearmTwist.R","forearm_twist_r","lowerarm_twist_r","rightForearmTwist"],
      "leftThighTwist": ["ThighTwist.L","thigh_twist_l","upperleg_twist_l","leftThighTwist"],
      "rightThighTwist": ["ThighTwist.R","thigh_twist_r","upperleg_twist_r","rightThighTwist"],

      "leftThumb1": ["Thumb1.L","leftThumbProximal","leftHandThumb1","thumb_01_l","mixamorigLeftHandThumb1"],
      "leftThumb2": ["Thumb2.L","leftThumbIntermediate","leftHandThumb2","thumb_02_l","mixamorigLeftHandThumb2"],
      "leftThumb3": ["Thumb3.L","leftThumbDistal","leftHandThumb3","thumb_03_l","mixamorigLeftHandThumb3"],
      "leftIndex1": ["Index1.L","leftIndexProximal","leftHandIndex1","index_01_l","mixamorigLeftHandIndex1"],
      "leftIndex2": ["Index2.L","leftIndexIntermediate","leftHandIndex2","index_02_l","mixamorigLeftHandIndex2"],
      "leftIndex3": ["Index3.L","leftIndexDistal","leftHandIndex3","index_03_l","mixamorigLeftHandIndex3"],
      "leftMiddle1": ["Middle1.L","leftMiddleProximal","leftHandMiddle1","middle_01_l","mixamorigLeftHandMiddle1"],
      "leftMiddle2": ["Middle2.L","leftMiddleIntermediate","leftHandMiddle2","middle_02_l","mixamorigLeftHandMiddle2"],
      "leftMiddle3": ["Middle3.L","leftMiddleDistal","leftHandMiddle3","middle_03_l","mixamorigLeftHandMiddle3"],
      "leftRing1": ["Ring1.L","leftRingProximal","leftHandRing1","ring_01_l","mixamorigLeftHandRing1"],
      "leftRing2": ["Ring2.L","leftRingIntermediate","leftHandRing2","ring_02_l","mixamorigLeftHandRing2"],
      "leftRing3": ["Ring3.L","leftRingDistal","leftHandRing3","ring_03_l","mixamorigLeftHandRing3"],
      "leftLittle1": ["Pinky1.L","leftLittleProximal","leftHandPinky1","pinky_01_l","mixamorigLeftHandPinky1"],
      "leftLittle2": ["Pinky2.L","leftLittleIntermediate","leftHandPinky2","pinky_02_l","mixamorigLeftHandPinky2"],
      "leftLittle3": ["Pinky3.L","leftLittleDistal","leftHandPinky3","pinky_03_l","mixamorigLeftHandPinky3"],

      "rightThumb1": ["Thumb1.R","rightThumbProximal","rightHandThumb1","thumb_01_r","mixamorigRightHandThumb1"],
      "rightThumb2": ["Thumb2.R","rightThumbIntermediate","rightHandThumb2","thumb_02_r","mixamorigRightHandThumb2"],
      "rightThumb3": ["Thumb3.R","rightThumbDistal","rightHandThumb3","thumb_03_r","mixamorigRightHandThumb3"],
      "rightIndex1": ["Index1.R","rightIndexProximal","rightHandIndex1","index_01_r","mixamorigRightHandIndex1"],
      "rightIndex2": ["Index2.R","rightIndexIntermediate","rightHandIndex2","index_02_r","mixamorigRightHandIndex2"],
      "rightIndex3": ["Index3.R","rightIndexDistal","rightHandIndex3","index_03_r","mixamorigRightHandIndex3"],
      "rightMiddle1": ["Middle1.R","rightMiddleProximal","rightHandMiddle1","middle_01_r","mixamorigRightHandMiddle1"],
      "rightMiddle2": ["Middle2.R","rightMiddleIntermediate","rightHandMiddle2","middle_02_r","mixamorigRightHandMiddle2"],
      "rightMiddle3": ["Middle3.R","rightMiddleDistal","rightHandMiddle3","middle_03_r","mixamorigRightHandMiddle3"],
      "rightRing1": ["Ring1.R","rightRingProximal","rightHandRing1","ring_01_r","mixamorigRightHandRing1"],
      "rightRing2": ["Ring2.R","rightRingIntermediate","rightHandRing2","ring_02_r","mixamorigRightHandRing2"],
      "rightRing3": ["Ring3.R","rightRingDistal","rightHandRing3","ring_03_r","mixamorigRightHandRing3"],
      "rightLittle1": ["Pinky1.R","rightLittleProximal","rightHandPinky1","pinky_01_r","mixamorigRightHandPinky1"],
      "rightLittle2": ["Pinky2.R","rightLittleIntermediate","rightHandPinky2","pinky_02_r","mixamorigRightHandPinky2"],
      "rightLittle3": ["Pinky3.R","rightLittleDistal","rightHandPinky3","pinky_03_r","mixamorigRightHandPinky3"],
}

REQUIRED_EXPRESSIONS = {
    "blinkLeft": ["blinkLeft", "blink_l", "eyeBlinkLeft", "eye_blink_l"],
    "blinkRight": ["blinkRight", "blink_r", "eyeBlinkRight", "eye_blink_r"],
    "jawOpen": ["jawOpen", "jaw_open", "mouthOpen", "mouth_open"],
    "mouthSmile": ["mouthSmile", "mouth_smile", "smile"],
}

CLOSEUP_REQUIRED_EXPRESSIONS = [
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

POSE_CORRECTIVE_MORPHS = [
    "poseShoulderLeft", "poseShoulderRight",
    "poseElbowLeft", "poseElbowRight",
    "poseHipLeft", "poseHipRight",
    "poseKneeLeft", "poseKneeRight",
]

MORPH_MIN_DELTA_METRES = 0.0005

BODY_REGIONS = [
    "torso", "upper-arms", "lower-arms", "hands",
    "hips", "upper-legs", "lower-legs", "feet",
]

MATERIAL_ROLES = {
    "skin": re.compile(r"rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])", re.I),
    "eyes": re.compile(r"rmv2[_-]?eyes|(^|[_-])(eye|eyes|iris|sclera|cornea)($|[_-])", re.I),
    "iris": re.compile(r"rmv2[_-]?iris|(^|[_-])iris($|[_-])", re.I),
    "sclera": re.compile(r"rmv2[_-]?sclera|(^|[_-])sclera($|[_-])", re.I),
    "cornea": re.compile(r"rmv2[_-]?cornea|cornea|eye[_-]?(shell|surface)|ocular[_-]?shell", re.I),
    "wetline": re.compile(r"rmv2[_-]?(wetline|tearline|waterline)|(^|[_-])(wetline|tearline|waterline)($|[_-])", re.I),
    "teeth": re.compile(r"rmv2[_-]?teeth|teeth", re.I),
    "tongue": re.compile(r"rmv2[_-]?tongue|tongue", re.I),
    "mouthInterior": re.compile(r"rmv2[_-]?mouth[_-]?(interior|cavity)|oral[_-]?cavity|inner[_-]?mouth", re.I),
}

SURFACE_NODE_PATTERNS = {
    "iris": re.compile(r"rmv2[_-]?(iris|eye[_-]?iris)|(^|[_-])iris($|[_-])", re.I),
    "sclera": re.compile(r"rmv2[_-]?(sclera|eye[_-]?white)|(^|[_-])sclera($|[_-])", re.I),
    "cornea": re.compile(r"rmv2[_-]?(cornea|eye[_-]?(shell|surface))|ocular[_-]?shell", re.I),
    "wetline": re.compile(r"rmv2[_-]?(wetline|tearline|waterline)|(^|[_-])(wetline|tearline|waterline)($|[_-])", re.I),
    "teeth": re.compile(r"rmv2[_-]?(?:(?:upper|lower)[_-]?)?(teeth|tooth)|(^|[_-])teeth($|[_-])", re.I),
    "tongue": re.compile(r"rmv2[_-]?tongue|(^|[_-])tongue($|[_-])", re.I),
    "mouthInterior": re.compile(r"rmv2[_-]?mouth[_-]?(interior|cavity)|oral[_-]?cavity|inner[_-]?mouth", re.I),
}

SURFACE_BINDING_ALIASES = {
    "Head": ["Head", "head", *REQUIRED_BONES["head"]],
    "Jaw": CLOSEUP_BONES["jaw"],
    "Eye.L": CLOSEUP_BONES["leftEye"],
    "Eye.R": CLOSEUP_BONES["rightEye"],
}

REQUIRED_SURFACE_BINDINGS = {
    "iris": ("Eye.L", "Eye.R"),
    "sclera": ("Eye.L", "Eye.R"),
    "cornea": ("Eye.L", "Eye.R"),
    "wetline": ("Head",),
    "teeth": ("Head", "Jaw"),
    "tongue": ("Jaw",),
    "mouthInterior": ("Head",),
}


def clean(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def canonical_surface_binding(value: str) -> str | None:
    wanted = clean(str(value))
    for binding, aliases in SURFACE_BINDING_ALIASES.items():
        if any(clean(alias) == wanted for alias in aliases):
            return binding
    return None


def object_has_bone_influence(obj: bpy.types.Object, aliases: list[str]) -> bool:
    if not any(
        modifier.type == "ARMATURE" and modifier.object is not None
        for modifier in obj.modifiers
    ):
        return False
    wanted = {clean(alias) for alias in aliases}
    group_indexes = {
        group.index for group in obj.vertex_groups
        if clean(group.name) in wanted
    }
    if not group_indexes:
        return False
    return any(
        assignment.group in group_indexes and assignment.weight > 0.01
        for vertex in obj.data.vertices
        for assignment in vertex.groups
    )


def surface_eye_side(obj: bpy.types.Object) -> str | None:
    explicit = clean(str(obj.get("rockmundoEyeSide", "")))
    if explicit in {"l", "left"}:
        return "L"
    if explicit in {"r", "right"}:
        return "R"
    if re.search(r"(?:[._-]l|left)$", obj.name, re.I):
        return "L"
    if re.search(r"(?:[._-]r|right)$", obj.name, re.I):
        return "R"
    return None


def object_shape_key_max_delta(obj: bpy.types.Object, aliases: list[str]) -> float:
    return shape_key_max_delta([obj], aliases)


def object_axis_span(obj: bpy.types.Object, axis: int) -> float:
    if not obj.data.vertices:
        return 0.0
    values = [vertex.co[axis] for vertex in obj.data.vertices]
    return max(values) - min(values)


def has_alias(names: list[str], aliases: list[str]) -> bool:
    available = {clean(name) for name in names}
    return any(clean(alias) in available for alias in aliases)


def body_region_from_material(material: bpy.types.Material | None) -> str | None:
    if material is None:
        return None
    explicit = str(material.get("rockmundoBodyRegion", "")).lower()
    if explicit in BODY_REGIONS:
        return explicit
    name = clean(material.name)
    for region in BODY_REGIONS:
        token = clean(region)
        if (
            f"rmv2skin{token}" in name
            or f"rmv2bodyregion{token}" in name
            or name == f"skin{token}"
        ):
            return region
    return None


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


def shape_key_max_delta(meshes: list[bpy.types.Object], aliases: list[str]) -> float:
    wanted = {clean(alias) for alias in aliases}
    maximum = 0.0
    for obj in meshes:
        keys = obj.data.shape_keys
        if not keys:
            continue
        basis = keys.key_blocks.get("Basis")
        if basis is None:
            continue
        for key in keys.key_blocks:
            if key.name == "Basis" or clean(key.name) not in wanted:
                continue
            count = min(len(basis.data), len(key.data))
            for index in range(count):
                maximum = max(maximum, (key.data[index].co - basis.data[index].co).length)
    return maximum


def require_shape_key_deformation(
    errors: list[str],
    warnings: list[str],
    meshes: list[bpy.types.Object],
    label: str,
    aliases: list[str],
    *,
    error: bool,
) -> None:
    delta = shape_key_max_delta(meshes, aliases)
    if delta >= MORPH_MIN_DELTA_METRES:
        return
    message = (
        f"{label} exists but deforms by only {delta * 1000:.3f}mm; "
        f"minimum meaningful delta is {MORPH_MIN_DELTA_METRES * 1000:.1f}mm."
    )
    (errors if error else warnings).append(message)


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
    dedicated_surface_roles = set()
    dedicated_surface_bindings = {
        role: set() for role in SURFACE_NODE_PATTERNS
    }
    wetline_sides = set()
    wetline_blink_deltas = {"L": 0.0, "R": 0.0}
    mouth_interior_depth = 0.0
    for obj in meshes:
        used_material_indices = {polygon.material_index for polygon in obj.data.polygons}
        used_materials = [
            obj.material_slots[index].material
            for index in used_material_indices
            if index < len(obj.material_slots) and obj.material_slots[index].material
        ]
        explicit_role = clean(str(obj.get("rockmundoSurfaceRole", "")))
        for role, pattern in SURFACE_NODE_PATTERNS.items():
            named_for_role = explicit_role == clean(role) or pattern.search(obj.name)
            if named_for_role and len(obj.data.vertices) > 0 and any(
                MATERIAL_ROLES[role].search(material.name) for material in used_materials
            ):
                dedicated_surface_roles.add(role)
                binding = canonical_surface_binding(obj.get("rockmundoBoneBinding", ""))
                if binding and object_has_bone_influence(obj, SURFACE_BINDING_ALIASES[binding]):
                    dedicated_surface_bindings[role].add(binding)

                if role == "wetline":
                    side = surface_eye_side(obj)
                    if side:
                        wetline_sides.add(side)
                        blink_name = "blinkLeft" if side == "L" else "blinkRight"
                        wetline_blink_deltas[side] = max(
                            wetline_blink_deltas[side],
                            object_shape_key_max_delta(obj, [blink_name]),
                        )
                elif role == "mouthInterior":
                    mouth_interior_depth = max(
                        mouth_interior_depth,
                        object_axis_span(obj, 2),
                    )
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

        if len(rigs) == 1:
            rig_bones = rigs[0].data.bones

            def find_bone(aliases):
                wanted = {clean(alias) for alias in aliases}
                return next((bone for bone in rig_bones if clean(bone.name) in wanted), None)

            head_bone = find_bone(["head", *REQUIRED_BONES["head"]])
            for semantic in ("leftEye", "rightEye"):
                eye_bone = find_bone(CLOSEUP_BONES[semantic])
                if not head_bone or not eye_bone:
                    continue
                parent = eye_bone.parent
                while parent and parent != head_bone:
                    parent = parent.parent
                if parent != head_bone:
                    errors.append(f"{semantic} must inherit from the head bone.")

            jaw_bone = find_bone(CLOSEUP_BONES["jaw"])
            if head_bone and jaw_bone:
                parent = jaw_bone.parent
                while parent and parent != head_bone:
                    parent = parent.parent
                if parent != head_bone:
                    errors.append("Jaw must inherit from the head bone.")

            for semantic in ("leftEarAnchor", "rightEarAnchor"):
                anchor_bone = find_bone(CLOSEUP_BONES[semantic])
                if not head_bone or not anchor_bone:
                    continue
                parent = anchor_bone.parent
                while parent and parent != head_bone:
                    parent = parent.parent
                if parent != head_bone:
                    errors.append(f"{semantic} must inherit from the head bone.")

            chest_bone = find_bone(["chest", *REQUIRED_BONES["chest"]])
            shoulder_hierarchy = (
                ("leftShoulder", "leftUpperArm"),
                ("rightShoulder", "rightUpperArm"),
            )
            for shoulder_semantic, arm_semantic in shoulder_hierarchy:
                shoulder_bone = find_bone(CLOSEUP_BONES[shoulder_semantic])
                upper_arm = find_bone([arm_semantic, *REQUIRED_BONES[arm_semantic]])
                if shoulder_bone and chest_bone:
                    parent = shoulder_bone.parent
                    while parent and parent != chest_bone:
                        parent = parent.parent
                    if parent != chest_bone:
                        errors.append(f"{shoulder_semantic} must inherit from the chest bone.")
                if shoulder_bone and upper_arm:
                    parent = upper_arm.parent
                    while parent and parent != shoulder_bone:
                        parent = parent.parent
                    if parent != shoulder_bone:
                        errors.append(f"{arm_semantic} must inherit from {shoulder_semantic}.")

            toe_hierarchy = (
                ("leftToes", "leftFoot"),
                ("rightToes", "rightFoot"),
            )
            for toe_semantic, foot_semantic in toe_hierarchy:
                toe_bone = find_bone(CLOSEUP_BONES[toe_semantic])
                foot_bone = find_bone([foot_semantic, *REQUIRED_BONES[foot_semantic]])
                if not toe_bone or not foot_bone:
                    continue
                parent = toe_bone.parent
                while parent and parent != foot_bone:
                    parent = parent.parent
                if parent != foot_bone:
                    errors.append(f"{toe_semantic} must inherit from {foot_semantic}.")

            twist_parents = {
                "leftUpperArmTwist": "leftUpperArm",
                "rightUpperArmTwist": "rightUpperArm",
                "leftForearmTwist": "leftLowerArm",
                "rightForearmTwist": "rightLowerArm",
                "leftThighTwist": "leftUpperLeg",
                "rightThighTwist": "rightUpperLeg",
            }
            for semantic, parent_semantic in twist_parents.items():
                helper = find_bone(CLOSEUP_BONES[semantic])
                parent_bone = find_bone([parent_semantic, *REQUIRED_BONES[parent_semantic]])
                if not helper or not parent_bone:
                    continue
                parent = helper.parent
                while parent and parent != parent_bone:
                    parent = parent.parent
                if parent != parent_bone:
                    errors.append(f"{semantic} must inherit from {parent_semantic}.")

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
        used_material_indices = {polygon.material_index for polygon in obj.data.polygons}
        used_materials = [
            obj.material_slots[index].material
            for index in used_material_indices
            if index < len(obj.material_slots) and obj.material_slots[index].material
        ]
        object_materials = [material.name for material in used_materials]

        for material in used_materials:
            material_region = body_region_from_material(material)
            if material_region:
                matched_regions.add(material_region)
                if MATERIAL_ROLES["skin"].search(material.name):
                    bare_skin_regions.add(material_region)

        for region in matched_regions:
            authored_regions.add(region)
            if not any(
                modifier.type == "ARMATURE" and modifier.object is not None
                for modifier in obj.modifiers
            ):
                unskinned_regions.add(region)
            if any(MATERIAL_ROLES["skin"].search(name) for name in object_materials):
                if region == str(obj.get("rockmundoBodyRegion", "")).lower() or (
                    f"rmv2body{clean(region)}" in cleaned_name
                    or f"body{clean(region)}" in cleaned_name
                ):
                    bare_skin_regions.add(region)
    for region in BODY_REGIONS:
        if region not in authored_regions:
            errors.append(f"Missing garment-occlusion body region: {region}.")
        elif region in unskinned_regions:
            errors.append(f"Garment-occlusion body region has no Armature modifier: {region}.")
        elif region not in bare_skin_regions:
            errors.append(f"Body region has no skin material for topless/tattoo preview: {region}.")

    for morph in REQUIRED_MUSCLE_MORPHS:
        aliases = [morph]
        if not has_alias(morphs, aliases):
            errors.append(f"Missing required muscle definition target: {morph}.")
        else:
            require_shape_key_deformation(
                errors, warnings, meshes, f"Muscle target {morph}", aliases, error=True,
            )

    for expression, aliases in REQUIRED_EXPRESSIONS.items():
        candidates = [expression, *aliases]
        if not has_alias(morphs, candidates):
            if args.lod <= 1:
                errors.append(f"Missing required facial target: {expression}.")
            else:
                warnings.append(f"Missing distant-LOD facial target: {expression}.")
        else:
            require_shape_key_deformation(
                errors,
                warnings,
                meshes,
                f"Facial target {expression}",
                candidates,
                error=args.lod <= 1,
            )

    if args.lod <= 1:
        for expression in CLOSEUP_REQUIRED_EXPRESSIONS:
            aliases = [expression]
            if not has_alias(morphs, aliases):
                errors.append(f"Missing required close-up singing target: {expression}.")
            else:
                require_shape_key_deformation(
                    errors, warnings, meshes, f"Singing target {expression}", aliases, error=True,
                )
        for morph in CUSTOMIZATION_MORPHS:
            if morph in REQUIRED_MUSCLE_MORPHS:
                continue
            aliases = [morph]
            if not has_alias(morphs, aliases):
                warnings.append(f"Missing Avatar Designer shape target: {morph}.")
            else:
                require_shape_key_deformation(
                    errors, warnings, meshes, f"Avatar Designer target {morph}", aliases, error=False,
                )
        for corrective in POSE_CORRECTIVE_MORPHS:
            aliases = [corrective]
            if not has_alias(morphs, aliases):
                errors.append(f"Missing required close-up pose corrective: {corrective}.")
            else:
                require_shape_key_deformation(
                    errors, warnings, meshes, f"Pose corrective {corrective}", aliases, error=True,
                )

    if args.lod <= 1:
        for role in ("skin", "eyes"):
            if not any(MATERIAL_ROLES[role].search(name) for name in materials):
                errors.append(f"Missing named close-up material role: {role}.")
    if args.lod == 0:
        for role in ("iris", "sclera", "cornea", "wetline", "teeth", "tongue", "mouthInterior"):
            if role not in dedicated_surface_roles:
                errors.append(
                    f"LOD0 needs dedicated {role} geometry using its matching material role; "
                    "an extra material slot on another mesh is not sufficient."
                )
                continue
            for binding in REQUIRED_SURFACE_BINDINGS[role]:
                if binding not in dedicated_surface_bindings[role]:
                    errors.append(
                        f"LOD0 {role} needs rockmundoBoneBinding={binding} plus real "
                        f"{binding} vertex-group influence."
                    )
        for side in ("L", "R"):
            if side not in wetline_sides:
                errors.append(f"LOD0 needs a dedicated {side} eyelid wetline surface.")
            elif wetline_blink_deltas[side] < 0.00015:
                blink_name = "blinkLeft" if side == "L" else "blinkRight"
                errors.append(
                    f"LOD0 wetline {side} must deform with {blink_name}; "
                    f"measured {wetline_blink_deltas[side] * 1000:.3f}mm."
                )
        if mouth_interior_depth < 0.025:
            errors.append(
                f"LOD0 mouth interior depth is only {mouth_interior_depth * 1000:.1f}mm; "
                "minimum close-up cavity depth is 25mm."
            )
        for role in ("cornea", "wetline", "teeth", "tongue", "mouthInterior"):
            if not any(MATERIAL_ROLES[role].search(name) for name in materials):
                errors.append(f"LOD0 needs separate {role} geometry/material.")
    elif args.lod == 1:
        for role in ("cornea", "teeth", "tongue", "mouthInterior"):
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
        export_def_bones=False,
        export_morph=True,
        export_extras=True,
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
