"""Audit real RockMundo Avatar V2 nose/ear sculpt topology in a working .blend.

Run AFTER manual sculpting, fitted armature and skin weights:
  blender work/avatar-v2-masculine-regions.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_topology_audit.py -- \
    --armature RMV2_Armature --json work/avatar-v2-masculine-topology.json

Landmarks are vertex groups on ONE continuous head mesh, not new detached
meshes, empty objects or shader names. This is authoring QA, not an asset
generator; a stock CC0 base does not automatically satisfy this contract.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import bpy

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from facial_topology import MIN_VERTICES, audit_face_topology  # noqa: E402


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--armature", default="RMV2_Armature")
    parser.add_argument("--mesh", help="Exact skinned head mesh; autodetected by landmark groups if omitted.")
    parser.add_argument("--json", help="Optional local report path for artist review.")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def head_candidates(mesh_name: str | None) -> list[bpy.types.Object]:
    if mesh_name:
        obj = bpy.data.objects.get(mesh_name)
        return [obj] if obj and obj.type == "MESH" else []
    names = set(MIN_VERTICES)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    return sorted(
        (obj for obj in meshes if any(group.name in names for group in obj.vertex_groups)),
        key=lambda obj: sum(group.name in names for group in obj.vertex_groups),
        reverse=True,
    )


def extract_landmarks(obj: bpy.types.Object):
    groups = {name: [] for name in MIN_VERTICES}
    group_indexes = {
        group.index: group.name
        for group in obj.vertex_groups
        if group.name in MIN_VERTICES
    }
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        xyz = (float(point.x), float(point.y), float(point.z))
        for assignment in vertex.groups:
            if assignment.group in group_indexes and assignment.weight >= .5:
                groups[group_indexes[assignment.group]].append(xyz)
    return groups


def main() -> int:
    args = cli_args()
    issues: list[str] = []
    rig = bpy.data.objects.get(args.armature)
    if not rig or rig.type != "ARMATURE":
        issues.append(f"Required fitted armature {args.armature!r} is missing.")
    candidates = head_candidates(args.mesh)
    head = candidates[0] if candidates else None
    if not head:
        issues.append("No head mesh with RMV2 nose/ear sculpt vertex groups found.")
    elif len(candidates) > 1 and not args.mesh and sum(
        group.name in MIN_VERTICES for group in candidates[0].vertex_groups
    ) == sum(group.name in MIN_VERTICES for group in candidates[1].vertex_groups):
        issues.append("Multiple head landmark candidates tie; use --mesh to select the continuous sculpt.")
    groups = extract_landmarks(head) if head else {name: [] for name in MIN_VERTICES}
    anchors = {}
    if rig and rig.type == "ARMATURE":
        for side in ("L", "R"):
            bone = rig.data.bones.get(f"EarAnchor.{side}")
            if bone:
                location = rig.matrix_world @ bone.head_local
                anchors[f"EarAnchor.{side}"] = (
                    float(location.x), float(location.y), float(location.z),
                )
    if head and rig and rig.type == "ARMATURE":
        if not any(mod.type == "ARMATURE" and mod.object == rig for mod in head.modifiers):
            issues.append("Head landmark geometry must be skinned to the fitted RMV2 armature.")
        used = {
            polygon.material_index for polygon in head.data.polygons
            if polygon.loop_total >= 3
        }
        if not any(
            slot < len(head.material_slots)
            and head.material_slots[slot].material
            and "skin" in head.material_slots[slot].material.name.lower()
            for slot in used
        ):
            issues.append("Continuous head needs a genuinely used skin material.")
    if head:
        issues.extend(audit_face_topology(groups, anchors))

    report = {
        "pass": not issues,
        "head": head.name if head else None,
        "armature": rig.name if rig else None,
        "landmarkVertices": {key: len(value) for key, value in groups.items()},
        "issues": issues,
    }
    print(json.dumps(report, indent=2))
    if args.json:
        path = pathlib.Path(args.json).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 2 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
