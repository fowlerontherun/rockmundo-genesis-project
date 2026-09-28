"""Run on each REAL source .blend to prove Phase 1 rejects unfitted guides.

This is a Blender integration smoke test, not a surrogate artist fit or a
full-body deformation demonstration. The actual artist-cleaned scene must
pass the separate --mode assess command before becoming a candidate.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
from types import SimpleNamespace

import bpy

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from rockmundo_avatar_v2_phase1_body import preflight  # noqa: E402
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_body_contract import ATTACHMENT_BONES, DEFORM_BONES  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--frame", choices=("masculine", "feminine"), required=True)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
args = parser.parse_args(argv)
rig = bpy.data.objects.get("RMV2_Armature")
if not rig:
    raise SystemExit("Real source Blender guide has no RockMundo armature")
missing = set(DEFORM_BONES + ATTACHMENT_BONES) - set(rig.data.bones.keys())
if missing:
    raise SystemExit("Real source guide lacks bone chains: " + ", ".join(sorted(missing)))
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
if not meshes:
    raise SystemExit("Real source guide has no actual visible meshes")
body = max(meshes, key=lambda o: len(o.data.vertices))
if len(body.data.vertices) < 1000:
    raise SystemExit("Real source has no continuous sculpted body")
candidate = SimpleNamespace(frame=args.frame, body=body.name,
                            output_root=pathlib.Path("work/avatar-v2-phase1-smoke"))
try:
    preflight(candidate)
except RuntimeError as error:
    if "Apply artist-fitted joint handles before binding" not in str(error):
        raise SystemExit(f"Unfitted source was rejected for an UNEXPECTED reason: {error}") from error
    print(f"[phase1] PASS {args.frame}: {body.name} ({len(body.data.vertices)} real vertices), "
          f"{len(rig.data.bones)} real guide bones, "
          "unfitted source correctly rejected from production body preparation.")
else:
    raise SystemExit("FAIL: an UNFITTED source guide was incorrectly accepted for production body binding")
