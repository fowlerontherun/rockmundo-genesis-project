"""Prepare a RockMundo Avatar V2 authoring scene from Blender Human Base Meshes.

This helper deliberately does NOT pretend a stock base mesh is a production Avatar V2.
It creates a clean, provenance-stamped working .blend from selected CC0 source objects
so the RockMundo rig, face, morphs, body regions, materials and LODs can be authored on
top of substantially better topology.

Discover source datablocks:
  blender --background --python scripts/avatar-v2/blender/rockmundo_avatar_v2_seed.py -- \
    --source /path/to/human-base-meshes.blend --list

Create a masculine authoring seed using the official stylized body preset:
  blender --background --python scripts/avatar-v2/blender/rockmundo_avatar_v2_seed.py -- \
    --source /path/to/human-base-meshes.blend \
    --frame masculine \
    --preset stylized \
    --output work/avatar-v2-masculine-source.blend

The stylized preset selects "Body Male - Stylized" or "Body Female - Stylized"
depending on --frame. Use --preset realistic or explicit --object/--collection
arguments when evaluating other source assets.

Multiple --object arguments are supported when the chosen base is split into body,
head, eyes or other sculpt-source objects. Nothing produced by this script should be
placed in public/avatar-v2 as a runtime GLB until the normal export gate passes.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
from typing import Iterable

import bpy
from mathutils import Matrix, Vector

SOURCE_ID = "blender-human-base-meshes-v1.4.1"
SOURCE_NAME = "Blender Human Base Meshes"
SOURCE_LICENSE = "CC0-1.0"
SOURCE_URL = (
    "https://download.blender.org/demo/asset-bundles/human-base-meshes/"
    "human-base-meshes-bundle-v1.4.1.zip"
)
TARGET_HEIGHT = {
    "masculine": 1.80,
    "feminine": 1.72,
}

PRESET_COLLECTIONS = {
    "masculine": {
        "stylized": "Body Male - Stylized",
        "realistic": "Body Male - Realistic",
    },
    "feminine": {
        "stylized": "Body Female - Stylized",
        "realistic": "Body Female - Realistic",
    },
}

REQUIRED_CLOSEUP_MORPHS = [
    "bodySlim", "bodyBroad",
    "muscleToned", "muscleAthletic", "muscleMuscular", "muscleBodybuilder",
    "faceOval", "faceAngular", "faceSoft", "faceWide",
    "blinkLeft", "blinkRight", "jawOpen", "mouthSmile",
    "visemeAA", "visemeEE", "visemeIH", "visemeOH", "visemeOU",
    "mouthFunnel", "mouthPucker",
    "eyeSquintLeft", "eyeSquintRight",
    "browInnerUp", "browDownLeft", "browDownRight",
    "cheekSquintLeft", "cheekSquintRight",
    "mouthStretchLeft", "mouthStretchRight",
    "poseShoulderLeft", "poseShoulderRight",
    "poseElbowLeft", "poseElbowRight",
    "poseHipLeft", "poseHipRight",
    "poseKneeLeft", "poseKneeRight",
]

REQUIRED_BODY_REGIONS = [
    "torso", "upper-arms", "lower-arms", "hands",
    "hips", "upper-legs", "lower-legs", "feet",
]


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the extracted Blender Human Base Meshes .blend file.")
    parser.add_argument("--frame", choices=["masculine", "feminine"])
    parser.add_argument("--object", action="append", dest="objects", default=[], help="Source object to append. Repeat for split source meshes.")
    parser.add_argument("--collection", action="append", dest="collections", default=[], help="Source collection to append. Repeat if needed.")
    parser.add_argument("--preset", choices=["stylized", "realistic", "none"], default="stylized", help="Auto-select the official body collection when no --object/--collection is supplied.")
    parser.add_argument("--output", help="Working .blend file to create.")
    parser.add_argument("--target-height", type=float, help="Override authoring height in metres.")
    parser.add_argument("--list", action="store_true", help="Print available source objects and collections, then exit.")
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def source_path(value: str) -> pathlib.Path:
    path = pathlib.Path(value).expanduser().resolve()
    if not path.exists() or path.suffix.lower() != ".blend":
        raise SystemExit(f"Source .blend not found: {path}")
    return path


def list_source(path: pathlib.Path) -> None:
    with bpy.data.libraries.load(str(path), link=False) as (data_from, _data_to):
        print(f"RockMundo Avatar V2 source discovery: {path}")
        print("\nOBJECTS")
        for name in sorted(data_from.objects):
            print(f"  {name}")
        print("\nCOLLECTIONS")
        for name in sorted(data_from.collections):
            print(f"  {name}")


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def available_collection_names(path: pathlib.Path) -> list[str]:
    with bpy.data.libraries.load(str(path), link=False) as (data_from, _data_to):
        return list(data_from.collections)


def resolve_preset_collection(path: pathlib.Path, frame: str, preset: str) -> str:
    wanted = PRESET_COLLECTIONS[frame][preset]
    available = available_collection_names(path)
    exact = next((name for name in available if name == wanted), None)
    if exact:
        return exact
    normalized = {name.replace("_", " ").replace("-", " ").lower(): name for name in available}
    key = wanted.replace("_", " ").replace("-", " ").lower()
    if key in normalized:
        return normalized[key]
    raise SystemExit(
        f'Official preset collection "{wanted}" was not found in {path.name}. '
        "Run with --list to inspect this bundle file or pass --collection explicitly."
    )


def append_objects(path: pathlib.Path, names: list[str]) -> list[bpy.types.Object]:
    if not names:
        return []
    with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
        missing = [name for name in names if name not in data_from.objects]
        if missing:
            raise SystemExit(f"Source object(s) not found: {', '.join(missing)}")
        data_to.objects = names

    loaded = [obj for obj in data_to.objects if obj is not None]
    for obj in loaded:
        if obj.name not in bpy.context.scene.collection.objects:
            bpy.context.scene.collection.objects.link(obj)
    return loaded


def append_collections(path: pathlib.Path, names: list[str]) -> list[bpy.types.Collection]:
    if not names:
        return []
    with bpy.data.libraries.load(str(path), link=False) as (data_from, data_to):
        missing = [name for name in names if name not in data_from.collections]
        if missing:
            raise SystemExit(f"Source collection(s) not found: {', '.join(missing)}")
        data_to.collections = names

    loaded = [collection for collection in data_to.collections if collection is not None]
    for collection in loaded:
        if collection.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(collection)
    return loaded


def unique_objects(objects: Iterable[bpy.types.Object]) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    seen: set[int] = set()

    def add(obj: bpy.types.Object) -> None:
        key = obj.as_pointer()
        if key in seen:
            return
        seen.add(key)
        result.append(obj)
        for child in obj.children:
            add(child)

    for obj in objects:
        add(obj)
    return result


def selected_source_objects(
    direct: list[bpy.types.Object],
    collections: list[bpy.types.Collection],
) -> list[bpy.types.Object]:
    roots = list(direct)
    for collection in collections:
        roots.extend(collection.all_objects)
    return unique_objects(roots)


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH" or not obj.bound_box:
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise SystemExit("Selected source contains no measurable mesh objects.")
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def top_level_selected(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    selected = {obj.as_pointer() for obj in objects}
    return [obj for obj in objects if obj.parent is None or obj.parent.as_pointer() not in selected]


def normalize_scene(objects: list[bpy.types.Object], frame: str, target_height: float) -> None:
    minimum, maximum = world_bounds(objects)
    height = maximum.z - minimum.z
    if height <= 0.001:
        raise SystemExit("Source body has no usable Z height.")

    scale = target_height / height
    center_x = (minimum.x + maximum.x) / 2
    center_y = (minimum.y + maximum.y) / 2

    # Blender authoring remains Z-up. glTF export converts to the runtime +Y-up
    # convention. Apply the same world transform to selected roots only.
    transform = (
        Matrix.Scale(scale, 4)
        @ Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    )
    for obj in top_level_selected(objects):
        obj.matrix_world = transform @ obj.matrix_world

    bpy.context.view_layer.update()


def stamp_provenance(objects: list[bpy.types.Object], frame: str, source_file: pathlib.Path) -> None:
    for obj in objects:
        obj["rockmundoAvatarV2Source"] = SOURCE_ID
        obj["rockmundoAvatarV2SourceLicense"] = SOURCE_LICENSE
        obj["rockmundoAvatarV2SourceFrame"] = frame
        obj["rockmundoAvatarV2SourceFile"] = source_file.name


def authoring_notes(frame: str, source_file: pathlib.Path) -> str:
    morphs = "\n".join(f"- {name}" for name in REQUIRED_CLOSEUP_MORPHS)
    regions = "\n".join(f"- {name}" for name in REQUIRED_BODY_REGIONS)
    return f"""# RockMundo Avatar V2 authoring seed

Frame: {frame}
Source: {SOURCE_NAME} / {SOURCE_ID}
Source file: {source_file.name}
License: {SOURCE_LICENSE}
Source URL: {SOURCE_URL}

This file is an AUTHORING SEED, not a runtime avatar.

Next production steps:
1. Refine the silhouette and face into the RockMundo stylised art direction.
2. Retopologise/clean as needed while preserving strong face, shoulder, elbow,
   knee, hand and foot deformation loops.
3. Generate the RockMundo skeleton guide with
   scripts/avatar-v2/blender/rockmundo_avatar_v2_rig_guide.py, then manually fit
   every joint, finger pivot and Eye.L/Eye.R gaze pivot to this mesh's topology.
4. Weight the body manually, including meaningful UpperArmTwist/ForearmTwist/
   ThighTwist influence for LOD0/LOD1, then split/mark all eight garment-occlusion
   body regions.
5. Author separate eyes/cornea, bind each eyeball to its matching eye bone, and
   author teeth, tongue and mouth-interior surfaces.
6. Author the required close-up morphs listed below. Do not add zero-delta
   placeholders simply to satisfy naming checks.
7. Build LOD0 first, validate it, then derive LOD1/2/3 without destroying UVs.
8. Export only through rockmundo_avatar_v2_export.py and run
   npm run validate:avatar-v2 before changing manifest state.

Required/recommended close-up morph set:
{morphs}

Required body regions:
{regions}
"""


def create_notes(frame: str, source_file: pathlib.Path) -> None:
    text = bpy.data.texts.get("ROCKMUNDO_AVATAR_V2_AUTHORING") or bpy.data.texts.new("ROCKMUNDO_AVATAR_V2_AUTHORING")
    text.clear()
    text.write(authoring_notes(frame, source_file))


def save_working_file(output: pathlib.Path, frame: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene["rockmundoAvatarV2AuthoringSeed"] = True
    scene["rockmundoAvatarV2Frame"] = frame
    scene["rockmundoAvatarV2Source"] = SOURCE_ID
    scene["rockmundoAvatarV2SourceLicense"] = SOURCE_LICENSE
    bpy.ops.wm.save_as_mainfile(filepath=str(output))


def main() -> None:
    args = cli_args()
    source = source_path(args.source)

    if args.list:
        list_source(source)
        return

    if not args.frame:
        raise SystemExit("--frame is required unless --list is used.")
    if not args.output:
        raise SystemExit("--output is required when creating an authoring seed.")

    if not args.objects and not args.collections:
        if args.preset == "none":
            raise SystemExit("Choose at least one --object or --collection from --list output.")
        args.collections = [resolve_preset_collection(source, args.frame, args.preset)]
        print(f'Auto-selected official {args.preset} source collection: {args.collections[0]}')

    clear_scene()
    direct = append_objects(source, args.objects)
    collections = append_collections(source, args.collections)
    objects = selected_source_objects(direct, collections)
    if not objects:
        raise SystemExit("No source objects were appended.")

    target_height = args.target_height or TARGET_HEIGHT[args.frame]
    if target_height < 1.3 or target_height > 2.2:
        raise SystemExit("--target-height must be between 1.3m and 2.2m.")

    normalize_scene(objects, args.frame, target_height)
    stamp_provenance(objects, args.frame, source)
    create_notes(args.frame, source)
    save_working_file(pathlib.Path(args.output).expanduser().resolve(), args.frame)

    meshes = [obj for obj in objects if obj.type == "MESH"]
    print(
        f"Created RockMundo Avatar V2 {args.frame} authoring seed with "
        f"{len(meshes)} mesh object(s): {pathlib.Path(args.output).resolve()}"
    )
    print("This is not runtime-ready. Continue authoring, then use rockmundo_avatar_v2_export.py.")


if __name__ == "__main__":
    main()
