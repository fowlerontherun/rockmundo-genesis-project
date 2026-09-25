"""Tint the source body's EXISTING sculpted lips with independent Blender materials.

No flat cosmetic plane is placed over the mouth. Existing polygon loops, UVs and
14k+ source body vertices are preserved, with different preview shading for
real upper lip, lower lip and the transitional vermilion boundary.
"""
from __future__ import annotations

from mathutils import Vector

from lip_lookdev import LIP_ROLES, classify_lip_polygon, validate_coverage

PALETTES = {
    "masculine": {
        "transition": (.637, .407, .325, 1.),
        "upper_lip": (.535, .322, .289, 1.),
        "lower_lip": (.584, .360, .319, 1.),
    },
    "feminine": {
        "transition": (.673, .443, .372, 1.),
        "upper_lip": (.576, .336, .308, 1.),
        "lower_lip": (.624, .385, .358, 1.),
    },
}


def apply_real_lip_materials(frame, body, eyes, material_factory):
    if frame not in PALETTES or set(eyes) != {"L", "R"}:
        raise ValueError("Both genuine source eye objects and a recognised frame are required.")
    from rockmundo_avatar_v2_source_lookdev import mesh_bounds_local

    eye_pivots = []
    radii = []
    for obj in (eyes["L"], eyes["R"]):
        centre, radius_local = mesh_bounds_local(obj)
        centre = obj.matrix_world @ centre
        scales = obj.matrix_world.to_scale()
        radius = radius_local * sum(scales) / 3.
        eye_pivots.append(centre)
        radii.append(radius)
    midpoint = (eye_pivots[0] + eye_pivots[1]) / 2.
    radius = sum(radii) / len(radii)
    before_vertices = len(body.data.vertices)
    before_polygons = len(body.data.polygons)
    before_uv = len(body.data.uv_layers)

    materials = {
        role: material_factory(
            f"RMV2_Preview_{role}_{frame}", PALETTES[frame][role],
            .53 if role == "transition" else .46 if role == "upper_lip" else .39,
            clearcoat=.026 if role == "transition" else .06,
        )
        for role in LIP_ROLES[1:]
    }
    # Existing skin material stays slot zero, so the face is not stripped of
    # UVs, rest-sculpt normals or future editable facial material regions.
    if len(body.data.materials) != 1 or body.data.materials[0] is None:
        raise RuntimeError("Lips need the preceding source skin lookdev material.")
    slots = {"skin": 0}
    for role, material in materials.items():
        slots[role] = len(body.data.materials)
        body.data.materials.append(material)

    normal_matrix = body.matrix_world.inverted_safe().to_3x3().transposed()
    counts = {name: 0 for name in LIP_ROLES}
    for polygon in body.data.polygons:
        centre = sum(
            (body.data.vertices[i].co for i in polygon.vertices), Vector()
        ) / len(polygon.vertices)
        world = body.matrix_world @ centre
        normal = (normal_matrix @ polygon.normal).normalized()
        role = classify_lip_polygon(
            tuple(world), tuple(normal), tuple(midpoint), radius,
        )
        polygon.material_index = slots[role]
        counts[role] += 1
    validate_coverage(counts, len(body.data.polygons))
    if (len(body.data.vertices) != before_vertices
            or len(body.data.polygons) != before_polygons
            or len(body.data.uv_layers) != before_uv):
        raise RuntimeError("Lip lookdev must never retopologise the source head.")

    return {
        "sourceBody": body.name,
        "upperLipPolygons": counts["upper_lip"],
        "lowerLipPolygons": counts["lower_lip"],
        "edgeBlendPolygons": counts["transition"],
        "skinPolygons": counts["skin"],
        "lipMaterialSlots": slots,
        "sourceVertexCountPreserved": True,
        "sourceUVCountPreserved": True,
        "sourceSculptLipShape": "existing CC0 geometry, unchanged",
        "previewOnly": True,
        "lipDeformationAuthored": False,
    }
