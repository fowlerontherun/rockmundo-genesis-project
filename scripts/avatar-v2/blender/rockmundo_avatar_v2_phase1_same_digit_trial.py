"""Actual BLENDER provisional same-finger skin experiment on a SEPARATE source copy.

Load ONLY the genuine same-run <frame>-AUTOBIND-EXPERIMENT-not-validated.blend.
This never writes into the original .blend or any public/runtime path.
The original source JSON's actual original mesh-edge topology is independently
RECOMPUTED from original Blender polygon edges/weights before applying a
candidate. Wrong-finger skin and already-painted artist assets are untouchable.
Even a numerically successful trial is NOT anatomically fit or approved.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import sys
import traceback

import bpy

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
from phase1_body_contract import DIGITS, DEFORM_BONES  # noqa: E402
from phase1_finger_topology import trace_missing_finger_source  # noqa: E402
from phase1_finger_trial import propose_quarantined_finger_trial  # noqa: E402
from rockmundo_avatar_v2_phase1_body import (  # noqa: E402
    ARMATURE, audit_weights, mesh_world_positions, render_contact_sheet,
    set_pose, vertex_weights,
)


def cli_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--frame", required=True, choices=("masculine", "feminine"))
    p.add_argument("--probe-report", type=pathlib.Path, required=True)
    p.add_argument("--output-root", type=pathlib.Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return p.parse_args(argv)


args = cli_args()
trial_dir = args.output_root.resolve() / args.frame / "same-digit-trial"
if "public" in trial_dir.parts:
    raise SystemExit("Unapproved same-digit trials must never touch public asset paths")
trial_dir.mkdir(parents=True, exist_ok=True)
report_file = trial_dir / f"{args.frame}-UNFITTED-SAME-DIGIT-TRIAL-report.json"
report = {
    "schema": "rockmundo.avatar-v2-source-same-digit-blender-trial",
    "frame": args.frame, "sourceUnfitted": True,
    "artistReviewed": False, "productionValidated": False,
    "approvedForGameplay": False, "approvedForGigs": False,
    "originalSourceUnchanged": True,
}
try:
    scene = bpy.context.scene
    rig = bpy.data.objects.get(ARMATURE)
    if (pathlib.Path(bpy.data.filepath).name !=
            f"{args.frame}-AUTOBIND-EXPERIMENT-not-validated.blend"
            or scene.get("rockmundoAvatarV2SourceFrame") != args.frame
            or rig is None or rig.type != "ARMATURE"
            or rig.get("rockmundoAvatarV2RequiresManualFit") is not True
            or rig.get("rockmundoAvatarV2ArtistFitReport")):
        raise RuntimeError("Trial requires untouched same-frame UNFITTED real Blender heat scene")

    raw_report = args.probe_report.read_bytes()
    pilot = json.loads(raw_report)
    if (pilot.get("frame") != args.frame or
            pilot.get("schema") != "rockmundo.avatar-v2-unfitted-binding-experiment"
            or pilot.get("productionValidated") is not False
            or pilot.get("artistReviewed") is not False or pilot.get("error")
            or pilot.get("bindingRestSurfaceShiftMm", 999) > 1):
        raise RuntimeError("Rejecting missing/stale/approved/shifted source-pilot provenance")
    body = bpy.data.objects.get(pilot.get("realSourceBody", ""))
    if (body is None or body.type != "MESH" or
            len(body.data.vertices) != pilot.get("realSourceVertices")
            or len(body.data.vertices) != 12502
            or not any(m.type == "ARMATURE" and m.object == rig
                       for m in body.modifiers)):
        raise RuntimeError("The exact original genuine CC0 body/armature must be present")
    report["realSourceVertices"] = len(body.data.vertices)
    report["sourceProbeSha256"] = hashlib.sha256(raw_report).hexdigest()
    report["bodyName"] = body.name
    before = audit_weights(body, rig)
    if before["missingDeformBones"] != pilot["initialSkinAudit"]["missingDeformBones"]:
        raise RuntimeError("Trial source differs from the saved original bone-heat weight audit")
    report["initialMissingDeformBones"] = before["missingDeformBones"]
    report["initialInsufficientBoneCoverage"] = before["insufficientDeformBones"]
    segments = {
        f"{digit}{joint}.{side}": (
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].head_local),
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].tail_local),
        )
        for side in ("L", "R") for digit in DIGITS for joint in (1, 2, 3)
    }
    surface = [tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    weights = [vertex_weights(body, vertex, set(DEFORM_BONES))
               for vertex in body.data.vertices]
    original_geometry = surface[:]
    # This is a second, independent read of ORIGINAL CC0 polygons/weights.
    # It catches a misleading reused JSON or an edited/different Blender file.
    recomputed = trace_missing_finger_source(
        surface, [tuple(int(i) for i in edge.vertices) for edge in body.data.edges],
        weights, segments,
    )
    if recomputed != pilot.get("fingerTopologyAnchors"):
        raise RuntimeError("Source mesh topology or bone heat changed since same-run trace")
    proposed, trial = propose_quarantined_finger_trial(
        surface, weights, segments, recomputed
    )
    report["conservativeTrial"] = trial
    if proposed:
        for vertex_index, new_weights in proposed.items():
            original = weights[vertex_index]
            for bone in original:
                if bone not in new_weights:
                    body.vertex_groups[bone].remove([vertex_index])
            for bone, value in new_weights.items():
                group = body.vertex_groups.get(bone) or body.vertex_groups.new(name=bone)
                group.add([vertex_index], value, "REPLACE")
        after = audit_weights(body, rig)
        if (after["unweightedVertices"] or after["overInfluencedVertices"] or
                after["unnormalisedVertices"] or after["invalidWeights"]
                or after["nonBodyBoneInfluences"]):
            raise RuntimeError("Blender trial failed original four-influence real-skin rules")
        new = sorted(set(before["missingDeformBones"]) - set(after["missingDeformBones"]))
        claimed = sorted(k for k, v in trial["perFinger"].items()
                         if v["appliedInIsolatedTrial"])
        if new != claimed:
            raise RuntimeError("Never claim an improved finger without actual Blender deform weights")
        if any(math.dist(a, b) > .000001 for a, b in zip(
            original_geometry,
            [tuple(body.matrix_world @ v.co) for v in body.data.vertices],
        )):
            raise RuntimeError("Candidate starter paint changed actual CC0 rest body positions")

        # Isolate ONLY newly skinned finger joint motion: not the entire
        # existing reach pose, which could falsely demonstrate an improvement.
        set_pose(rig, {})
        neutral = mesh_world_positions(body)
        pose = {name: (0, 1, 0, 65) for name in new}
        set_pose(rig, pose)
        changed = mesh_world_positions(body)
        max_millimetres = round(
            max((changed[i] - neutral[i]).length for i in proposed) * 1000, 3
        )
        set_pose(rig, {})
        if max_millimetres < .5:
            raise RuntimeError("New real finger skin failed isolated evaluated-mesh deformation")
        report["newFingerOnlyMaximumActualDeformationMm"] = max_millimetres
        report["originalUnapprovedMissingBonesAfterTrial"] = after["missingDeformBones"]
        report["newlyInitiallySkinnedBones"] = new
        report["sourceGeometryRestShiftMm"] = 0.0
        report["poseImages"] = render_contact_sheet(
            body, rig, trial_dir, args.frame,
            only={"instrument-grip-close"},
        )
        # This file is expressly an UNFITTED BIND TRIAL, not a reviewed
        # candidate. Do NOT use candidate_export or public/avatar-v2.
        candidate_scene = (trial_dir /
                           f"{args.frame}-UNFITTED-SAME-DIGIT-PAINT-TRIAL-not-validated.blend")
        bpy.ops.wm.save_as_mainfile(filepath=str(candidate_scene))
        report["trialEditableBlenderScene"] = candidate_scene.name
        print(f"[phase1/same-digit-trial] {args.frame}: "
              f"{len(proposed)} actual original CC0 vertices; initial newly weighted={new}; "
              f"isolated joint motion={max_millimetres}mm; UNFITTED, NOT APPROVED")
    else:
        report["newlyInitiallySkinnedBones"] = []
        report["originalUnapprovedMissingBonesAfterTrial"] = before["missingDeformBones"]
        report["noSafeOriginalSkinToTransfer"] = True
        print(f"[phase1/same-digit-trial] {args.frame}: zero safe "
              "same-digit original source paint eligible; zero changes; UNAPPROVED")
except Exception as exc:
    report["error"] = str(exc)
    report["traceback"] = traceback.format_exc()
    raise
finally:
    report_file.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8"
    )
