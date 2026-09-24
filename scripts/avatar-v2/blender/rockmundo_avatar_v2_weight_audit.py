"""Audit Avatar V2 body skin weights after the RockMundo rig has been fitted.

This is deliberately a QA tool, not an auto-weighter. Run it after manually
placing RMV2_Armature and binding/cleaning the body:

  blender work/avatar-v2-masculine-rigged-source.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_weight_audit.py -- \
    --armature RMV2_Armature

The audit fails on unweighted vertices, more than four meaningful influences,
poor normalization, the wrong armature modifier or required deform bones that
never influence any body vertex.
"""

from __future__ import annotations

import argparse
import collections
import sys

import bpy

DEFAULT_ARMATURE = "RMV2_Armature"
WEIGHT_EPSILON = 0.0001
NORMALIZATION_TOLERANCE = 0.02

REQUIRED_RIG_BONES = [
    "Hips", "Spine1", "Spine2", "Neck", "Head", "Eye.L", "Eye.R",
    "Shoulder.L", "Shoulder.R",
    "UpperArm.L", "LowerArm.L", "Hand.L",
    "UpperArm.R", "LowerArm.R", "Hand.R",
    "UpperLeg.L", "LowerLeg.L", "Foot.L", "Toe.L",
    "UpperLeg.R", "LowerLeg.R", "Foot.R", "Toe.R",
    *[
        f"{digit}{joint}.{side}"
        for side in ("L", "R")
        for digit in ("Thumb", "Index", "Middle", "Ring", "Pinky")
        for joint in (1, 2, 3)
    ],
]

REQUIRED_BODY_DEFORM_BONES = [
    "Hips", "Spine1", "Spine2", "Neck", "Head",
    "Shoulder.L", "Shoulder.R",
    "UpperArm.L", "LowerArm.L", "Hand.L",
    "UpperArm.R", "LowerArm.R", "Hand.R",
    "UpperLeg.L", "LowerLeg.L", "Foot.L", "Toe.L",
    "UpperLeg.R", "LowerLeg.R", "Foot.R", "Toe.R",
    *[
        f"{digit}{joint}.{side}"
        for side in ("L", "R")
        for digit in ("Thumb", "Index", "Middle", "Ring", "Pinky")
        for joint in (1, 2, 3)
    ],
]


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--armature", default=DEFAULT_ARMATURE)
    parser.add_argument("--object", action="append", dest="objects", default=[], help="Explicit body/head mesh to audit. Repeat as needed.")
    parser.add_argument(
        "--normalization-tolerance",
        type=float,
        default=NORMALIZATION_TOLERANCE,
        help="Allowed absolute difference from a total weight of 1.0.",
    )
    parser.add_argument(
        "--allow-unused-deform-bones",
        action="store_true",
        help="Report but do not fail required deform bones with no weighted vertices.",
    )
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def is_body_or_head_surface(obj: bpy.types.Object) -> bool:
    if obj.type != "MESH" or obj.hide_render or obj.hide_viewport:
        return False
    if bool(obj.get("rockmundoAvatarV2Garment")):
        return False
    if obj.get("rockmundoBodyRegion"):
        return True
    if bool(obj.get("rockmundoHeadSurface")):
        return True
    name = obj.name.lower().replace("-", "_")
    return (
        name == "rmv2_body"
        or name.startswith("rmv2_body_")
        or name.startswith("rmv2_head")
        or name.startswith("rmv2_face")
    )


def armature_modifier(obj: bpy.types.Object, rig: bpy.types.Object):
    return next(
        (
            modifier
            for modifier in obj.modifiers
            if modifier.type == "ARMATURE" and modifier.object == rig
        ),
        None,
    )


def visible_body_meshes(rig: bpy.types.Object, names: list[str]) -> list[bpy.types.Object]:
    if names:
        result: list[bpy.types.Object] = []
        for name in names:
            obj = bpy.data.objects.get(name)
            if obj is None or obj.type != "MESH":
                raise SystemExit(f'Body/head mesh "{name}" was not found.')
            result.append(obj)
        return result

    tagged = [obj for obj in bpy.context.scene.objects if is_body_or_head_surface(obj)]
    if tagged:
        return tagged

    candidates = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        and not obj.hide_render
        and not obj.hide_viewport
        and not bool(obj.get("rockmundoAvatarV2Garment"))
        and armature_modifier(obj, rig) is not None
    ]
    if not candidates:
        return []

    largest = max(candidates, key=lambda obj: len(obj.data.vertices))
    print(
        f'[avatar-v2-weight-audit] Auto-selected largest rigged source mesh "{largest.name}" '
        f"({len(largest.data.vertices):,} vertices). Use --object to override."
    )
    return [largest]


def meaningful_groups(obj: bpy.types.Object, vertex: bpy.types.MeshVertex):
    result: list[tuple[str, float]] = []
    for membership in vertex.groups:
        if membership.weight <= WEIGHT_EPSILON:
            continue
        if membership.group >= len(obj.vertex_groups):
            continue
        result.append((obj.vertex_groups[membership.group].name, membership.weight))
    return result


def main() -> None:
    args = cli_args()
    errors: list[str] = []
    warnings: list[str] = []

    rig = bpy.data.objects.get(args.armature)
    if rig is None or rig.type != "ARMATURE":
        raise SystemExit(f'Armature "{args.armature}" was not found.')

    rig_bones = {bone.name: bone for bone in rig.data.bones}
    missing_bones = [name for name in REQUIRED_RIG_BONES if name not in rig_bones]
    if missing_bones:
        errors.append("Missing required rig bones: " + ", ".join(missing_bones))

    head = rig_bones.get("Head")
    for eye_name in ("Eye.L", "Eye.R"):
        eye = rig_bones.get(eye_name)
        if not head or not eye:
            continue
        parent = eye.parent
        while parent and parent != head:
            parent = parent.parent
        if parent != head:
            errors.append(f"{eye_name} must inherit from Head.")

    meshes = visible_body_meshes(rig, args.objects)
    if not meshes:
        errors.append("No visible Avatar V2 body meshes were found.")

    weighted_vertices_by_bone: collections.Counter[str] = collections.Counter()
    unweighted = 0
    over_influenced = 0
    unnormalised = 0
    total_vertices = 0
    worst_influence_count = 0
    worst_normalization_error = 0.0
    unknown_groups: set[str] = set()

    for obj in meshes:
        modifier = armature_modifier(obj, rig)
        if modifier is None:
            errors.append(
                f'{obj.name} is not bound through an Armature modifier targeting "{args.armature}".'
            )

        deform_names = {name for name, bone in rig_bones.items() if bone.use_deform}
        group_names = {group.name for group in obj.vertex_groups}
        unknown_groups.update(
            name for name in group_names
            if name not in rig_bones and not name.startswith("RMV2_")
        )

        for vertex in obj.data.vertices:
            total_vertices += 1
            groups = meaningful_groups(obj, vertex)
            deform_groups = [
                (name, weight)
                for name, weight in groups
                if name in deform_names
            ]
            influence_count = len(deform_groups)
            worst_influence_count = max(worst_influence_count, influence_count)

            if influence_count == 0:
                unweighted += 1
                continue

            if influence_count > 4:
                over_influenced += 1

            total_weight = sum(weight for _, weight in deform_groups)
            normalization_error = abs(1.0 - total_weight)
            worst_normalization_error = max(worst_normalization_error, normalization_error)
            if normalization_error > args.normalization_tolerance:
                unnormalised += 1

            for name, _weight in deform_groups:
                weighted_vertices_by_bone[name] += 1

    if unweighted:
        errors.append(f"{unweighted:,} / {total_vertices:,} body vertices have no meaningful deform weight.")
    if over_influenced:
        errors.append(
            f"{over_influenced:,} body vertices exceed four meaningful deform influences "
            f"(worst: {worst_influence_count})."
        )
    if unnormalised:
        errors.append(
            f"{unnormalised:,} body vertices are outside the weight normalization tolerance "
            f"±{args.normalization_tolerance:.3f} (worst error: {worst_normalization_error:.3f})."
        )

    unused_required = [
        name
        for name in REQUIRED_BODY_DEFORM_BONES
        if name in rig_bones and weighted_vertices_by_bone[name] == 0
    ]
    if unused_required:
        message = (
            "Required deform bones with no weighted body vertices: "
            + ", ".join(unused_required)
        )
        if args.allow_unused_deform_bones:
            warnings.append(message)
        else:
            errors.append(message)

    if unknown_groups:
        warnings.append(
            "Vertex groups do not match rig bones and should be reviewed: "
            + ", ".join(sorted(unknown_groups))
        )

    print(
        "[avatar-v2-weight-audit] "
        f"{len(meshes)} mesh(es), {total_vertices:,} vertices, "
        f"{len(weighted_vertices_by_bone)} weighted deform bones."
    )
    print(
        "[avatar-v2-weight-audit] "
        f"max influences={worst_influence_count}; "
        f"worst normalization error={worst_normalization_error:.4f}."
    )
    for warning in warnings:
        print(f"[avatar-v2-weight-audit] WARN: {warning}")

    if errors:
        for error in errors:
            print(f"[avatar-v2-weight-audit] ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)

    print("[avatar-v2-weight-audit] PASS: body skin weights meet the structural V2 contract.")


if __name__ == "__main__":
    main()
