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
import pathlib
import sys
import traceback

import bpy

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from rockmundo_avatar_v2_phase1_body import (  # noqa: E402
    ARMATURE, POSES, assign_eight_skin_regions, audit_weights, bind_original_eyes,
    candidate_export, drive_correctives, mesh_world_positions,
    render_contact_sheet, selected_parent_bind, set_pose, twist_seed_and_normalise,
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
    "warning": "Poorly positioned guide: rendered body must never enter gameplay or production.",
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
    selected_parent_bind(body, rig)
    twist_seed_and_normalise(body, rig)
    report["initialSkinAudit"] = audit_weights(body, rig)
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
