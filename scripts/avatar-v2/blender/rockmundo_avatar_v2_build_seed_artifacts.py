"""Build real, downloadable Avatar V2 *authoring* scenes from the pinned CC0 base.

Runs inside Blender 4.2+ after fetch_human_base_meshes.py has verified and
extracted the official bundle. This is not a runtime mesh generator: all assets
remain outside public/avatar-v2 and retain the guide's manual-fit requirement.

  blender --background --factory-startup --python \
    scripts/avatar-v2/blender/rockmundo_avatar_v2_build_seed_artifacts.py -- \
    --source-root work/avatar-v2-source \
    --output-root work/avatar-v2-authoring-artifacts
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

import bpy
from mathutils import Vector

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(SCRIPT_DIR.parent))

import rockmundo_avatar_v2_seed as seed  # noqa: E402
import rockmundo_avatar_v2_rig_guide as guide  # noqa: E402
import rockmundo_avatar_v2_fit_rig as fitter  # noqa: E402
import rockmundo_avatar_v2_source_lookdev as lookdev  # noqa: E402
from fetch_human_base_meshes import ARCHIVE_NAME, EXPECTED_BYTES, archive_valid  # noqa: E402

SOURCE_COLLECTIONS = {
    "masculine": "Body Male - Stylized",
    "feminine": "Body Female - Stylized",
}
VIEW_ANGLES = {
    "front": (0.0, -3.1, 1.25),
    "quarter": (2.3, -2.7, 1.27),
    "side": (3.15, 0.0, 1.24),
    "face": (0.0, -1.25, 1.60),
}


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True, type=pathlib.Path)
    parser.add_argument("--output-root", required=True, type=pathlib.Path)
    parser.add_argument("--frame", choices=("all", "masculine", "feminine"), default="all")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def find_source_collections(
    extracted: pathlib.Path, wanted: dict[str, str],
) -> dict[str, pathlib.Path]:
    """Fail rather than guess when the upstream bundle changes its layout."""
    blends = sorted(
        path for path in extracted.rglob("*.blend")
        if path.is_file() and path.suffix.lower() == ".blend"
    )
    if not blends:
        raise RuntimeError(f"No Blender authoring source found below {extracted}.")
    located: dict[str, list[pathlib.Path]] = {frame: [] for frame in wanted}
    inventory: dict[str, list[str]] = {}
    for path in blends:
        with bpy.data.libraries.load(str(path), link=False) as (source, _destination):
            names = list(source.collections)
            inventory[str(path.relative_to(extracted))] = names
            for frame, name in wanted.items():
                if name in names:
                    located[frame].append(path)
    ambiguous = {
        frame: [str(path) for path in paths]
        for frame, paths in located.items() if len(paths) != 1
    }
    if ambiguous:
        raise RuntimeError(
            f"Cannot locate exactly one official stylized collection per frame: "
            f"{json.dumps(ambiguous)}. Extracted Blender collection inventory: "
            f"{json.dumps(inventory)}"
        )
    return {frame: paths[0] for frame, paths in located.items()}


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_manifest(root: pathlib.Path) -> list[dict]:
    entries = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix == ".blend1":
            continue
        entries.append({
            "file": str(path.relative_to(root)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    return entries


def render_contact_views(frame: str, meshes: list[bpy.types.Object], output: pathlib.Path, *, styled: bool = False) -> list[str]:
    """Real neutral Workbench renders, not AI-synthesised or retouched art."""
    scene = bpy.context.scene
    saved_engine, saved_camera = scene.render.engine, scene.camera
    saved_resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    saved_format, saved_path = scene.render.image_settings.file_format, scene.render.filepath

    camera_data = bpy.data.cameras.new(f"RMV2_{frame}_proof_camera")
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"

    # Workbench uses a studio light: textures, missing external assets or
    # authored shader lighting cannot disguise geometry in these source proofs.
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "BOTH"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    out = []
    try:
        for view, xyz in VIEW_ANGLES.items():
            centre = Vector((0, 0, 1.55 if view == "face" else .88))
            camera.location = Vector(xyz)
            direction = centre - camera.location
            camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
            camera_data.ortho_scale = .56 if view == "face" else 2.14
            path = output / f"{frame}-{'lookdev-' if styled else ''}{view}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            if not path.exists() or path.stat().st_size < 1024:
                raise RuntimeError(f"Blender failed to render the {frame} {view} source proof.")
            out.append(path.name)
    finally:
        scene.render.engine = saved_engine
        scene.camera = saved_camera
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = saved_resolution
        scene.render.image_settings.file_format, scene.render.filepath = saved_format, saved_path
        bpy.data.objects.remove(camera, do_unlink=True)
        if camera_data.users == 0:
            bpy.data.cameras.remove(camera_data)
    return out


def export_candidate_preview(frame: str, meshes: list[bpy.types.Object], output: pathlib.Path, *, styled: bool = False) -> str:
    """Unrigged CC0 sculpt reference usable in the admin A-pose candidate viewer.

    This is NOT base-lod0.glb: avoid the production file name and directory.
    """
    path = output / f"{frame}-{'LOOKDEV-ONLY' if styled else 'SOURCE-ONLY'}-not-validated.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
        mesh["rockmundoAvatarV2PreviewOnly"] = True
    try:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLB",
            use_selection=True,
            export_skins=False,
            export_animations=False,
            export_materials="EXPORT" if styled else "NONE",
            export_extras=True,
            export_yup=True,
            export_cameras=False,
            export_lights=False,
        )
    finally:
        for mesh in meshes:
            del mesh["rockmundoAvatarV2PreviewOnly"]
    if not path.exists() or path.stat().st_size < 1024:
        raise RuntimeError(f"Source preview GLB missing or empty: {path}")
    return path.name


def build_frame(frame: str, source_file: pathlib.Path, root: pathlib.Path) -> dict:
    frame_dir = root / frame
    frame_dir.mkdir(parents=True, exist_ok=True)
    seed.clear_scene()
    collections = seed.append_collections(source_file, [SOURCE_COLLECTIONS[frame]])
    objects = seed.selected_source_objects([], collections)
    meshes = [obj for obj in objects if obj.type == "MESH" and not obj.hide_render]
    if not meshes:
        raise RuntimeError(f"{frame} official source collection has no visible body geometry.")
    seed.normalize_scene(objects, frame, seed.TARGET_HEIGHT[frame])
    seed.stamp_provenance(objects, frame, source_file)
    seed.create_notes(frame, source_file)
    scene = bpy.context.scene
    scene["rockmundoAvatarV2AuthoringSeed"] = True
    scene["rockmundoAvatarV2SourceFrame"] = frame
    scene["rockmundoAvatarV2Source"] = seed.SOURCE_ID
    scene["rockmundoAvatarV2SourceLicense"] = seed.SOURCE_LICENSE

    seed_path = frame_dir / f"{frame}-source.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(seed_path))
    proofs = render_contact_views(frame, meshes, frame_dir)
    preview = export_candidate_preview(frame, meshes, frame_dir)

    # Preserve the untouched CC0 source and neutral geometry proofs above.
    # Artist-editable preview materials and genuinely separate curved cornea
    # meshes are added only after that immutable baseline has been saved.
    lookdev_report = lookdev.apply_source_lookdev(frame, meshes)
    detail_meshes = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and not obj.hide_render
    ]
    lookdev_path = frame_dir / f"{frame}-artist-lookdev.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(lookdev_path))
    lookdev_views = render_contact_views(frame, detail_meshes, frame_dir, styled=True)
    lookdev_preview = export_candidate_preview(
        frame, detail_meshes, frame_dir, styled=True,
    )

    min_point, max_point = guide.world_bounds(meshes)
    rig = guide.create_rig(frame, min_point, max_point)
    guide.create_notes(frame)
    rig_path = frame_dir / f"{frame}-unfitted-rig-guide.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(rig_path))
    handles = fitter.create_handles(rig, fitter.read_rig(rig))
    handles_path = frame_dir / f"{frame}-joint-handles.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(handles_path))

    # The source is a real mesh, but no stock seed has passed the RockMundo
    # fitted-weight, genuine morph, sculpt-detail or full performance gates.
    return {
        "frame": frame,
        "sourceBlend": seed_path.name,
        "guideBlend": rig_path.name,
        "fitHandlesBlend": handles_path.name,
        "candidatePreview": preview,
        "contactViews": proofs,
        "lookdevBlend": lookdev_path.name,
        "lookdevPreview": lookdev_preview,
        "lookdevViews": lookdev_views,
        "lookdevGeometry": lookdev_report,
        "sourceBlendFile": source_file.name,
        "sourceCollection": SOURCE_COLLECTIONS[frame],
        "sourceMeshCount": len(meshes),
        "sourceVertices": sum(len(obj.data.vertices) for obj in meshes),
        "guideBones": len(rig.data.bones),
        "fitMarkers": handles["markers"],
        "productionValidated": False,
        "requiresManualJointFit": bool(rig.get("rockmundoAvatarV2RequiresManualFit", True)),
    }


def main() -> None:
    args = cli_args()
    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    archive = source_root / ARCHIVE_NAME
    if not archive_valid(archive) or archive.stat().st_size != EXPECTED_BYTES:
        raise SystemExit("The pinned Blender v1.4.1 CC0 source archive has not passed extraction verification.")
    if bpy.app.version < (4, 2, 0):
        raise SystemExit(f"Avatar V2 source bundle requires Blender >=4.2; found {bpy.app.version_string}.")
    selected = SOURCE_COLLECTIONS if args.frame == "all" else {
        args.frame: SOURCE_COLLECTIONS[args.frame]
    }
    sources = find_source_collections(source_root / "extracted", selected)
    output_root.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "rockmundo.avatar-v2-real-source-artifacts",
        "version": 1,
        "blender": bpy.app.version_string,
        "source": seed.SOURCE_ID,
        "sourceLicense": seed.SOURCE_LICENSE,
        "sourceArchiveSha256": sha256(archive),
        "assetStatus": "authoring-reference-only",
        "releaseEligible": False,
        "frames": [],
    }
    for frame, source_file in sources.items():
        report["frames"].append(build_frame(frame, source_file, output_root))
    report["files"] = file_manifest(output_root)
    path = output_root / "authoring-artifacts-manifest.json"
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8")
    for entry in report["frames"]:
        if not entry["sourceVertices"] or not entry["guideBones"] or not entry["fitMarkers"]:
            raise RuntimeError(f"{entry['frame']} did not produce actual source geometry, rig and fit handles.")
    print("[avatar-v2/artifacts] Built real CC0 source scenes and proof views:")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
