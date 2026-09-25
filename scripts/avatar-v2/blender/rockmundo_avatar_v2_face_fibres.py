"""Fit *real* individual eyebrow/eyelash fibres to source head geometry.

Source A-pose lookdev only. Every brow strip and 3D hair follicle is raycast
onto the continuous actual CC0 skin mesh; nothing is left hovering at guessed
y-coordinates or exported as just an alpha texture. The author still must
weight/bind lashes and author bilateral blink morphs for an eventual V2 export.
"""
from __future__ import annotations

from math import sin, pi

import bpy
from mathutils import Vector

from facial_fibres import (
    brow_fibre_samples, brow_profile, sweep_tapered_fibre, upper_lash_roots,
)


def eye_world_dimensions(eye_obj: bpy.types.Object) -> tuple[tuple[float, float, float], float]:
    positions = [vertex.co for vertex in eye_obj.data.vertices]
    if not positions:
        raise RuntimeError("Eyebrow generation requires an actual eye-sphere mesh.")
    mini = Vector(tuple(min(p[axis] for p in positions) for axis in range(3)))
    maxi = Vector(tuple(max(p[axis] for p in positions) for axis in range(3)))
    centre = eye_obj.matrix_world @ ((mini + maxi) * .5)
    scales = eye_obj.matrix_world.to_scale()
    radius = sum((maxi[i] - mini[i]) * scales[i] for i in range(3)) / 6.
    return tuple(centre), radius


def skin_projector(body: bpy.types.Object):
    """Returns world-space closest *front-facing* CC0 skin, never the eyeball."""
    inverse = body.matrix_world.inverted_safe()
    world_start_y = min((body.matrix_world @ Vector(corner)).y for corner in body.bound_box) - .09
    origin_local_depth = (inverse.to_3x3() @ Vector((0., .88, 0.))).length
    forward_local = (inverse.to_3x3() @ Vector((0., 1., 0.))).normalized()
    world_normal_matrix = inverse.to_3x3().transposed()

    def project(x: float, z: float, front_of: float):
        start = Vector((x, world_start_y, z))
        hit, point, normal, _ = body.ray_cast(
            inverse @ start, forward_local, distance=origin_local_depth,
        )
        if not hit:
            return None
        pos = body.matrix_world @ point
        world_normal = (world_normal_matrix @ normal).normalized()
        # Reject the inside back of a face or an eyeless head wall behind an
        # eyelid aperture. In particular, an eyelash root cannot appear from
        # inside the ocular sphere or a rigid cheek cut-out.
        if world_normal.y > -.13 or pos.y >= front_of:
            return None
        return Vector((x, pos.y, z))
    return project


def make_mesh(
    name: str,
    vertices: list[tuple[float, float, float] | Vector],
    faces: list[tuple[int, ...]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    smooth: bool = True,
) -> bpy.types.Object:
    if not vertices or not faces:
        raise RuntimeError(f"{name} did not create any genuine visible 3D polygons.")
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata([tuple(p) for p in vertices], [], faces)
    mesh.update()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["rockmundoAvatarV2PreviewOnly"] = True
    obj["rockmundoAvatarV2NeedsHeadSkinning"] = True
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    return obj


def create_fibre_mesh(
    name: str,
    splines: list[tuple[tuple[float, float, float], ...]],
    width: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for path in splines:
        strand_vertices, strand_faces = sweep_tapered_fibre(path, width)
        offset = len(vertices)
        vertices.extend(strand_vertices)
        faces.extend(tuple(index + offset for index in quad) for quad in strand_faces)
    obj = make_mesh(name, vertices, faces, collection, material)
    obj["rockmundoAvatarV2PhysicalFibres"] = len(splines)
    return obj


def create_brow_and_lashes(
    frame: str,
    side: str,
    body: bpy.types.Object,
    eyeball: bpy.types.Object,
    collection: bpy.types.Collection,
    brow_material: bpy.types.Material,
    strand_material: bpy.types.Material,
    lash_material: bpy.types.Material,
) -> dict:
    eye, radius = eye_world_dimensions(eyeball)
    project = skin_projector(body)
    # Skin for brow fibres must be ahead of the eye centre; front/head depth
    # follows the artist's actual source mesh, including brow-bone contour.
    front_limit = eye[1] - .002

    brow_vertices: list[Vector] = []
    brow_faces: list[tuple[int, int, int, int]] = []
    sign = 1 if side == "L" else -1
    for index, (x, z, halfwidth) in enumerate(brow_profile(eye, radius, side)):
        upper = project(x, z + halfwidth, front_limit)
        lower = project(x, z - halfwidth, front_limit)
        if upper is None or lower is None:
            raise RuntimeError(
                f"{frame} {side} brow vertex {index} did not find real frontal skin. "
                "Retarget the brow arc on the source rather than leaving it floating."
            )
        # Tiny forward offset: physically sits in the skin's upper layer,
        # without the extreme displacement of fake in-air brow meshes.
        lower.y -= .00105
        upper.y -= .00105
        brow_vertices.extend((lower, upper))
        if index:
            a = (index - 1) * 2
            b = index * 2
            quad = (a, b, b + 1, a + 1)
            brow_faces.append(quad if sign > 0 else tuple(reversed(quad)))
    brow = make_mesh(
        f"RMV2_PreviewBrow.{side}", brow_vertices, brow_faces,
        collection, brow_material, smooth=False,
    )
    # Existing source silhouette is unchanged; UVs allow later intentional
    # groom/colour variation instead of inheriting one flat generated shader.
    uv = brow.data.uv_layers.new(name="RMV2_BrowGroomUV")
    columns = len(brow_vertices) // 2
    for polygon in brow.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = brow.data.loops[loop_index].vertex_index
            uv.data[loop_index].uv = (
                (vertex_index // 2) / (columns - 1), vertex_index % 2,
            )

    brow_paths = []
    for index, (x, z, length, offset) in enumerate(brow_fibre_samples(eye, radius, side)):
        centres = []
        for dx, dz, extra_forward in (
            (0., 0., 0.),
            (sign * length * .45, length * .28, .00042),
            (sign * length, length * .22, .00022),
        ):
            pos = project(x + dx, z + dz, front_limit)
            if pos is None:
                raise RuntimeError(
                    f"{frame} {side} brow follicle {index} does not sit on the actual skin."
                )
            pos.y -= offset + extra_forward
            centres.append(tuple(pos))
        brow_paths.append(tuple(centres))
    strands = create_fibre_mesh(
        f"RMV2_PreviewBrowFibres.{side}", brow_paths,
        .00022, collection, strand_material,
    )

    lashes = []
    # The upper-eyelid opening is an actual hole in this source topology;
    # project roots only onto the real frontal rim, never onto the head's
    # internal rear surface when a ray passes through the eye aperture.
    for index, (x, z, length) in enumerate(upper_lash_roots(eye, radius, side)):
        root = None
        for attempt in range(8):
            proposed = project(x, z + attempt * .0022, front_limit)
            if proposed is not None:
                root = proposed
                break
        if root is None:
            raise RuntimeError(
                f"{frame} {side} upper eyelid fibre {index} has no frontal lid rim. "
                "An artist must fit eyelashes to this source topology."
            )
        root.y -= .0008
        fan = max(0., sign * (x - eye[0]) / radius)
        mid = root + Vector((
            sign * (.0013 + .0015 * fan), -length * .30, length * .27,
        ))
        tip = root + Vector((
            sign * (.003 + .002 * fan), -length * .84, length * (.47 + .13 * fan),
        ))
        lashes.append((tuple(root), tuple(mid), tuple(tip)))
    lash_mesh = create_fibre_mesh(
        f"RMV2_PreviewUpperLashes.{side}", lashes,
        .00023 if frame == "feminine" else .00019,
        collection, lash_material,
    )

    return {
        "side": side,
        "eyeRadiusMm": round(radius * 1000., 3),
        "brow": brow.name,
        "browVertices": len(brow_vertices),
        "groom": strands.name,
        "groomFibres": len(brow_paths),
        "upperLashes": lash_mesh.name,
        "upperLashFibres": len(lashes),
        "newGeometryVertices": (
            len(brow.data.vertices)
            + len(strands.data.vertices)
            + len(lash_mesh.data.vertices)
        ),
        "rootProjection": "actual CC0 continuous frontal skin",
        "unweightedPreviewOnly": True,
    }


def add_real_brow_lash_geometry(
    frame: str,
    body: bpy.types.Object,
    eyes: dict[str, bpy.types.Object],
    collection: bpy.types.Collection,
) -> list[dict]:
    from rockmundo_avatar_v2_source_lookdev import preview_material, FRAME_COLOURS

    colours = FRAME_COLOURS[frame]
    # The dark groom is intentionally independent of scalp colour, because
    # saved eyebrow colour/style must not be fused into a skin tattoo texture.
    # The neutral face proof showed that a high-contrast solid dark strip
    # resembles painted-on brows. Use a lighter groom base and darker,
    # individually modelled strands; more of the brow's apparent detail now
    # comes from actual independent 3D hair.
    base = (.26, .152, .112, 1.) if frame == "masculine" else (.32, .193, .143, 1.)
    lighter = (.145, .084, .060, 1.) if frame == "masculine" else (.17, .092, .066, 1.)
    brow_mat = preview_material(f"RMV2_PreviewBrow_{frame}", base, .88)
    fibres_mat = preview_material(f"RMV2_PreviewBrowGroom_{frame}", lighter, .76)
    lash_mat = preview_material(f"RMV2_PreviewLashes_{frame}", (.05, .034, .029, 1.), .7)
    return [
        create_brow_and_lashes(
            frame, side, body, eyes[side], collection, brow_mat, fibres_mat, lash_mat,
        )
        for side in ("L", "R")
    ]
