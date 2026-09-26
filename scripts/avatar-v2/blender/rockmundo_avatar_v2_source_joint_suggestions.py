"""Add real-source eye/ear *suggestion* handles to an unfitted V2 Blender rig.

Unlike the earlier bounding-box guide, the suggestions come from actual source
eyeball vertices and lateral continuous-skin patches. Nothing auto-applies
them to rig bones. Artists can snap the four corresponding RMV2_FIT__ handles
to the reviewed suggestions; all other joint/skin/sculpt gates remain intact.
"""
from __future__ import annotations

import pathlib
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from source_rig_suggestions import source_joint_suggestions  # noqa: E402

COLLECTION_NAME = "RMV2_SourceJointSuggestions"
BONES = ("Eye.L", "Eye.R", "EarAnchor.L", "EarAnchor.R")


def add_source_joint_suggestions(
    frame: str,
    body: bpy.types.Object,
    eyes: dict[str, bpy.types.Object],
    rig: bpy.types.Object,
) -> dict:
    if frame not in ("masculine", "feminine"):
        raise ValueError("Unexpected V2 source frame.")
    if rig.type != "ARMATURE" or rig.name != "RMV2_Armature":
        raise RuntimeError("Only the generated, named V2 source rig may receive anatomical suggestions.")
    if rig.get("rockmundoAvatarV2RequiresManualFit") is not True:
        raise RuntimeError("Refusing to annotate any rig already claiming to be fitted.")
    if body.type != "MESH" or len(eyes) != 2 or set(eyes) != {"L", "R"}:
        raise RuntimeError("Need exactly one continuous source sculpt and two genuine eyeball meshes.")
    previous = bpy.data.collections.get(COLLECTION_NAME)
    if previous and previous.objects:
        raise RuntimeError("Existing artist source joint suggestions must never be overwritten.")
    # The two frames build successively inside one Blender process. The
    # previous frame's objects are removed by clear_scene(), but its now-empty
    # collection can remain linked to the scene. Reuse only that empty
    # collection; never overwrite an occupied artist collection.

    if any(eye.type != "MESH" or eye == body for eye in eyes.values()):
        raise RuntimeError("Eye source references must be independent real mesh objects.")

    head_vertices = [
        tuple(body.matrix_world @ vert.co)
        for vert in body.data.vertices
    ]
    eye_vertices = {
        side: [tuple(obj.matrix_world @ vert.co) for vert in obj.data.vertices]
        for side, obj in eyes.items()
    }
    positions, samples, measured = source_joint_suggestions(head_vertices, eye_vertices)

    # Never mutate RMV2_Armature or its artist-controlled RMV2_FitHandles.
    collection = previous or bpy.data.collections.new(COLLECTION_NAME)
    if not previous:
        bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    inverse = rig.matrix_world.inverted_safe()
    results = []
    for bone in BONES:
        if rig.data.bones.get(bone) is None:
            raise RuntimeError(f"Generated V2 rig is missing {bone}.")
        point = Vector(positions[bone])
        handle = bpy.data.objects.new(f"RMV2_SUGGEST__{bone}", None)
        collection.objects.link(handle)
        handle.empty_display_type = "SPHERE"
        handle.empty_display_size = .011 if bone.startswith("EarAnchor") else .009
        handle.show_name = True
        handle.show_in_front = True
        handle.color = (.09, .89, .90, 1.) if bone.startswith("Eye") else (1., .50, .16, 1.)
        handle.location = point
        handle["rockmundoAvatarV2SuggestedBone"] = bone
        handle["rockmundoAvatarV2SourceMesh"] = (
            eyes[bone.rsplit(".", 1)[1]].name if bone.startswith("Eye.") else body.name
        )
        handle["rockmundoAvatarV2SourceSamples"] = samples[bone]
        handle["rockmundoAvatarV2ArtistReviewed"] = False
        results.append({
            "bone": bone,
            "position": [round(v, 6) for v in point],
            "armatureLocal": [round(v, 6) for v in inverse @ point],
            "sourceMesh": handle["rockmundoAvatarV2SourceMesh"],
            "sourceSamples": samples[bone],
            "realSourceGeometry": True,
            "artistReviewed": False,
        })
    # The rig is still an UNFITTED GUIDE even though four source-derived
    # positions have been measured. Do not mark this as an authored fit.
    rig["rockmundoAvatarV2SourceLandmarkSuggestionsOnly"] = True
    return {
        "schema": "rockmundo.avatar-v2-source-joint-suggestions",
        "version": 1,
        "frame": frame,
        "source": "actual CC0 eyeball and continuous body vertices",
        "eyeRadiiMm": {side: round(eye.radius * 1000, 2) for side, eye in measured.items()},
        "artistReviewed": False,
        "rigFitted": False,
        "skinWeightsAuthored": False,
        "suggestions": results,
    }
