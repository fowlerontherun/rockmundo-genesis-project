"""Put real source-skin warnings BESIDE editable joint fit handles, in one scene.

Run ONLY on the unedited matching <frame>-joint-handles.blend with the actual
same-run full-body diagnostic JSON. This creates a SEPARATE experimental
artist handoff .blend, never changes joint handles, rig positions or weights.
The source marker is a skin vertex (possibly a WRONG digit), NOT a joint.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

import bpy
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from phase1_body_contract import DIGITS  # noqa: E402
from phase1_finger_handoff import validate_finger_handoff  # noqa: E402

ARMATURE = "RMV2_Armature"
HANDLES = "RMV2_FitHandles"
COLLECTION = "RMV2_UnapprovedFingerHandoff"
TEXT_NAME = "ROCKMUNDO_PHASE1_FINGER_HANDOFF_READ_ME"


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frame", required=True, choices=("masculine", "feminine"))
    parser.add_argument("--probe-report", required=True, type=pathlib.Path)
    parser.add_argument("--output", required=True, type=pathlib.Path)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def main() -> None:
    args = cli()
    source = pathlib.Path(bpy.data.filepath).resolve()
    output = args.output.resolve()
    if not source.name == f"{args.frame}-joint-handles.blend":
        raise RuntimeError("Open the ORIGINAL same-frame -joint-handles.blend, not a weighted experiment")
    if ("public" in output.parts or source == output or output.exists()
            or output.suffix != ".blend"):
        raise RuntimeError("Handoff must be a new authoring-only Blender file outside public")
    scene = bpy.context.scene
    rig = bpy.data.objects.get(ARMATURE)
    if (scene.get("rockmundoAvatarV2SourceFrame") != args.frame
            or rig is None or rig.type != "ARMATURE"
            or rig.get("rockmundoAvatarV2RequiresManualFit") is not True
            or rig.get("rockmundoAvatarV2ArtistFitReport")):
        raise RuntimeError("Requires original unreviewed same-frame real CC0 handle scene")
    handle_collection = bpy.data.collections.get(HANDLES)
    if not handle_collection or bpy.data.collections.get(COLLECTION):
        raise RuntimeError("Missing untouched fit handles or duplicate prior diagnostics")
    body = bpy.data.objects.get(
        json.loads(args.probe_report.read_text(encoding="utf8")).get("realSourceBody", "")
    )
    if body is None or body.type != "MESH" or len(body.data.vertices) < 1000:
        raise RuntimeError("Actual matching continuous source body was not found")
    if any(mod.type == "ARMATURE" for mod in body.modifiers) or any(
        group.name in {f"{digit}{joint}.{side}" for digit in DIGITS
                       for joint in (1, 2, 3) for side in ("L", "R")}
        for group in body.vertex_groups
    ):
        raise RuntimeError("Original source body unexpectedly has edited skin or modifiers")

    segments = {}
    for side in ("L", "R"):
        for digit in DIGITS:
            for joint in (1, 2, 3):
                name = f"{digit}{joint}.{side}"
                bone = rig.data.bones.get(name)
                marker = handle_collection.objects.get(f"RMV2_FIT__{name}__tail")
                if not bone or not marker or marker.type != "EMPTY":
                    raise RuntimeError(f"Missing editable {name} guide/tail landmark")
                segments[name] = (
                    tuple(rig.matrix_world @ bone.head_local),
                    tuple(rig.matrix_world @ bone.tail_local),
                )
    positions = [tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    probe = json.loads(args.probe_report.read_text(encoding="utf8"))
    hints = validate_finger_handoff(probe, args.frame, positions, segments)
    collection = bpy.data.collections.new(COLLECTION)
    scene.collection.children.link(collection)
    collection.hide_render = True
    collection.hide_viewport = False
    for name, hint in hints.items():
        marker = bpy.data.objects.new(f"RMV2_UNAPPROVED_SOURCE_VERTEX__{name}", None)
        collection.objects.link(marker)
        marker.location = Vector(positions[hint["nearestActualSourceVertexIndex"]])
        marker.empty_display_type = "SPHERE"
        marker.empty_display_size = .005
        marker.show_name = True
        marker.show_in_front = True
        marker.color = (
            (1., .17, .09, 1.) if hint["possibleWrongFingerSurface"]
            else (.03, .87, 1., 1.)
        )
        marker["sourceBody"] = body.name
        marker["actualCC0Vertex"] = hint["nearestActualSourceVertexIndex"]
        marker["missingGuideJoint"] = name
        marker["competingHeatPaint"] = json.dumps(hint["nearestSourceWeights"], sort_keys=True)
        marker["wrongDigitWarning"] = hint["possibleWrongFingerSurface"]
        marker["NOT_ANATOMICAL_JOINT"] = True
        marker["artistReviewed"] = False
        marker["productionValidated"] = False
        # Existing RMV2_FIT__<name>__tail markers are left untouched. Where
        # the bone is connected, the start pivot follows its parent's tail.

    readme = bpy.data.texts.get(TEXT_NAME) or bpy.data.texts.new(TEXT_NAME)
    readme.clear()
    readme.write(
        "UNFITTED REAL CC0 FINGER HANDOFF — NOT PLAYER/GIG-READY\n"
        "Open RMV2_FitHandles to edit REAL joint handles.\n"
        "RMV2_UnapprovedFingerHandoff contains SOURCE SKIN VERTICES ONLY.\n"
        "RED: closest vertex is already painted to another finger; might be the WRONG digit.\n"
        "CYAN: initial bone heat missed this digit but no neighbour ownership detected.\n"
        "NEVER snap an internal pivot automatically to a surface hint.\n"
        "Inspect true CC0 edge loops from multiple views and fit each real joint.\n"
        "Repaint every finger; verify a close-up full grip, twist and creases.\n"
        "Independent review, all 8 corrective sculpts and full assess are REQUIRED.\n\n"
        + json.dumps(hints, indent=2, sort_keys=True)
    )
    scene["rockmundoAvatarV2UnapprovedFingerHandoff"] = True
    scene["rockmundoAvatarV2FingerHandoffCount"] = len(hints)
    scene["rockmundoAvatarV2ArtistReviewed"] = False
    scene["rockmundoAvatarV2ProductionValidated"] = False
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    summary = {
        "schema": "rockmundo.avatar-v2-unapproved-finger-handoff",
        "frame": args.frame, "sourceMesh": body.name, "actualSourceVertices": len(positions),
        "hints": sorted(hints), "wrongDigitWarnings": sorted(
            name for name, hint in hints.items() if hint["possibleWrongFingerSurface"]
        ), "editableFitHandlesIntact": True,
        "artistReviewed": False, "productionValidated": False,
        "experimentalBlend": output.name,
    }
    output.with_suffix(".json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf8"
    )
    print("[phase1/handoff] " + json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
