"""Create a RockMundo Avatar V2 deform-rig guide inside an authoring .blend.

This script creates the complete semantic RockMundo skeleton with close-up
shoulder/toe/finger chains, positioned from the visible body bounds as a starting
guide. It intentionally DOES NOT bind or auto-weight the mesh: production quality
requires an artist to fit joints to the actual topology before weights and pose
correctives are authored.

Usage:
  blender work/avatar-v2-masculine-source.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_rig_guide.py -- \
    --frame masculine \
    --output work/avatar-v2-masculine-rigged-source.blend

After generation:
1. Open the file interactively.
2. Fit every guide bone to the actual joint centres and finger topology.
3. Bind/weight the body with <=4 influences per vertex.
4. Test shoulder/elbow/hip/knee extremes before sculpting pose correctives.
5. Export only after the normal RockMundo V2 validator passes.
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import bpy
from mathutils import Vector

RIG_OBJECT_NAME = "RMV2_Armature"

FRAME_REFERENCE_HEIGHT = {
    "masculine": 1.80,
    "feminine": 1.72,
}

DIGIT_SPREAD = {
    "Thumb": -0.028,
    "Index": -0.012,
    "Middle": 0.000,
    "Ring": 0.012,
    "Pinky": 0.024,
}

DIGIT_LENGTH = {
    "Thumb": (0.020, 0.017, 0.014),
    "Index": (0.022, 0.018, 0.015),
    "Middle": (0.024, 0.020, 0.016),
    "Ring": (0.022, 0.018, 0.015),
    "Pinky": (0.018, 0.015, 0.012),
}


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame", choices=["masculine", "feminine"], required=True)
    parser.add_argument("--output", help="Optional .blend output path. Defaults to saving the current file.")
    parser.add_argument("--replace", action="store_true", help="Replace an existing RMV2_Armature guide.")
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def visible_meshes() -> list[bpy.types.Object]:
    return [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and not obj.hide_render and not obj.hide_viewport
    ]


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in meshes:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise SystemExit("No visible mesh body was found in the authoring scene.")
    minimum = Vector((
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
    ))
    maximum = Vector((
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    ))
    return minimum, maximum


def remove_existing(replace: bool) -> None:
    existing = bpy.data.objects.get(RIG_OBJECT_NAME)
    if not existing:
        return
    if not replace:
        raise SystemExit(
            f"{RIG_OBJECT_NAME} already exists. Fit that rig or rerun with --replace."
        )
    data = existing.data
    bpy.data.objects.remove(existing, do_unlink=True)
    if data and data.users == 0:
        bpy.data.armatures.remove(data)


def add_bone(
    armature: bpy.types.Armature,
    name: str,
    head: Vector,
    tail: Vector,
    parent: bpy.types.EditBone | None = None,
    *,
    connected: bool = False,
) -> bpy.types.EditBone:
    bone = armature.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.parent = parent
    bone.use_connect = connected
    bone.use_deform = True
    return bone


def add_twist_helper(
    armature: bpy.types.Armature,
    name: str,
    segment: bpy.types.EditBone,
) -> bpy.types.EditBone:
    direction = segment.tail - segment.head
    head = segment.head + direction * 0.38
    tail = segment.head + direction * 0.72
    return add_bone(armature, name, head, tail, segment)


def create_digit_chain(
    armature: bpy.types.Armature,
    side: str,
    hand: bpy.types.EditBone,
    height: float,
    centre_y: float,
) -> None:
    direction = 1.0 if side == "L" else -1.0
    base = hand.tail.copy()

    for digit, spread in DIGIT_SPREAD.items():
        lengths = DIGIT_LENGTH[digit]
        parent = hand
        start = base + Vector((
            direction * (0.004 * height),
            spread * height,
            (0.004 if digit == "Thumb" else 0.0) * height,
        ))

        # Fingers extend away from the wrist along local character X in the
        # approximate A-pose. The Y spread separates digits for easy fitting.
        for joint, length in enumerate(lengths, start=1):
            bend_y = spread * height * (0.18 if joint > 1 else 0.08)
            end = start + Vector((
                direction * length * height,
                bend_y,
                (-0.003 if digit == "Thumb" else 0.0) * height,
            ))
            bone = add_bone(
                armature,
                f"{digit}{joint}.{side}",
                start,
                end,
                parent,
                connected=joint > 1,
            )
            parent = bone
            start = end


def create_rig(frame: str, minimum: Vector, maximum: Vector) -> bpy.types.Object:
    height = maximum.z - minimum.z
    if height <= 0.5:
        raise SystemExit(f"Visible body height is only {height:.3f}m; normalize the source seed first.")

    centre_x = (minimum.x + maximum.x) / 2
    centre_y = (minimum.y + maximum.y) / 2
    z = lambda fraction: minimum.z + height * fraction
    x = lambda fraction: centre_x + height * fraction

    armature = bpy.data.armatures.new("RMV2_ArmatureData")
    rig = bpy.data.objects.new(RIG_OBJECT_NAME, armature)
    bpy.context.scene.collection.objects.link(rig)
    rig.show_in_front = True
    rig.display_type = "WIRE"
    rig["rockmundoAvatarV2RigGuide"] = True
    rig["rockmundoAvatarV2Frame"] = frame
    rig["rockmundoAvatarV2ReferenceHeight"] = FRAME_REFERENCE_HEIGHT[frame]
    rig["rockmundoAvatarV2RequiresManualFit"] = True

    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    hips = add_bone(
        armature, "Hips",
        Vector((centre_x, centre_y, z(0.49))),
        Vector((centre_x, centre_y, z(0.56))),
    )
    spine1 = add_bone(
        armature, "Spine1",
        hips.tail.copy(),
        Vector((centre_x, centre_y, z(0.66))),
        hips,
        connected=True,
    )
    spine2 = add_bone(
        armature, "Spine2",
        spine1.tail.copy(),
        Vector((centre_x, centre_y, z(0.77))),
        spine1,
        connected=True,
    )
    neck = add_bone(
        armature, "Neck",
        spine2.tail.copy(),
        Vector((centre_x, centre_y, z(0.83))),
        spine2,
        connected=True,
    )
    head = add_bone(
        armature, "Head",
        neck.tail.copy(),
        Vector((centre_x, centre_y, z(0.97))),
        neck,
        connected=True,
    )

    # Eye bones are authored as direct head children so runtime gaze remains
    # independent from blink/squint morphs while still following head motion.
    # These are proportion guides only; fit them to the actual eyeball centres.
    for side in ("L", "R"):
        direction = 1.0 if side == "L" else -1.0
        eye_head = Vector((
            x(direction * 0.018),
            centre_y - height * 0.035,
            z(0.905),
        ))
        add_bone(
            armature,
            f"Eye.{side}",
            eye_head,
            eye_head + Vector((0.0, -height * 0.018, 0.0)),
            head,
        )

    for side in ("L", "R"):
        direction = 1.0 if side == "L" else -1.0

        shoulder = add_bone(
            armature,
            f"Shoulder.{side}",
            Vector((x(direction * 0.025), centre_y, z(0.755))),
            Vector((x(direction * 0.115), centre_y, z(0.745))),
            spine2,
        )
        upper_arm = add_bone(
            armature,
            f"UpperArm.{side}",
            shoulder.tail.copy(),
            Vector((x(direction * 0.265), centre_y, z(0.685))),
            shoulder,
            connected=True,
        )
        add_twist_helper(armature, f"UpperArmTwist.{side}", upper_arm)
        lower_arm = add_bone(
            armature,
            f"LowerArm.{side}",
            upper_arm.tail.copy(),
            Vector((x(direction * 0.405), centre_y, z(0.625))),
            upper_arm,
            connected=True,
        )
        add_twist_helper(armature, f"ForearmTwist.{side}", lower_arm)
        hand = add_bone(
            armature,
            f"Hand.{side}",
            lower_arm.tail.copy(),
            Vector((x(direction * 0.475), centre_y, z(0.605))),
            lower_arm,
            connected=True,
        )
        create_digit_chain(armature, side, hand, height, centre_y)

        upper_leg = add_bone(
            armature,
            f"UpperLeg.{side}",
            Vector((x(direction * 0.055), centre_y, z(0.50))),
            Vector((x(direction * 0.060), centre_y, z(0.285))),
            hips,
        )
        add_twist_helper(armature, f"ThighTwist.{side}", upper_leg)
        lower_leg = add_bone(
            armature,
            f"LowerLeg.{side}",
            upper_leg.tail.copy(),
            Vector((x(direction * 0.058), centre_y, z(0.075))),
            upper_leg,
            connected=True,
        )
        foot = add_bone(
            armature,
            f"Foot.{side}",
            lower_leg.tail.copy(),
            Vector((x(direction * 0.058), centre_y - height * 0.075, z(0.035))),
            lower_leg,
            connected=True,
        )
        add_bone(
            armature,
            f"Toe.{side}",
            foot.tail.copy(),
            Vector((x(direction * 0.058), centre_y - height * 0.135, z(0.025))),
            foot,
            connected=True,
        )

    bpy.ops.object.mode_set(mode="OBJECT")
    rig.data.display_type = "BBONE"
    return rig


def create_notes(frame: str) -> None:
    text = bpy.data.texts.get("ROCKMUNDO_AVATAR_V2_RIG_GUIDE") or bpy.data.texts.new(
        "ROCKMUNDO_AVATAR_V2_RIG_GUIDE"
    )
    text.clear()
    text.write(
        f"""# RockMundo Avatar V2 rig guide

Frame: {frame}

The generated RMV2_Armature is a naming/proportion GUIDE, not a finished rig.

Before binding:
- move hips/spine/neck/head joints into the actual mesh centres;
- fit Eye.L/Eye.R to the actual eyeball centres and keep them parented to Head;
- fit shoulder roots to the clavicle topology;
- keep UpperArmTwist/ForearmTwist/ThighTwist inside their source limb segments;
- place elbow/knee joints on the deformation loops, not the visual surface edge;
- fit wrist/ankle/toe pivots;
- fit every finger joint to the authored knuckle loops;
- keep the A-pose and left/right naming unchanged.

After fitting:
- bind with normalized weights;
- keep no more than four influences per vertex;
- manually clean shoulders, elbows, hips, knees, wrists and fingers;
- paint meaningful weights onto all six twist helpers so axial roll is distributed;
- bind each eyeball to its matching eye bone and verify gaze pivots cleanly;
- test singing gaze plus guitar, bass, drumstick and microphone poses;
- sculpt the required pose-space correctives after skinning quality is stable.

Do not export the untouched guide as a validated runtime asset.
"""
    )


def save(output: str | None) -> None:
    if output:
        path = pathlib.Path(output).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
    else:
        if not bpy.data.filepath:
            raise SystemExit("--output is required when the current Blender file has never been saved.")
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)


def main() -> None:
    args = cli_args()
    meshes = visible_meshes()
    minimum, maximum = world_bounds(meshes)
    remove_existing(args.replace)
    create_rig(args.frame, minimum, maximum)
    create_notes(args.frame)
    save(args.output)

    print(
        f"Created {RIG_OBJECT_NAME} guide for {args.frame} Avatar V2. "
        "Fit bones and weights manually before export."
    )


if __name__ == "__main__":
    main()
