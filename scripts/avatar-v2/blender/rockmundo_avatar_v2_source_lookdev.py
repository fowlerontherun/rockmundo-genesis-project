"""Non-destructive source lookdev for ACTUAL CC0 RockMundo Avatar V2 scenes.

Builds artist-editable skinned-look *references*, not skinned character assets:
- smooths the authored base's existing polygon normals without subdividing or
  blurring the actual rest-pose silhouette;
- gives body and separate eyeballs distinct physically based preview materials;
- colours the genuine exposed eye-sphere polygons as sclera, iris and pupil;
- adds true curved, separate cornea surfaces over the original eyeball geometry;
- anchors two real polygon eyebrows, their separate 3D fibre grooms and bilateral
  tapered upper lashes onto source skin via per-follicle raycasting.

The original source .blend and unshaded proof images are saved BEFORE this pass.
This must never count as a manual facial sculpt, fitted rig, finished topology or
a validated runtime GLB.
"""
from __future__ import annotations

import pathlib
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from eye_lookdev import choose_eye_material, cornea_dome
from rockmundo_avatar_v2_face_fibres import add_real_brow_lash_geometry

FRAME_COLOURS = {
    "masculine": {
        "skin": (.67, .43, .33, 1.),
        "iris": (.27, .47, .41, 1.),
        "pupil": (.018, .029, .034, 1.),
    },
    "feminine": {
        "skin": (.70, .48, .39, 1.),
        "iris": (.40, .29, .21, 1.),
        "pupil": (.018, .029, .034, 1.),
    },
}


def preview_material(
    name: str,
    colour: tuple[float, float, float, float],
    roughness: float,
    *,
    clearcoat: float = 0.,
    transmission: float = 0.,
    alpha: float = 1.,
    micro_bump: bool = False,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = colour[:3] + (alpha,)
    material.use_nodes = True
    node_tree = material.node_tree
    shader = next(node for node in node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Metallic"].default_value = 0.
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = clearcoat
    shader.inputs["Coat Roughness"].default_value = .06
    shader.inputs["Transmission Weight"].default_value = transmission
    shader.inputs["Alpha"].default_value = alpha
    material["rockmundoPreviewMaterial"] = True
    if alpha < 1.:
        # Blender 4.2+ uses surface_render_method rather than deprecated blend_method.
        material.surface_render_method = "DITHERED"
    if micro_bump:
        # Procedural micro-detail is EDITABLE LOOKDEV, not an exported texture.
        # Production assets will need authored/baked roughness/normal maps.
        texture = node_tree.nodes.new("ShaderNodeTexNoise")
        texture.inputs["Scale"].default_value = 190.
        texture.inputs["Detail"].default_value = 2.8
        texture.inputs["Roughness"].default_value = .7
        bump = node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .11
        bump.inputs["Distance"].default_value = .00045
        node_tree.links.new(texture.outputs["Fac"], bump.inputs["Height"])
        node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


def mesh_bounds_local(obj: bpy.types.Object) -> tuple[Vector, float]:
    points = [vertex.co for vertex in obj.data.vertices]
    if not points:
        raise RuntimeError(f"{obj.name} has no real eye vertices.")
    minimum = Vector([min(point[axis] for point in points) for axis in range(3)])
    maximum = Vector([max(point[axis] for point in points) for axis in range(3)])
    centre = (minimum + maximum) / 2.
    radius = sum(maximum[i] - minimum[i] for i in range(3)) / 6.
    return centre, radius


def lookdev_eye(
    frame: str, side: str, obj: bpy.types.Object, output_collection: bpy.types.Collection,
) -> dict:
    center, radius = mesh_bounds_local(obj)
    if not .015 < radius < .07:
        raise RuntimeError(f"{obj.name} is not a plausible real-scale authored eye sphere (r={radius:.3f}m).")
    inverse = obj.matrix_world.to_3x3().inverted()
    forward = (inverse @ Vector((0., -1., 0.))).normalized()
    up = (inverse @ Vector((0., 0., 1.))).normalized()
    to_vec3 = lambda point: tuple(float(point[i]) for i in range(3))

    colours = FRAME_COLOURS[frame]
    sclera = preview_material(f"RMV2_Preview_Sclera_{frame}_{side}", (.91, .88, .83, 1.), .27)
    iris = preview_material(f"RMV2_Preview_Iris_{frame}_{side}", colours["iris"], .30)
    pupil = preview_material(f"RMV2_Preview_Pupil_{frame}_{side}", colours["pupil"], .19)
    obj.data.materials.clear()
    for material in (sclera, iris, pupil):
        obj.data.materials.append(material)
    counts = {"sclera": 0, "iris": 0, "pupil": 0}
    indexes = {"sclera": 0, "iris": 1, "pupil": 2}
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
        position = sum((obj.data.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        role = choose_eye_material(
            to_vec3(position), to_vec3(center), to_vec3(forward), radius,
        )
        polygon.material_index = indexes[role]
        counts[role] += 1
    if counts["pupil"] < 4 or counts["iris"] < 10:
        raise RuntimeError(
            f"Preview {frame} {side} eye has no actual forward-facing iris/pupil geometry: {counts}."
        )

    vertices, faces = cornea_dome(
        to_vec3(center), to_vec3(forward), to_vec3(up), radius,
    )
    cornea_mesh = bpy.data.meshes.new(f"RMV2_PreviewCorneaGeometry.{side}")
    cornea_mesh.from_pydata(vertices, [], faces)
    cornea_mesh.update()
    cornea = bpy.data.objects.new(f"RMV2_PreviewCornea.{side}", cornea_mesh)
    output_collection.objects.link(cornea)
    cornea.parent = obj
    cornea.location = (0., 0., 0.)
    cornea.rotation_euler = (0., 0., 0.)
    cornea.scale = (1., 1., 1.)
    cornea["rockmundoAvatarV2PreviewOnly"] = True
    cornea_mesh.materials.append(preview_material(
        f"RMV2_Preview_Cornea_{frame}_{side}",
        (.96, .99, 1., 1.), .045, clearcoat=1., transmission=.12, alpha=.23,
    ))
    for polygon in cornea_mesh.polygons:
        polygon.use_smooth = True
    return {
        "side": side,
        "radiusMm": round(radius * 1000., 2),
        "existingEyeMaterialPolygons": counts,
        "addedCorneaVertices": len(vertices),
        "addedCorneaFaces": len(faces),
        "sourceEye": obj.name,
        "cornea": cornea.name,
    }


def apply_source_lookdev(frame: str, meshes: list[bpy.types.Object]) -> dict:
    if frame not in FRAME_COLOURS:
        raise ValueError(f"Unexpected authoring frame {frame}.")
    body = [obj for obj in meshes if ".eye." not in obj.name.lower()]
    eyes = {
        side: [obj for obj in meshes if obj.name.lower().endswith(f".eye.{side.lower()}")]
        for side in ("L", "R")
    }
    if len(body) != 1 or any(len(group) != 1 for group in eyes.values()):
        raise RuntimeError(
            "The pinned Blender source must have exactly one main sculpt and "
            "one genuinely separate .eye.L and .eye.R mesh per frame. "
            f"Found {[obj.name for obj in body]} and "
            f"{ {side: [obj.name for obj in matches] for side, matches in eyes.items()} }."
        )
    for obj in meshes:
        obj["rockmundoAvatarV2SourceLookdev"] = True
    skin = preview_material(
        f"RMV2_Preview_Skin_{frame}", FRAME_COLOURS[frame]["skin"],
        .56, clearcoat=.025, micro_bump=True,
    )
    body_obj = body[0]
    body_obj.data.materials.clear()
    body_obj.data.materials.append(skin)
    for poly in body_obj.data.polygons:
        poly.use_smooth = True
        poly.material_index = 0
    collection = body_obj.users_collection[0] if body_obj.users_collection else bpy.context.scene.collection
    eye_reports = [
        lookdev_eye(frame, side, eyes[side][0], collection) for side in ("L", "R")
    ]
    # Real, individually skin-surface-projected brow and upper-lash meshes,
    # separate from sculpt and eye bones for later professional rigging.
    brow_lash_reports = add_real_brow_lash_geometry(
        frame, body_obj, {side: group[0] for side, group in eyes.items()}, collection,
    )
    return {
        "frame": frame,
        "originalBodyVertices": len(body_obj.data.vertices),
        "bodyPolygonsSmoothed": len(body_obj.data.polygons),
        "realEyesRecoloured": len(eye_reports),
        "realCorneasAdded": 2,
        "eyeGeometry": eye_reports,
        "browLashGeometry": brow_lash_reports,
        "realBrowAndLashMeshes": 6,
        "previewOnly": True,
        "sculptComplete": False,
        "jointFitComplete": False,
    }
