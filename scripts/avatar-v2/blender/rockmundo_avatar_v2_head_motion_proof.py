"""Generate an ACTUAL but deliberately UNAPPROVED V2 head-turn/eye-gaze rig proof.

The output is independent of the pristine real source, improved lookdev and
manually editable fitting-handle scenes. Only Head/Neck/body-anchor and the
two *measured* eyeballs receive preliminary weights. Eyebrows, lashes and
corneas get simple rigid experimental attachment, not blink deformation.

Run this from build_seed_artifacts after the genuine lookdev, guide and
artist-fit-handle .blend files have been saved. Never use its GLB in live V2.
"""
from __future__ import annotations

import json
import math
import pathlib
import struct
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from head_motion_weights import (  # noqa: E402
    body_weights, rigid_weights, validate_draft_weights,
)

EXPERIMENT_NAME = "head-rig-experiment"
REQUIRED = ("Hips", "Neck", "Head", "Eye.L", "Eye.R")


def _as_world(obj: bpy.types.Object, vertex: bpy.types.MeshVertex) -> tuple[float, float, float]:
    return tuple(float(v) for v in obj.matrix_world @ vertex.co)


def _assign_vertex_weights(obj: bpy.types.Object, weights: list[dict[str, float]]) -> dict:
    for name in REQUIRED:
        group = obj.vertex_groups.get(name)
        if group:
            obj.vertex_groups.remove(group)
    groups = {name: obj.vertex_groups.new(name=name) for name in REQUIRED}
    report = validate_draft_weights(
        weights,
        vertex_count=len(obj.data.vertices),
        group_names=set(groups),
        source_verified_eyes=True,
    )
    for i, skin in enumerate(weights):
        for name, value in skin.items():
            groups[name].add([i], value, "REPLACE")
    modifier = obj.modifiers.new("RMV2_UNAPPROVED_head_motion_only", "ARMATURE")
    modifier.object = bpy.data.objects["RMV2_Armature"]
    modifier.use_vertex_groups = True
    obj["rockmundoAvatarV2ExperimentalHeadWeightOnly"] = True
    obj["rockmundoAvatarV2ProductionValidated"] = False
    return report


def _side_of(name: str) -> str | None:
    lower = name.lower()
    if lower.endswith((".eye.l", "cornea.l")):
        return "L"
    if lower.endswith((".eye.r", "cornea.r")):
        return "R"
    return None


def _world_mesh_delta(
    obj: bpy.types.Object,
    before: list[tuple[float, float, float]],
    selected: list[int],
) -> float:
    if not selected:
        raise RuntimeError(f"Experimental deformation sample is empty on {obj.name}.")
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        if len(mesh.vertices) != len(before):
            raise RuntimeError("A source modifier changed vertex order; cannot audit deformation.")
        changed = []
        for index in selected:
            location = evaluated.matrix_world @ mesh.vertices[index].co
            changed.append((location - Vector(before[index])).length)
        return sum(changed) / len(changed)
    finally:
        evaluated.to_mesh_clear()


def _check_glb_skins(path: pathlib.Path) -> dict:
    """Inspect real GLB JSON chunk instead of believing a file extension."""
    with path.open("rb") as inp:
        header = inp.read(12)
        if len(header) != 12:
            raise RuntimeError("Experimental GLB header was not written.")
        magic, version, total_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise RuntimeError("Experimental GLB has an invalid glTF 2.0 container.")
        count, kind = struct.unpack("<II", inp.read(8))
        if kind != 0x4E4F534A:
            raise RuntimeError("Experimental GLB did not begin with a JSON chunk.")
        scene = json.loads(inp.read(count))
    skins = scene.get("skins", [])
    if not skins or max(len(item.get("joints", [])) for item in skins) < 5:
        raise RuntimeError("Experimental exported GLB has no actual multi-joint skin.")
    skinned = sum(
        1 for mesh in scene.get("meshes", []) for prim in mesh.get("primitives", [])
        if "JOINTS_0" in prim.get("attributes", {}) and "WEIGHTS_0" in prim.get("attributes", {})
    )
    if skinned < 3:
        raise RuntimeError("Actual source body and both eye spheres must export real vertex skin data.")
    if scene.get("animations"):
        raise RuntimeError("Static experimental proof must not claim an authored performance animation.")
    return {
        "gltfSkins": len(skins),
        "gltfSkinnedPrimitives": skinned,
        "gltfJointCount": max(len(item["joints"]) for item in skins),
        "actualSkinBuffers": True,
    }


def build_head_motion_experiment(
    frame: str,
    rig: bpy.types.Object,
    body: bpy.types.Object,
    eyes: dict[str, bpy.types.Object],
    detail_meshes: list[bpy.types.Object],
    source_joint_report: dict,
    frame_dir: pathlib.Path,
    render_views,
) -> dict:
    if rig.name != "RMV2_Armature" or rig.get("rockmundoAvatarV2RequiresManualFit") is not True:
        raise RuntimeError("The experiment needs the UNFITTED RockMundo rig guide.")
    if source_joint_report.get("rigFitted") is not False or source_joint_report.get("artistReviewed") is not False:
        raise RuntimeError("The experiment is exclusively for source-measured, non-approved anatomy.")
    source_points = {
        item["bone"]: Vector(item["position"])
        for item in source_joint_report["suggestions"]
    }
    if set(source_points) != {"Eye.L", "Eye.R", "EarAnchor.L", "EarAnchor.R"}:
        raise RuntimeError("Missing independent CC0 eye and ear measurements.")
    if len(detail_meshes) < 11 or any(obj.type != "MESH" for obj in detail_meshes):
        raise RuntimeError("The proof needs the actual body, eyes, corneas, brow and lash meshes.")
    if rig.data.bones.get("Hips") is None or rig.data.bones.get("Head") is None:
        raise RuntimeError("No intact named V2 skeletal guide.")

    # Fit ONLY the eye bones to actual measured eye-sphere centres. The head
    # and neck pivots remain approximate so no completion badge is ever given.
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    inverse = rig.matrix_world.inverted_safe()
    for side in ("L", "R"):
        eye = rig.data.edit_bones[f"Eye.{side}"]
        measured = inverse @ source_points[f"Eye.{side}"]
        eye.head = measured
        eye.tail = measured + Vector((0, -.025, 0))
        eye.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")

    eye_z = (source_points["Eye.L"].z + source_points["Eye.R"].z) / 2
    pivot_z = (rig.matrix_world @ rig.data.bones["Head"].head_local).z
    before: dict[str, list[tuple[float, float, float]]] = {}
    weight_reports = {}
    for obj in detail_meshes:
        original = [_as_world(obj, vertex) for vertex in obj.data.vertices]
        before[obj.name] = original
        side = _side_of(obj.name)
        if obj == body:
            draft = [body_weights(point, pivot_z, eye_z) for point in original]
        elif obj in eyes.values() or side:
            side = side or next(key for key, value in eyes.items() if value == obj)
            draft = [rigid_weights(f"Eye.{side}") for _ in original]
        else:
            draft = [rigid_weights("Head") for _ in original]
        weight_reports[obj.name] = _assign_vertex_weights(obj, draft)

    rig["rockmundoAvatarV2ExperimentalHeadMotion"] = True
    rig["rockmundoAvatarV2ArtistApproved"] = False
    rig["rockmundoAvatarV2RequiresManualFit"] = True
    rig["rockmundoAvatarV2SkinWeightsAuthored"] = False
    rig["rockmundoAvatarV2ProductionValidated"] = False

    # A separate editable .blend contains genuine Blender skin modifiers and
    # the actual, unreviewed V2 guide skeleton; source/artist scenes are safe.
    scene_path = frame_dir / f"{frame}-{EXPERIMENT_NAME}-UNAPPROVED.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(scene_path))

    # Apply a modest exploratory head turn and gaze. Never author a fake
    # jawOpen/blink or claim these are valid gig playback animations.
    head = rig.pose.bones["Head"]
    head.rotation_mode = "XYZ"
    head.rotation_euler.z = math.radians(16)
    for side in ("L", "R"):
        eye = rig.pose.bones[f"Eye.{side}"]
        eye.rotation_mode = "XYZ"
        eye.rotation_euler.z = math.radians(-7)
    bpy.context.view_layer.update()

    head_vertices = [i for i, point in enumerate(before[body.name]) if point[2] > eye_z - .006]
    still_vertices = [
        i for i, point in enumerate(before[body.name])
        if .43 < point[2] < .95 and abs(point[0]) < .20
    ]
    head_shift = _world_mesh_delta(body, before[body.name], head_vertices)
    torso_shift = _world_mesh_delta(body, before[body.name], still_vertices)
    eye_shift = {
        side: _world_mesh_delta(obj, before[obj.name], list(range(len(obj.data.vertices))))
        for side, obj in eyes.items()
    }
    if head_shift < .004 or torso_shift > .0005 or any(value < .004 for value in eye_shift.values()):
        raise RuntimeError(
            "Experimental skinning does not produce an isolated, measurable head turn/gaze: "
            + json.dumps({"head": head_shift, "torso": torso_shift, "eyes": eye_shift})
        )

    # Proof renders contain real deformed CC0 geometry from the evaluated
    # Blender armature. Still only A-pose-derived experimentation.
    views = render_views(
        frame, detail_meshes, frame_dir, styled=True, tag=EXPERIMENT_NAME,
    )
    glb_path = frame_dir / f"{frame}-HEAD-RIG-EXPERIMENT-not-validated.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in detail_meshes:
        mesh.select_set(True)
        mesh["rockmundoAvatarV2PreviewOnly"] = True
    rig.select_set(True)
    rig["rockmundoAvatarV2PreviewOnly"] = True
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_animations=False,
        export_extras=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
    )
    evidence = _check_glb_skins(glb_path)
    for mesh in detail_meshes:
        mesh.pop("rockmundoAvatarV2PreviewOnly", None)
    rig.pop("rockmundoAvatarV2PreviewOnly", None)
    head.rotation_euler.zero()
    for side in ("L", "R"):
        rig.pose.bones[f"Eye.{side}"].rotation_euler.zero()
    bpy.context.view_layer.update()
    return {
        "schema": "rockmundo.avatar-v2-head-rig-experiment",
        "version": 1,
        "frame": frame,
        "scene": scene_path.name,
        "preview": glb_path.name,
        "views": views,
        "realCC0MeshesBound": len(detail_meshes),
        "sampledHeadVertices": len(head_vertices),
        "sampledStableTorsoVertices": len(still_vertices),
        "headTurnDegrees": 16,
        "eyeCounterTurnDegrees": -7,
        "headMeanDisplacementMm": round(head_shift * 1000, 3),
        "torsoMeanDisplacementMm": round(torso_shift * 1000, 3),
        "eyeMeanDisplacementMm": {side: round(value * 1000, 3) for side, value in eye_shift.items()},
        "maxInfluences": max(item["maxInfluences"] for item in weight_reports.values()),
        "eyeCentresFromRealGeometry": True,
        "guideHeadPivotStillUnfitted": True,
        "draftWeightsOnly": True,
        "artistReviewed": False,
        "fullBodySkinned": False,
        "faceMorphsAuthored": False,
        "productionValidated": False,
        **evidence,
    }
