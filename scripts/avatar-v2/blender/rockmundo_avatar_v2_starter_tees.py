"""Build ACTUAL CC0-body-conforming Starter Wardrobe T-shirt ARTIST PROOFS.

Four *existing catalogue keys*, masculine and feminine original sculpt surfaces.
No new shop products, no reselling prior purchases, no production-ready garment
claim. The body is the source's physical topology, not a resized cylinder.

This stage is intentionally before manual garment sculpting, approved joint
weights, UV finishing, cloth folds, real body LODs and gig performance QA.
Original source and head-rig scenes were saved independently beforehand.
"""
from __future__ import annotations

import json
import math
import pathlib
import struct
import sys
from mathutils import Vector

import bpy
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from tee_surface import (  # noqa: E402
    STARTER_TEES, largest_connected_surface, validate_surface_projection,
)

ROOT = pathlib.Path(__file__).resolve().parents[3]
ORIGINAL_LOGO = ROOT / "src/assets/rockmundo-logo.png"
PANEL_OFFSET = .014
PRINT_OFFSET = .00065
VARIANT_SURFACE = {
    "logo-tee": ((.041, .049, .063, 1.), (.92, .90, .84, 1.), .82),
    "plain-black-tee": ((.029, .035, .044, 1.), (.18, .20, .24, 1.), .93),
    "plain-white-tee": ((.91, .90, .84, 1.), (.78, .77, .70, 1.), .88),
    "vintage-charcoal-tee": ((.18, .19, .21, 1.), (.23, .24, .27, 1.), .96),
}


def _fabric_material(name: str, rgba, roughness: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0.
    mat["rockmundoAvatarV2PreviewMaterial"] = True
    mat["rockmundoAvatarV2AuthoringClothNotBaked"] = True
    return mat


def _print_material() -> bpy.types.Material:
    if not ORIGINAL_LOGO.is_file() or ORIGINAL_LOGO.stat().st_size < 1024:
        raise RuntimeError("The existing RockMundo brand PNG is absent; refuse to invent a replacement logo.")
    image = bpy.data.images.load(str(ORIGINAL_LOGO), check_existing=True)
    if min(image.size) < 100:
        raise RuntimeError("Real brand logo is too small for a genuine shirt print prototype.")
    image.pack()  # The editable artist .blend no longer depends on checkout paths.
    mat = _fabric_material("RMV2_OriginalRockmundoLogo_SurfacePrint", (1., 1., 1., 1.), .77)
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.name = "Original_RockMundo_Brand_PNG"
    texture.image = image
    texture.interpolation = "Linear"
    mat.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    mat.node_tree.links.new(texture.outputs["Alpha"], bsdf.inputs["Alpha"])
    mat.surface_render_method = "DITHERED"
    mat["rockmundoAvatarV2UsesExistingBrandArtwork"] = True
    return mat


def _source_surface(body: bpy.types.Object, frame: str):
    if body.type != "MESH" or body.get("rockmundoAvatarV2Source") != "blender-human-base-meshes-v1.4.1":
        raise RuntimeError("Starter prototypes must fit the actual pinned, provenance-stamped CC0 sculpt.")
    positions = [tuple(body.matrix_world @ v.co) for v in body.data.vertices]
    polygons = [tuple(face.vertices) for face in body.data.polygons]
    selected = largest_connected_surface(positions, polygons, frame)
    original_vertices = sorted({i for face_index in selected for i in polygons[face_index]})
    if len(original_vertices) < 350:
        raise RuntimeError("Too few original sculpt vertices for an actual high-resolution shirt shell.")
    normal_matrix = body.matrix_world.to_3x3().inverted_safe().transposed()
    normals = {
        index: (normal_matrix @ body.data.vertices[index].normal).normalized()
        for index in original_vertices
    }
    remap = {source: local for local, source in enumerate(original_vertices)}
    source_points = [Vector(positions[i]) for i in original_vertices]
    raised_points = [point + normals[i] * PANEL_OFFSET
                     for point, i in zip(source_points, original_vertices)]
    proof = validate_surface_projection(
        [tuple(v) for v in source_points], [tuple(v) for v in raised_points],
        expected_offset=PANEL_OFFSET,
    )
    faces = [tuple(remap[index] for index in polygons[face_index]) for face_index in selected]
    proof.update({
        "sourceBody": body.name,
        "sourceTotalVertices": len(body.data.vertices),
        "sourceTotalFaces": len(body.data.polygons),
        "sourceSelectedFaces": len(selected),
        "largestConnectedOriginalComponent": True,
        "sculptDerivedShortSleeves": True,
        "sculptDerivedNeckCut": True,
    })
    return raised_points, faces, normals, original_vertices, proof


def _cloth_object(frame: str, slug: str, points, faces, collection, colour, roughness):
    mesh = bpy.data.meshes.new(f"RMV2_OriginalSourceMappedTee_{frame}_{slug}")
    mesh.from_pydata(points, [], faces)
    mesh.validate(verbose=False, clean_customdata=False)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(f"RMV2_StarterTee_{frame}_{slug}", mesh)
    collection.objects.link(obj)
    obj["rockmundoAvatarV2PreviewOnly"] = True
    obj["rockmundoAvatarV2ProductionValidated"] = False
    obj["rockmundoAvatarV2RealSourceMapped"] = True
    mesh.materials.append(_fabric_material(f"RMV2_StarterTeeFabric_{slug}", colour, roughness))
    for face in mesh.polygons:
        face.use_smooth = True
    # Actual editable thin-shell thickness, not a cardboard-sized shape.
    # The authoring GLB exporter can apply it for visual proof; the source
    # meshes remain separately editable as real Blender geometry.
    solidify = obj.modifiers.new("RMV2_DRAFT_hem_and_fabric_thickness", "SOLIDIFY")
    solidify.thickness = .0022
    solidify.offset = -.7
    solidify.use_rim = True
    obj["rockmundoAvatarV2RequiresManualClothSculpt"] = True
    return obj


def _original_logo_surface_print(frame: str, shirt: bpy.types.Object, points, faces,
                                 source_positions, source_indices, collection):
    """True original brand image on actual lifted chest faces, not a floating plane.

    Duplicate chest-facing triangles by source-mesh index and offset them only
    0.65mm along fitted source normals; logo uses planar UV on this *curved*
    subset, and is an artist-editable print material on the real shirt surface.
    """
    chest = []
    for polygon in faces:
        verts = [source_positions[i] for i in polygon]
        mid = sum(verts, Vector()) / len(verts)
        if (abs(mid.x) <= .166 and 1.195 <= mid.z <= 1.326
                and mid.y < -.062):
            chest.append(polygon)
    if len(chest) < 12:
        raise RuntimeError("No physical front-chest triangles for the original RockMundo wordmark.")
    indices = sorted({index for polygon in chest for index in polygon})
    remap = {index: i for i, index in enumerate(indices)}
    # Print mesh follows the already fitted raised shirt positions precisely.
    # The additional submillimetre stand-off avoids z-fighting in WebGL
    # without a detached logo card or visible floating object.
    projected = [
        points[i] + Vector((0., -PRINT_OFFSET, 0.)) for i in indices
    ]
    mesh = bpy.data.meshes.new(f"RMV2_RealChestPrintGeometry_{frame}")
    mesh.from_pydata(projected, [], [
        tuple(remap[index] for index in polygon) for polygon in chest
    ])
    mesh.validate(verbose=False, clean_customdata=False)
    mesh.update()
    uv = mesh.uv_layers.new(name="RMV2_OriginalBrandArt_ChestUV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            point = source_positions[indices[mesh.loops[loop_index].vertex_index]]
            uv.data[loop_index].uv = (
                max(0., min(1., .5 + point.x / .345)),
                max(0., min(1., (point.z - 1.185) / .155)),
            )
    obj = bpy.data.objects.new(f"RMV2_OriginalBrand_ConformingInk_{frame}", mesh)
    collection.objects.link(obj)
    mesh.materials.append(_print_material())
    obj["rockmundoAvatarV2PreviewOnly"] = True
    obj["rockmundoAvatarV2ProductionValidated"] = False
    obj["rockmundoAvatarV2PrintingMethod"] = "existing PNG on source-derived curved real shirt triangles"
    obj["rockmundoAvatarV2NotAFloatingPlane"] = True
    return obj, {
        "realCurvedPrintFaces": len(chest),
        "actualOriginalBrandImage": str(ORIGINAL_LOGO.relative_to(ROOT)),
        "printOffsetMm": PRINT_OFFSET * 1000,
        "usesExistingBrandArtwork": True,
        "previewOnly": True,
    }


def _add_fitted_hem(frame: str, slug: str, shirt: bpy.types.Object,
                    collection, trim_colour):
    """Author a real hem/seam geometry directly from shirt boundary edges."""
    mesh = shirt.data
    counts = {}
    for polygon in mesh.polygons:
        vertices = polygon.vertices
        for a, b in zip(vertices, (*vertices[1:], vertices[0])):
            edge = tuple(sorted((int(a), int(b))))
            counts[edge] = counts.get(edge, 0) + 1
    borders = [edge for edge, count in counts.items() if count == 1]
    if len(borders) < 20:
        raise RuntimeError("Prototype tee has no genuine neck, hem or sleeve edge loops.")
    seams = bpy.data.curves.new(f"RMV2_StarterSurfaceSeams_{frame}_{slug}", "CURVE")
    seams.dimensions = "3D"
    seams.resolution_u = 2
    seams.bevel_depth = .00145
    seams.bevel_resolution = 2
    seams.resolution_u = 4
    for a, b in borders:
        spline = seams.splines.new("POLY")
        spline.points.add(1)
        spline.points[0].co = (*mesh.vertices[a].co, 1.)
        spline.points[1].co = (*mesh.vertices[b].co, 1.)
    obj = bpy.data.objects.new(f"RMV2_StarterHems_{frame}_{slug}", seams)
    collection.objects.link(obj)
    seams.materials.append(_fabric_material(
        f"RMV2_StarterHems_{slug}", trim_colour, .88,
    ))
    obj["rockmundoAvatarV2PreviewOnly"] = True
    obj["rockmundoAvatarV2ProductionValidated"] = False
    obj["rockmundoAvatarV2SourceBoundaryFollowing"] = True
    return obj, len(borders)


def _inspect_preview_glb(path: pathlib.Path, slug: str, want_logo: bool) -> dict:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise RuntimeError("Missing real starter shirt proof GLB.")
        magic, version, length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or length != path.stat().st_size:
            raise RuntimeError("Starter prototype was not exported to a valid GLB container.")
        size, kind = struct.unpack("<II", stream.read(8))
        if kind != 0x4E4F534A:
            raise RuntimeError("Real starter tee proof has no glTF JSON payload.")
        scene = json.loads(stream.read(size))
    meshes = [mesh.get("name", "") for mesh in scene.get("meshes", [])]
    if not any(("OriginalSourceMappedTee" in name or "StarterTee" in name) and slug in name
               for name in meshes):
        raise RuntimeError("The real lifted CC0 source tee is absent from the exported proof.")
    logo = any("RealChestPrintGeometry" in name or "OriginalBrand_ConformingInk" in name
               for name in meshes)
    if logo != want_logo:
        raise RuntimeError("Existing brand art attachment missing or incorrectly added to an unbranded tee.")
    if scene.get("animations") or scene.get("skins"):
        raise RuntimeError("This unweighted surface-fit prototype must never imply certified skinning or performance.")
    if not any("StarterSurfaceSeams" in name or "StarterHems" in name for name in meshes):
        raise RuntimeError("The extracted source tee has no real hem geometry.")
    return {
        "gltfMeshCount": len(meshes),
        "gltfSourceMappedShirt": True,
        "gltfConformingOriginalLogo": logo,
        "gltfRealSurfaceHems": True,
        "gltfHasSkinning": False,
        "gltfHasAnimations": False,
    }


def _render_shirt(frame: str, slug: str, output: pathlib.Path,
                  target: bpy.types.Object, *, camera_view: str) -> str:
    """Render PBR fabric and original PNG chest print rather than fake pixels."""
    scene = bpy.context.scene
    saved = (scene.render.engine, scene.camera, scene.render.filepath,
             scene.render.resolution_x, scene.render.resolution_y,
             scene.render.resolution_percentage)
    camera_data = bpy.data.cameras.new("RMV2_StarterClothQA_Camera")
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    look_at = Vector((0., 0., 1.12))
    if camera_view == "quarter":
        camera.location = (2.0, -2.8, 1.45)
    else:
        camera.location = (0., -3.25, 1.28)
    camera.rotation_euler = (look_at - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.ortho_scale = 1.98

    lights = []
    try:
        # EEVEEs actual alpha-composited curved logo / roughness cannot be
        # displayed faithfully by Workbench's flat material shading.
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.render.resolution_x = 704
        scene.render.resolution_y = 704
        scene.render.resolution_percentage = 100
        scene.eevee.taa_render_samples = 16
        for name, xyz, energy, shape in [
            ("key", (-1.6, -2.2, 3.3), 340., 3.),
            ("fill", (1.8, -.4, 2.2), 210., 2.),
        ]:
            lamp_data = bpy.data.lights.new(f"RMV2_Starter_{name}", "AREA")
            lamp_data.energy = energy
            lamp_data.shape = "DISK"
            lamp_data.size = shape
            lamp = bpy.data.objects.new(lamp_data.name, lamp_data)
            scene.collection.objects.link(lamp)
            lamp.location = xyz
            lamp.rotation_euler = (look_at - lamp.location).to_track_quat("-Z", "Y").to_euler()
            lights.append(lamp)
        path = output / f"{frame}-starter-{slug}-{camera_view}.png"
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        if not path.is_file() or path.stat().st_size < 1024:
            raise RuntimeError("The actual Blender PBR starter tee proof was not rendered.")
        return path.name
    finally:
        (scene.render.engine, scene.camera, scene.render.filepath,
         scene.render.resolution_x, scene.render.resolution_y,
         scene.render.resolution_percentage) = saved
        for lamp in lights:
            lamp_data = lamp.data
            bpy.data.objects.remove(lamp, do_unlink=True)
            if not lamp_data.users:
                bpy.data.lights.remove(lamp_data)
        bpy.data.objects.remove(camera, do_unlink=True)
        if not camera_data.users:
            bpy.data.cameras.remove(camera_data)


def build_starter_tee_proofs(
    frame: str,
    body: bpy.types.Object,
    original_lookdev_meshes: list[bpy.types.Object],
    output: pathlib.Path,
) -> dict:
    if frame not in ("masculine", "feminine"):
        raise ValueError("Only two genuine source frames are supported.")
    if body not in original_lookdev_meshes or len(original_lookdev_meshes) < 11:
        raise RuntimeError("Missing full real eye, lip, brow/lash and original body source.")
    # This is a NEW separate artist proof, after the existing saved head-motion
    # experiment. Remove preliminary head weights from this copy ONLY; do not
    # re-save or alter the independent genuine head experiment .blend/GLB.
    for mesh in original_lookdev_meshes:
        for modifier in list(mesh.modifiers):
            if modifier.type == "ARMATURE":
                mesh.modifiers.remove(modifier)

    points, faces, _normals, original_indices, source_report = _source_surface(body, frame)
    source_positions = [Vector(body.matrix_world @ body.data.vertices[i].co)
                        for i in original_indices]
    collection = bpy.data.collections.new(f"RMV2_StarterTees_DRAFT_{frame}")
    bpy.context.scene.collection.children.link(collection)
    reports = []
    created = []
    for slug, key, name in STARTER_TEES:
        primary, trim, roughness = VARIANT_SURFACE[slug]
        shirt = _cloth_object(frame, slug, points, faces, collection, primary, roughness)
        seams, edge_count = _add_fitted_hem(frame, slug, shirt, collection, trim)
        attachments = [shirt, seams]
        brand_report = None
        if slug == "logo-tee":
            print_mesh, brand_report = _original_logo_surface_print(
                frame, shirt, points, faces, source_positions, original_indices,
                collection,
            )
            attachments.append(print_mesh)
        # Artist pack preserves all 4 named variants but only renders/selects
        # one at a time: no overlapping 4-shirt previews or floating items.
        for other in created:
            other.hide_render = True
        for item in attachments:
            item.hide_render = False
        created.extend(attachments)
        views = {
            angle: _render_shirt(frame, slug, output, shirt, camera_view=angle)
            for angle in ("front", "quarter")
        }
        glb = output / f"{frame}-starter-{slug}-LOOKDEV-ONLY-not-validated.glb"
        bpy.ops.object.select_all(action="DESELECT")
        for item in [*original_lookdev_meshes, *attachments]:
            item.select_set(True)
        bpy.context.view_layer.objects.active = shirt
        try:
            bpy.ops.export_scene.gltf(
                filepath=str(glb), export_format="GLB", use_selection=True,
                export_skins=False, export_animations=False, export_extras=True,
                export_materials="EXPORT", export_yup=True,
                export_cameras=False, export_lights=False,
            )
        finally:
            bpy.ops.object.select_all(action="DESELECT")
        if not glb.is_file() or glb.stat().st_size < 1024:
            raise RuntimeError("A genuine starter prototype source body and shirt GLB is absent.")
        binary_report = _inspect_preview_glb(glb, slug, slug == "logo-tee")
        reports.append({
            "catalogueKey": key, "name": name, "style": slug,
            "preview": glb.name, "views": views,
            "actualOriginalCC0SourceSurface": True,
            "sourceSurface": source_report,
            "authoringBoundaryEdges": edge_count,
            "brand": brand_report,
            "requiresManualFullBodyRigAndGarmentWeighting": True,
            "realGarmentArtistApproved": False,
            "productionValidated": False,
            **binary_report,
        })
    for item in created:
        item.hide_render = item.name not in {
            f"RMV2_StarterTee_{frame}_logo-tee",
            f"RMV2_StarterHems_{frame}_logo-tee",
            f"RMV2_OriginalBrand_ConformingInk_{frame}",
        }
    scene_path = output / f"{frame}-starter-four-tee-prototypes-UNAPPROVED.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(scene_path))
    return {
        "schema": "rockmundo.avatar-v2-starter-tee-authoring-proofs",
        "version": 1, "frame": frame,
        "scene": scene_path.name,
        "realCC0Body": body.name,
        "variants": reports,
        "oldCatalogueKeysUnchanged": True,
        "noDatabaseItemsCreated": True,
        "fullRigValidated": False,
        "artistApproved": False,
        "productionValidated": False,
    }
