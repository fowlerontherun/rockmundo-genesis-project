"""Non-production Blender pilot: bind each *real* CC0 BODY on its UNFITTED GUIDE.

Purpose: exercise Blender bone heat and real evaluated deformation on both
source sculpts; capture actual experimental art for joint/weight painters.
Unlike the production prepare/assess commands, this deliberately operates on
UNREVIEWED guides and NEVER emits certification or production asset paths.
A pilot pass means only that a genuine Blender initial bind was attempted.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import traceback

import bpy
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
from phase1_body_contract import (DIGITS, DEFORM_BONES,
                                  propose_missing_finger_weights,
                                  missing_finger_review_hints)  # noqa: E402
from rockmundo_avatar_v2_phase1_body import (  # noqa: E402
    ARMATURE, POSES, assign_eight_skin_regions, audit_weights, bind_original_eyes,
    candidate_export, drive_correctives, mesh_world_positions,
    render_contact_sheet, selected_parent_bind, set_pose, twist_seed_and_normalise,
    vertex_weights,
)

parser = argparse.ArgumentParser()
parser.add_argument("--frame", choices=("masculine", "feminine"), required=True)
parser.add_argument("--output-root", type=pathlib.Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
root = args.output_root.resolve() / args.frame
if "public" in root.parts:
    raise SystemExit("Exploratory source rig probes may not write in public asset paths")
root.mkdir(parents=True, exist_ok=True)
report_path = root / f"{args.frame}-AUTOBIND-EXPERIMENT-report.json"
report = {
    "schema": "rockmundo.avatar-v2-unfitted-binding-experiment",
    "version": 1, "frame": args.frame,
    "sourceUnfitted": True, "artistReviewed": False, "productionValidated": False,
    "fullBodyArtApproved": False, "visualApproval": "not_requested",
    "warning": "Guide is unreviewed; experimental body must never enter gameplay or production.",
}
try:
    rig = bpy.data.objects.get(ARMATURE)
    if not rig or rig.get("rockmundoAvatarV2RequiresManualFit") is not True:
        raise RuntimeError("Pilot requires an untouched actual CC0 unfitted guide")
    if rig.get("rockmundoAvatarV2ArtistFitReport"):
        raise RuntimeError("Pilot must not touch an artist-reviewed rig")
    scene = bpy.context.scene
    if scene.get("rockmundoAvatarV2SourceFrame") != args.frame:
        raise RuntimeError("Body type differs from CC0 source scene")
    source = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
    body = max(source, key=lambda o: len(o.data.vertices))
    if len(body.data.vertices) < 1000:
        raise RuntimeError("Missing actual high-detail continuous CC0 body")
    report.update({"realSourceBody": body.name, "realSourceVertices": len(body.data.vertices),
                   "guideBoneCount": len(rig.data.bones)})
    # A parent operation or stale Blender dependency transform must not be
    # misdiagnosed as a body bone physically floating 7cm from the source.
    original_world_surface = [tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    selected_parent_bind(body, rig)
    bpy.context.view_layer.update()
    bound_world_surface = [tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    max_rest_shift = max(
        math.dist(before, after)
        for before, after in zip(original_world_surface, bound_world_surface)
    )
    report["bindingRestSurfaceShiftMm"] = round(max_rest_shift * 1000, 3)
    if max_rest_shift > .001:
        raise RuntimeError("Blender skin parenting displaced actual source rest geometry")
    twist_seed_and_normalise(body, rig)
    report["initialSkinAudit"] = audit_weights(body, rig)
    # Analyse the actual distance to EVERY existing finger guide and whether
    # its nearby CC0 vertices have any real base Hand weight. Do NOT apply
    # weight proposals to an unfitted diagnostic guide.
    segments = {
        f"{digit}{joint}.{side}": (
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].head_local),
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].tail_local),
        )
        for side in ("L", "R") for digit in DIGITS for joint in (1, 2, 3)
    }
    surface = [tuple(body.matrix_world @ vertex.co) for vertex in body.data.vertices]
    paint = [vertex_weights(body, vertex, set(DEFORM_BONES))
             for vertex in body.data.vertices]
    _proposals, finger_geometry = propose_missing_finger_weights(surface, paint, segments)
    finger_geometry["proposalsApplied"] = False
    finger_geometry["unfittedGuidesNotArtistReviewed"] = True
    report["diagnosticFingerGeometry"] = finger_geometry
    # Make genuine source-surface locations inspectable in the ARTIST's
    # experimental .blend viewport. Nearest skin may belong to the WRONG
    # finger; never move a bone, overwrite a fit handle, or claim approval.
    hints = missing_finger_review_hints(surface, paint, segments)
    hint_collection = bpy.data.collections.get("RMV2_Phase1FingerReviewHints")
    if hint_collection and hint_collection.objects:
        raise RuntimeError("Refusing to overwrite prior artist finger annotations")
    if not hint_collection:
        hint_collection = bpy.data.collections.new("RMV2_Phase1FingerReviewHints")
        bpy.context.scene.collection.children.link(hint_collection)
    hint_collection.hide_render = True
    hint_collection.hide_viewport = False
    for name, data in hints.items():
        marker = bpy.data.objects.new(f"RMV2_UNAPPROVED_FINGER_HINT__{name}", None)
        hint_collection.objects.link(marker)
        marker.empty_display_type = "SPHERE"
        marker.empty_display_size = .006
        marker.show_name = True
        marker.show_in_front = True
        marker.color = ((1.0, .22, .15, 1.) if data["possibleWrongFingerSurface"]
                        else (.05, .87, .95, 1.))
        marker.location = Vector(data["actualSourceSurfacePosition"])
        marker["rockmundoSourceBoneForArtistToReview"] = name
        marker["rockmundoActualSourceVertexIndex"] = data["nearestActualSourceVertexIndex"]
        marker["rockmundoPossibleWrongDigitSurface"] = data["possibleWrongFingerSurface"]
        marker["rockmundoArtistReviewed"] = False
        marker["rockmundoProductionValidated"] = False
    report["fingerFitReviewHints"] = hints
    report["fingerFitHintCollection"] = hint_collection.name
    notes = bpy.data.texts.get("ROCKMUNDO_PHASE1_MISSING_FINGERS") or bpy.data.texts.new(
        "ROCKMUNDO_PHASE1_MISSING_FINGERS"
    )
    notes.clear()
    notes.write("EXPERIMENTAL SOURCE SKIN HINTS ONLY, NOT REAL JOINT PIVOTS.\\n"
                "Red markers are especially likely to point to the WRONG DIGIT.\\n"
                "Independently snap actual anatomy handles and repaint before review.\\n"
                + json.dumps(hints, indent=2, sort_keys=True))
    for name, evidence in finger_geometry["missingJointSourceEvidence"].items():
        print(f"[phase1/pilot] {args.frame} {name}: "
              f"actualSourceDistance={evidence['nearestActualSourceMm']}mm; "
              f"eligibleHandVertices={evidence['nearbyUnclaimedHandVertices']}; "
              f"claimedByOtherFingers={evidence['competingFingerGroups']}; "
              f"blocker={evidence['blocker']}; UNAPPROVED")
    eyes = bind_original_eyes(rig, args.frame)
    report["independentEyeObjects"] = {k: eye.name for k, eye in eyes.items()}
    try:
        report["eightSkinRegions"] = assign_eight_skin_regions(body)
    except RuntimeError as exc:
        # This is precisely the expected evidence when an unfitted guide
        # misplaces limb weights: keep actual failed counts, never forge coverage.
        report["regionBlockingIssue"] = str(exc)
    set_pose(rig, {})
    drive_correctives(body, {})
    neutral = mesh_world_positions(body)
    set_pose(rig, POSES["reach"])
    reach = mesh_world_positions(body)
    if len(neutral) != len(reach):
        raise RuntimeError("Bone-heat probe changed source topology")
    maximum = max((a - b).length for a, b in zip(neutral, reach))
    report["reachMaxVertexDisplacementMm"] = round(maximum * 1000, 3)
    if maximum <= .003:
        raise RuntimeError("Actual full-body Blender initial bind has no measurable reach pose")
    set_pose(rig, {})
    report["actualBlenderDeformation"] = True
    report["contactViews"] = render_contact_sheet(
        body, rig, root, args.frame,
        only={"front", "side", "reach", "crouch", "instrument-grip-close"},
    )
    scene_file = root / f"{args.frame}-AUTOBIND-EXPERIMENT-not-validated.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(scene_file))
    report["editableExperimentalScene"] = scene_file.name
    # Only a completely normalized pilot can produce an inspectable GLB;
    # otherwise the Blender source/PNGs and truthful failure report remain.
    audit = report["initialSkinAudit"]
    if not (audit["unweightedVertices"] or audit["overInfluencedVertices"] or
            audit["unnormalisedVertices"] or audit["invalidWeights"]):
        try:
            report["experimentalGLB"] = candidate_export(args.frame, root, rig, body, eyes)
        except (RuntimeError, ValueError) as exc:
            report["glbBlockingIssue"] = str(exc)
    else:
        report["glbBlockingIssue"] = "Real skin-weight audit did not pass basic binary requirements"
    print(f"[phase1/pilot] {args.frame}: actual CC0 sculpt {len(neutral)} vertices; "
          f"reach={report['reachMaxVertexDisplacementMm']}mm, "
          f"missing deform groups={len(audit['missingDeformBones'])}; UNAPPROVED")
except Exception as exc:
    report["error"] = str(exc)
    report["traceback"] = traceback.format_exc()
    raise
finally:
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                           encoding="utf8")
