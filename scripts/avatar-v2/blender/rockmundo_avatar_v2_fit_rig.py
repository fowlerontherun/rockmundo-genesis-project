"""Place artist-movable joint handles and transfer their sculpt fit to V2 rig.

Authoring only: this NEVER binds a body, invents morphs, exports a GLB,
certifies a sculpt, or toggles live Avatar V2 rollout.

Create handles from the existing proportion-guide armature:
  blender work/avatar-v2-masculine-rigged-source.blend --background \\
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_fit_rig.py -- \\
    --mode create --output work/avatar-v2-masculine-handles.blend

In interactive Blender, snap/edit handles in RMV2_FitHandles onto the actual
skin surface and internal joint pivots. Align fingertip chains, both jaws/
eyeballs, ears, shoulders, elbows, wrists, hips, knees, ankles and toes.
The collection is render-disabled but visible in the Blender viewport.

Transfer only after artist review:
  blender work/avatar-v2-masculine-handles.blend --background \\
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_fit_rig.py -- \\
    --mode apply --reviewed \\
    --report work/avatar-v2-masculine-fit-report.json \\
    --output work/avatar-v2-masculine-fitted-guide.blend
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from rig_landmarks import (  # noqa: E402
    BoneSpec, audit_sculpt_fit, fit_bones, marker_name, moved_markers,
    position_markers, is_twist,
)

RIG_NAME = "RMV2_Armature"
COLLECTION_NAME = "RMV2_FitHandles"
MARKER_SIZE = .009


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("create", "apply"), required=True)
    parser.add_argument("--armature", default=RIG_NAME)
    parser.add_argument("--reviewed", action="store_true", help="Confirm the joint markers were inspected and repositioned against the actual sculpt.")
    parser.add_argument("--output", help="Save the modified working .blend here. By default, overwrite the opened .blend.")
    parser.add_argument("--report", help="Optional local JSON fit report for the asset artist.")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def read_rig(rig: bpy.types.Object) -> list[BoneSpec]:
    """Read authoring rest joints in armature-local coordinates."""
    bpy.ops.object.select_all(action="DESELECT")
    rig.hide_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    specs = [
        BoneSpec(
            name=bone.name,
            parent=bone.parent.name if bone.parent else None,
            connected=bone.use_connect,
            head=tuple(float(x) for x in bone.head),
            tail=tuple(float(x) for x in bone.tail),
        )
        for bone in rig.data.edit_bones
    ]
    bpy.ops.object.mode_set(mode="OBJECT")
    return specs


def colour_for(name: str) -> tuple[float, float, float, float]:
    if name.startswith(("Eye.", "EarAnchor.", "Jaw", "Head", "Neck")):
        return (.17, .9, .95, 1)
    if any(word in name for word in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Hand")):
        return (1, .3, .52, 1)
    if any(word in name for word in ("Leg", "Foot", "Toe")):
        return (.59, .45, 1, 1)
    return (1, .75, .18, 1)


def create_handles(rig: bpy.types.Object, specs: list[BoneSpec]) -> dict:
    expected = position_markers(specs)
    if not expected:
        raise SystemExit("The fitted guide has no movable bones.")
    previous = bpy.data.collections.get(COLLECTION_NAME)
    if previous and any(obj.name.startswith("RMV2_FIT__") for obj in previous.objects):
        raise SystemExit("Fit handles already exist. Move these handles instead of replacing their artist edits.")

    collection = previous or bpy.data.collections.new(COLLECTION_NAME)
    if not previous:
        bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    collection.hide_viewport = False

    for name, armature_local in expected.items():
        obj = bpy.data.objects.new(name, None)
        collection.objects.link(obj)
        obj.empty_display_type = "SPHERE"
        obj.empty_display_size = MARKER_SIZE
        obj.color = colour_for(name.replace("RMV2_FIT__", ""))
        obj.show_name = True
        obj.show_in_front = True
        world = rig.matrix_world @ Vector(armature_local)
        obj.location = world
        # Store original LOCAL authoring coordinates, independent of a later
        # move/scale of the armature object or of the whole working .blend.
        obj["rockmundoFitGuideRest"] = list(armature_local)
        obj["rockmundoFitRig"] = rig.name
        obj["rockmundoFitArtistPlaced"] = False

    return {
        "action": "handles-created",
        "armature": rig.name,
        "markers": len(expected),
        "tip": "Snap each handle to the artist-reviewed joint, then apply with --reviewed. This does not bind the mesh.",
    }


def fit_from_handles(rig: bpy.types.Object, specs: list[BoneSpec], reviewed: bool) -> dict:
    if not reviewed:
        raise SystemExit("Refusing to modify rig before explicit --reviewed artist confirmation.")
    expected = position_markers(specs)
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if not collection:
        raise SystemExit("Create the RMV2_FitHandles collection and move its joint markers first.")

    placed: dict[str, tuple[float, float, float]] = {}
    rest: dict[str, tuple[float, float, float]] = {}
    inverse = rig.matrix_world.inverted_safe()
    for name in expected:
        obj = collection.objects.get(name)
        if not obj or obj.type != "EMPTY":
            raise SystemExit(f"Missing artist landmark handle {name}. Regenerate the working source, not the approved handles.")
        if obj.get("rockmundoFitRig") != rig.name:
            raise SystemExit(f"Landmark {name} belongs to a different guide rig.")
        stored = obj.get("rockmundoFitGuideRest")
        if stored is None or len(stored) != 3:
            raise SystemExit(f"Landmark {name} has no trustworthy original guide position.")
        rest[name] = tuple(float(x) for x in stored)
        local = inverse @ obj.matrix_world.translation
        placed[name] = tuple(float(x) for x in local)

    changed = moved_markers(placed, rest)
    minimum_edits = max(8, math.ceil(len(expected) * .10))
    if len(changed) < minimum_edits:
        raise SystemExit(
            f"Only {len(changed)}/{len(expected)} markers moved more than 2mm. "
            f"At least {minimum_edits} must be fitted to the actual sculpt "
            "before applying a guide. An untouched proportional guide is not an authored rig."
        )

    fitted = fit_bones(specs, placed)
    issues = audit_sculpt_fit(fitted)
    if issues:
        raise SystemExit("Joint fit rejected:\\n- " + "\\n- ".join(issues))

    by_name = {bone.name: bone for bone in specs}
    def depth(name: str) -> int:
        parent = by_name[name].parent
        return 0 if parent is None else 1 + depth(parent)

    # All checks have passed. Only now do we enter edit mode and mutate the
    # live armature. Parent-first sorting preserves Blender connected chains.
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name in sorted(fitted, key=depth):
        bone = rig.data.edit_bones.get(name)
        if not bone:
            raise RuntimeError(f"Rig changed during marker fitting: {name}")
        fit = fitted[name]
        if not bone.use_connect:
            bone.head = Vector(fit.head)
        bone.tail = Vector(fit.tail)
    bpy.ops.object.mode_set(mode="OBJECT")

    report = {
        "action": "artist-markers-applied",
        "armature": rig.name,
        "landmarkCount": len(expected),
        "movedFromGuide": len(changed),
        "reviewed": reviewed,
        "jointCount": len(fitted),
        "issues": [],
        "remaining": [
            "Review deforming and connected joints against real topology.",
            "Manually bind and weight every skin surface; clean each finger and twist helper.",
            "Create real body/face morphs, close-up surfaces, garment regions and LODs.",
            "Pass independent topology, weights and exported-GLB gates before rollout.",
        ],
    }
    rig["rockmundoAvatarV2ArtistFitReport"] = json.dumps(report)
    # No marker positioning is sufficient to waive sculpt/weight certification.
    rig["rockmundoAvatarV2RequiresManualFit"] = True
    return report


def save(output: str | None) -> None:
    if output:
        path = pathlib.Path(output).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
    elif bpy.data.filepath:
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    else:
        raise SystemExit("--output is required for a new, never-saved Blender scene.")


def main() -> None:
    args = cli_args()
    rig = bpy.data.objects.get(args.armature)
    if not rig or rig.type != "ARMATURE":
        raise SystemExit(f"Required authoring armature {args.armature} is missing.")
    specs = read_rig(rig)
    if args.mode == "create":
        result = create_handles(rig, specs)
    else:
        result = fit_from_handles(rig, specs, args.reviewed)
    save(args.output)
    if args.report:
        path = pathlib.Path(args.report).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2) + "\\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
