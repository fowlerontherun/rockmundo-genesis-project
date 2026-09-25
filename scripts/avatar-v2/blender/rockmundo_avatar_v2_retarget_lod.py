"""Transfer real sculpt morphs and rig weights to an ARTIST-authored lower-poly LOD.

This cannot manufacture an Avatar V2 mesh. The artist must model and unwrap a
lower-poly version of the SAME rest-pose surface, aligned to the original
fitted LOD0 source. This helper projects target vertices to source triangles
and copies their existing skin influences and genuine morph displacements.

Preview the correspondences without changing the blend:
  blender work/avatar-v2-retopo-lod1.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_retarget_lod.py -- \
    --source RMV2_Body --target RMV2_Body_LOD1 --kind body --lod 1 \
    --report work/retopo-lod1-preview.json

Apply only after inspecting the target topology and preview report:
  blender work/avatar-v2-retopo-lod1.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_retarget_lod.py -- \
    --source RMV2_Body --target RMV2_Body_LOD1 --kind body --lod 1 \
    --mode apply --reviewed --transfer-materials \
    --output work/avatar-v2-lod1-weighted.blend

Transfer separately for body, continuous head and any deliberately retopologised
separate surfaces. Final LOD1 nose/ear vertex landmarks still require the
artist to re-select actual geometry on the retopologised head.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from math import isfinite

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lod_surface_transfer import (  # noqa: E402
    SurfaceMatch, audit_matches, barycentric, interpolate_vec, interpolate_weights,
    max_delta, require_muscle_keys, select_morphs, MUSCLE_KEYS,
)

BUDGETS = {1: 38_000, 2: 18_000, 3: 8_000}
MIN_MORPH_DELTA_METRES = .0005


def args_from_cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="LOD0 authored source mesh (not a stock/unweighted seed).")
    parser.add_argument("--target", required=True, help="Artist-retopologised and UV-unwrapped target mesh.")
    parser.add_argument("--armature", default="RMV2_Armature")
    parser.add_argument("--kind", choices=("body", "head", "surface"), required=True)
    parser.add_argument("--lod", type=int, choices=(1, 2, 3), required=True)
    parser.add_argument("--mode", choices=("preview", "apply"), default="preview")
    parser.add_argument("--reviewed", action="store_true", help="Confirm the lower-poly geometry was visually reviewed.")
    parser.add_argument("--transfer-materials", action="store_true", help="Map region/material slots from the source (review seams afterwards).")
    parser.add_argument("--max-distance-mm", type=float, default=25., help="Maximum surface deviation, 1–100mm.")
    parser.add_argument("--report", help="Optional output JSON with projection and lost-morph QA.")
    parser.add_argument("--output", help="New .blend file, required for --mode apply.")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def get_mesh(name: str) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "MESH":
        raise SystemExit(f"LOD mesh {name!r} was not found in the opened .blend.")
    if obj.matrix_world.determinant() <= 1e-8:
        raise SystemExit(f"{name} has mirrored, negative or singular object transforms; apply them first.")
    return obj


def source_shape_data(source: bpy.types.Object, lod: int, kind: str):
    blocks = source.data.shape_keys.key_blocks if source.data.shape_keys else None
    if not blocks and kind != "surface":
        raise SystemExit(f"Source {source.name} has no sculpted shape keys to transfer.")
    if blocks and "Basis" not in blocks:
        raise SystemExit(f"Source {source.name} shape-key Basis must be named 'Basis'.")
    names = list(blocks.keys()) if blocks else []
    if kind == "body":
        require_muscle_keys(names)
    selected = select_morphs(names, lod)
    for name in selected:
        key = blocks[name]
        if key.relative_key != blocks["Basis"]:
            raise SystemExit(f"Source morph {name} is relative to {key.relative_key.name}, not Basis; flatten it deliberately before LOD transfer.")
    if blocks and any(abs(key.value) > 1e-6 for key in blocks if key.name != "Basis"):
        raise SystemExit("Set all source shape-key preview values to zero before projecting the rest-pose sculpt.")
    basis = [tuple(float(v) for v in datum.co) for datum in blocks["Basis"].data] if blocks else [
        tuple(float(v) for v in vertex.co) for vertex in source.data.vertices
    ]
    return basis, blocks, selected


def source_vertex_weights(source: bpy.types.Object) -> list[dict[str, float]]:
    names = {group.index: group.name for group in source.vertex_groups}
    return [
        {names[item.group]: float(item.weight) for item in vertex.groups if item.group in names}
        for vertex in source.data.vertices
    ]


def create_correspondences(source: bpy.types.Object, target: bpy.types.Object, basis):
    source.data.calc_loop_triangles()
    triangles = [tuple(int(i) for i in tri.vertices) for tri in source.data.loop_triangles]
    if not triangles:
        raise SystemExit("Source has no real triangles; a flat marker plane is not a retopology base.")
    tree = BVHTree.FromPolygons([Vector(point) for point in basis], triangles, all_triangles=True)
    target_to_source = source.matrix_world.inverted_safe() @ target.matrix_world
    source_to_world = source.matrix_world.to_3x3()
    matches: list[SurfaceMatch] = []
    for vertex in target.data.vertices:
        local = target_to_source @ vertex.co
        nearest, _normal, triangle_index, _distance = tree.find_nearest(local)
        if nearest is None or triangle_index is None:
            raise SystemExit(f"Vertex {vertex.index} of {target.name} has no matching source surface.")
        triangle = triangles[triangle_index]
        bary = barycentric(
            tuple(float(x) for x in nearest),
            basis[triangle[0]], basis[triangle[1]], basis[triangle[2]],
        )
        metres = (source_to_world @ (local - nearest)).length
        matches.append(SurfaceMatch(triangle, bary, metres))
    return matches, tree, source.data.loop_triangles


def transfer_plan(args, source, target, rig):
    if source == target:
        raise SystemExit("The artist's LOD target must be a different mesh from the original sculpt.")
    if len(source.data.vertices) < 3 or not source.data.polygons:
        raise SystemExit("Source must be an actual continuous authored mesh with polygon surface.")
    if len(target.data.vertices) < 3 or not target.data.polygons:
        raise SystemExit("Target needs real artist-retopologised polygon faces, not detached marker points.")
    if len(target.data.vertices) >= len(source.data.vertices):
        raise SystemExit("Target is not lower-poly than its source; retopologise the target first.")
    if len(target.data.vertices) > BUDGETS[args.lod]:
        raise SystemExit(f"Target alone exceeds the whole-character LOD{args.lod} vertex budget.")
    if not target.data.uv_layers.active:
        raise SystemExit("Target needs an artist-authored UV unwrap before transferring any textured surfaces.")
    if target.data.shape_keys and any(key.name != "Basis" for key in target.data.shape_keys.key_blocks):
        raise SystemExit("Target already has custom shape keys. Use a clean rest-pose retopo to avoid destroying artist morphs.")
    if any(vertex.groups for vertex in target.data.vertices):
        raise SystemExit("Target already has painted vertex weights. Use a clean retopo to avoid overwriting artist work.")
    source_modifier = next((m for m in source.modifiers if m.type == "ARMATURE" and m.object == rig), None)
    if source_modifier is None:
        raise SystemExit("Source must be bound to the fitted RockMundo deform rig before LOD retopology transfer.")
    for modifier in target.modifiers:
        if modifier.type == "ARMATURE" and modifier.object != rig:
            raise SystemExit(f"Target armature modifier {modifier.name} points to a different rig.")

    basis, blocks, selected = source_shape_data(source, args.lod, args.kind)
    matches, tree, source_triangles = create_correspondences(source, target, basis)
    report = audit_matches(matches, args.max_distance_mm / 1000.)
    groups = source_vertex_weights(source)
    deform_bones = {bone.name for bone in rig.data.bones if bone.use_deform}
    all_rig_bones = {bone.name for bone in rig.data.bones}
    # All correspondence and weighting checks happen before Blender writes a
    # single target vertex group or shape key.
    transferred_weights = []
    for match in matches:
        skin = interpolate_weights(groups, match, deform_bones)
        # A non-deforming armature anchor must never be painted as a mask.
        transferred_weights.append({
            name: value for name, value in skin.items()
            if name in deform_bones or name not in all_rig_bones
        })

    source_to_target = target.matrix_world.inverted_safe().to_3x3() @ source.matrix_world.to_3x3()
    key_transfer = {}
    lost_keys = []
    for name in selected:
        shape = blocks[name]
        source_deltas = [
            tuple(float(shape.data[i].co[axis]) - basis[i][axis] for axis in range(3))
            for i in range(len(basis))
        ]
        if not all(isfinite(component) for delta in source_deltas for component in delta):
            raise SystemExit(f"Source morph {name} has non-finite coordinates; repair the authored sculpt.")
        source_peak = max_delta(source_deltas)
        if source_peak < MIN_MORPH_DELTA_METRES:
            lost_keys.append({"name": name, "reason": "source has no measurable sculpt delta"})
            if name in MUSCLE_KEYS:
                raise SystemExit(f"Required muscle morph {name} has no real source deformation.")
            continue
        # Calculate target deltas once for validation. No named zero-delta
        # placeholder is silently written when retopology collapses a shape.
        target_deltas = [
            tuple(float(x) for x in source_to_target @ Vector(interpolate_vec(source_deltas, match)))
            for match in matches
        ]
        target_peak = max_delta(target_deltas)
        if target_peak < MIN_MORPH_DELTA_METRES:
            lost_keys.append({"name": name, "reason": "retopology lost the original shape delta"})
            if args.lod == 1 or name in MUSCLE_KEYS:
                raise SystemExit(
                    f"LOD{args.lod} retopo lost required authored morph {name}; "
                    "refine target topology rather than exporting an empty shape key."
                )
            continue
        key_transfer[name] = target_deltas

    material_mapping = []
    if args.transfer_materials:
        if not source.data.materials or any(material is None for material in source.data.materials):
            raise SystemExit("Source has missing material slots. Repair the authored materials before transferring regions.")
        target_to_source = source.matrix_world.inverted_safe() @ target.matrix_world
        for polygon in target.data.polygons:
            nearest, _normal, triangle_index, _distance = tree.find_nearest(
                target_to_source @ polygon.center
            )
            if nearest is None or triangle_index is None:
                raise SystemExit(f"Cannot project {target.name} polygon {polygon.index} onto its source material region.")
            material_mapping.append(source.data.polygons[
                source_triangles[triangle_index].polygon_index
            ].material_index)

    details = {
        "schema": "rockmundo.avatar-v2-retopo-preview",
        "version": 1,
        "mode": args.mode,
        "source": source.name,
        "target": target.name,
        "kind": args.kind,
        "lod": args.lod,
        **report,
        "sourceVertices": len(source.data.vertices),
        "targetVertices": len(target.data.vertices),
        "deformInfluencesPerVertex": 4,
        "transferredMorphs": list(key_transfer),
        "omittedMorphs": lost_keys,
        "materialsTransferred": bool(args.transfer_materials),
        "facialSculptLandmarksTransferred": False,
        "requires": [
            "Inspect target UV layout, material regions and seams before export.",
            "LOD1 artists must select real RMV2 nose and ear landmark vertex groups on the new head.",
            "Retopologised eyes, teeth, eyelashes, wetlines and clothes need their own authored meshes.",
            "Complete rig and GLB validators still determine whether this LOD is usable.",
        ],
    }
    return details, (transferred_weights, key_transfer, material_mapping)


def apply_transfer(args, source, target, rig, plan):
    weights, key_deltas, material_mapping = plan
    bpy.context.view_layer.objects.active = target
    if not target.data.shape_keys:
        target.shape_key_add(name="Basis", from_mix=False)
    for name, deltas in key_deltas.items():
        new_key = target.shape_key_add(name=name, from_mix=False)
        for index, delta in enumerate(deltas):
            new_key.data[index].co = target.data.vertices[index].co + Vector(delta)

    by_group: dict[str, list[tuple[int, float]]] = {}
    for index, per_vertex in enumerate(weights):
        for name, value in per_vertex.items():
            # Non-deform sculpt/painting masks can be transferred for material
            # authoring but must not be mistaken for real new LOD1 anatomy.
            if name.startswith("RMV2_") and not args.transfer_materials:
                continue
            by_group.setdefault(name, []).append((index, value))
    for name, members in by_group.items():
        group = target.vertex_groups.get(name) or target.vertex_groups.new(name=name)
        for index, value in members:
            group.add([index], value, "REPLACE")

    if not any(mod.type == "ARMATURE" and mod.object == rig for mod in target.modifiers):
        modifier = target.modifiers.new("RMV2_Deform", "ARMATURE")
        modifier.object = rig
        modifier.use_vertex_groups = True
    if args.transfer_materials:
        target.data.materials.clear()
        for material in source.data.materials:
            target.data.materials.append(material)
        for polygon, source_material in zip(target.data.polygons, material_mapping):
            polygon.material_index = source_material

    for property_name in ("rockmundoHeadSurface", "rockmundoSurfaceRole", "rockmundoBodyRegion"):
        if property_name in source:
            target[property_name] = source[property_name]
    # Export sees only the new LOD surface, never the overlapping original.
    # The authored source remains available in the working file for inspection.
    source.hide_render = True
    target.hide_render = False
    target["rockmundoRetopoLOD"] = args.lod
    target["rockmundoRetopoSource"] = source.name
    target["rockmundoRetopoReviewed"] = True


def write_report(args, report):
    if not args.report:
        return
    path = pathlib.Path(args.report).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = args_from_cli()
    if args.mode == "apply" and (not args.reviewed or not args.output):
        raise SystemExit("--mode apply requires BOTH --reviewed and a NEW --output .blend.")
    if args.output and bpy.data.filepath and (
        pathlib.Path(args.output).resolve() == pathlib.Path(bpy.data.filepath).resolve()
    ):
        raise SystemExit("Write a new .blend: the original authored sculpt must remain untouched.")
    source = get_mesh(args.source)
    target = get_mesh(args.target)
    rig = bpy.data.objects.get(args.armature)
    if not rig or rig.type != "ARMATURE":
        raise SystemExit(f"Fitted RockMundo armature {args.armature} is missing.")
    if not (isfinite(args.max_distance_mm) and 1 <= args.max_distance_mm <= 100):
        raise SystemExit("--max-distance-mm must be between 1 and 100.")
    details, plan = transfer_plan(args, source, target, rig)
    print(json.dumps(details, indent=2))
    if args.mode == "apply":
        apply_transfer(args, source, target, rig, plan)
        output = pathlib.Path(args.output).expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))
        details["output"] = str(output)
        details["mode"] = "applied"
    write_report(args, details)


if __name__ == "__main__":
    main()
