"""Assign seam-free Avatar V2 body-region materials from fitted skin weights.

The body stays one continuous skinned mesh. This helper duplicates the existing
skin material into eight region-tagged materials and assigns polygons according to
their dominant RockMundo deform-bone weights. Head/face/neck polygons that do not
map to a garment occlusion region keep their original material.

Run this only after the RMV2 armature has been manually fitted and skin weights
have passed rockmundo_avatar_v2_weight_audit.py.

Example:
  blender work/avatar-v2-masculine-rigged-source.blend --background \
    --python scripts/avatar-v2/blender/rockmundo_avatar_v2_body_regions.py -- \
    --armature RMV2_Armature \
    --output work/avatar-v2-masculine-regions.blend

Use --object repeatedly to target explicit body meshes. Without --object the
largest visible mesh bound to the target armature is selected.
"""

from __future__ import annotations

import argparse
import collections
import pathlib
import re
import sys

import bpy

REGIONS = (
    "torso",
    "upper-arms",
    "lower-arms",
    "hands",
    "hips",
    "upper-legs",
    "lower-legs",
    "feet",
)

BONE_REGION = {
    "Spine1": "torso",
    "Spine2": "torso",
    "Shoulder.L": "upper-arms",
    "Shoulder.R": "upper-arms",
    "UpperArm.L": "upper-arms",
    "UpperArm.R": "upper-arms",
    "LowerArm.L": "lower-arms",
    "LowerArm.R": "lower-arms",
    "Hand.L": "hands",
    "Hand.R": "hands",
    "Hips": "hips",
    "UpperLeg.L": "upper-legs",
    "UpperLeg.R": "upper-legs",
    "LowerLeg.L": "lower-legs",
    "LowerLeg.R": "lower-legs",
    "Foot.L": "feet",
    "Foot.R": "feet",
    "Toe.L": "feet",
    "Toe.R": "feet",
}

for side in ("L", "R"):
    for digit in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
        for joint in (1, 2, 3):
            BONE_REGION[f"{digit}{joint}.{side}"] = "hands"

SKIN_PATTERN = re.compile(r"rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])", re.I)
WEIGHT_EPSILON = 0.0001
DEFAULT_MIN_REGION_SHARE = 0.55


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--armature", default="RMV2_Armature")
    parser.add_argument("--object", action="append", dest="objects", default=[])
    parser.add_argument("--skin-material", help="Explicit existing skin material to duplicate.")
    parser.add_argument(
        "--min-region-share",
        type=float,
        default=DEFAULT_MIN_REGION_SHARE,
        help="Minimum share of a polygon's deform weight that must map to one body region before reassignment.",
    )
    parser.add_argument("--output", help="Optional .blend output path.")
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)


def bound_to_rig(obj: bpy.types.Object, rig: bpy.types.Object) -> bool:
    return any(
        modifier.type == "ARMATURE" and modifier.object == rig
        for modifier in obj.modifiers
    )


def target_meshes(args: argparse.Namespace, rig: bpy.types.Object) -> list[bpy.types.Object]:
    if args.objects:
        result: list[bpy.types.Object] = []
        for name in args.objects:
            obj = bpy.data.objects.get(name)
            if obj is None or obj.type != "MESH":
                raise SystemExit(f'Body mesh "{name}" was not found.')
            if not bound_to_rig(obj, rig):
                raise SystemExit(f'Body mesh "{name}" is not bound to {rig.name}.')
            result.append(obj)
        return result

    candidates = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        and not obj.hide_viewport
        and not obj.hide_render
        and bound_to_rig(obj, rig)
        and not bool(obj.get("rockmundoAvatarV2Garment"))
    ]
    if not candidates:
        raise SystemExit(f"No visible mesh bound to {rig.name} was found.")
    selected = max(candidates, key=lambda obj: len(obj.data.vertices))
    print(
        f'[avatar-v2-body-regions] Auto-selected largest rigged mesh "{selected.name}" '
        f"({len(selected.data.vertices):,} vertices)."
    )
    return [selected]


def is_region_material(material: bpy.types.Material) -> bool:
    if str(material.get("rockmundoBodyRegion", "")).lower() in REGIONS:
        return True
    cleaned = re.sub(r"[^a-z0-9]", "", material.name.lower())
    return any(
        cleaned.startswith("rmv2skin") and cleaned.endswith(re.sub(r"[^a-z0-9]", "", region))
        for region in REGIONS
    )


def choose_skin_material(
    meshes: list[bpy.types.Object],
    explicit_name: str | None,
) -> bpy.types.Material:
    if explicit_name:
        material = bpy.data.materials.get(explicit_name)
        if material is None:
            raise SystemExit(f'Skin material "{explicit_name}" was not found.')
        if is_region_material(material):
            raise SystemExit("--skin-material must be the shared/base skin shader, not an existing region material.")
        return material

    counts: collections.Counter[str] = collections.Counter()
    for obj in meshes:
        polygon_counts = collections.Counter(poly.material_index for poly in obj.data.polygons)
        for index, count in polygon_counts.items():
            if index >= len(obj.material_slots):
                continue
            material = obj.material_slots[index].material
            if material and SKIN_PATTERN.search(material.name) and not is_region_material(material):
                counts[material.name] += count

    if counts:
        material = bpy.data.materials.get(counts.most_common(1)[0][0])
        if material:
            return material

    for obj in meshes:
        for slot in obj.material_slots:
            if slot.material and not is_region_material(slot.material):
                print(
                    f'[avatar-v2-body-regions] WARN: no explicitly named base skin material found; '
                    f'using "{slot.material.name}" as the source shader.'
                )
                return slot.material
    raise SystemExit("No non-region source material is available to duplicate for body regions.")


def ensure_region_materials(base: bpy.types.Material) -> dict[str, bpy.types.Material]:
    result: dict[str, bpy.types.Material] = {}
    for region in REGIONS:
        suffix = "".join(part.capitalize() for part in region.split("-"))
        name = f"RMV2_Skin_{suffix}"
        material = bpy.data.materials.get(name)
        if material is None:
            material = base.copy()
            material.name = name
        material["rockmundoBodyRegion"] = region
        material["rockmundoSkinMaterial"] = True
        result[region] = material
    return result


def material_slot(obj: bpy.types.Object, material: bpy.types.Material) -> int:
    for index, slot in enumerate(obj.material_slots):
        if slot.material == material:
            return index
    obj.data.materials.append(material)
    return len(obj.material_slots) - 1


def vertex_region_scores(obj: bpy.types.Object, vertex_index: int) -> tuple[dict[str, float], float]:
    vertex = obj.data.vertices[vertex_index]
    scores: dict[str, float] = collections.defaultdict(float)
    total_weight = 0.0
    for membership in vertex.groups:
        if membership.weight <= WEIGHT_EPSILON or membership.group >= len(obj.vertex_groups):
            continue
        group_name = obj.vertex_groups[membership.group].name
        total_weight += membership.weight
        region = BONE_REGION.get(group_name)
        if region:
            scores[region] += membership.weight
    return scores, total_weight


def assign_regions(
    obj: bpy.types.Object,
    region_materials: dict[str, bpy.types.Material],
    base_material: bpy.types.Material,
    min_region_share: float,
) -> collections.Counter[str]:
    slots = {
        region: material_slot(obj, material)
        for region, material in region_materials.items()
    }
    base_slot = material_slot(obj, base_material)
    region_slots = set(slots.values())
    assigned: collections.Counter[str] = collections.Counter()
    untouched = 0

    # A rerun should not lock in an older automatic classification. Reset only
    # previously generated region materials; preserve authored non-region slots.
    for polygon in obj.data.polygons:
        if polygon.material_index in region_slots:
            polygon.material_index = base_slot

    for polygon in obj.data.polygons:
        scores: dict[str, float] = collections.defaultdict(float)
        total_weight = 0.0
        for vertex_index in polygon.vertices:
            vertex_scores, vertex_total = vertex_region_scores(obj, vertex_index)
            total_weight += vertex_total
            for region, score in vertex_scores.items():
                scores[region] += score

        if not scores or total_weight <= WEIGHT_EPSILON:
            untouched += 1
            continue

        region, score = max(scores.items(), key=lambda item: item[1])
        region_share = score / total_weight
        if score <= WEIGHT_EPSILON or region_share < min_region_share:
            untouched += 1
            continue
        polygon.material_index = slots[region]
        assigned[region] += 1

    print(
        f'[avatar-v2-body-regions] {obj.name}: assigned '
        + ", ".join(f"{region}={assigned[region]:,}" for region in REGIONS)
        + f"; untouched head/other={untouched:,}."
    )
    return assigned


def save(output: str | None) -> None:
    if output:
        path = pathlib.Path(output).expanduser().resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
    elif bpy.data.filepath:
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    else:
        raise SystemExit("--output is required when the current Blender file has never been saved.")


def main() -> None:
    args = cli_args()
    rig = bpy.data.objects.get(args.armature)
    if rig is None or rig.type != "ARMATURE":
        raise SystemExit(f'Armature "{args.armature}" was not found.')

    meshes = target_meshes(args, rig)
    base = choose_skin_material(meshes, args.skin_material)
    materials = ensure_region_materials(base)

    totals: collections.Counter[str] = collections.Counter()
    if not 0.0 < args.min_region_share <= 1.0:
        raise SystemExit("--min-region-share must be greater than 0 and at most 1.")

    for obj in meshes:
        totals.update(assign_regions(obj, materials, base, args.min_region_share))
        obj["rockmundoAvatarV2ContinuousBodyRegions"] = True
        obj["rockmundoAvatarV2RegionMinShare"] = args.min_region_share

    missing = [region for region in REGIONS if totals[region] == 0]
    if missing:
        raise SystemExit(
            "No polygons were assigned to required region(s): " + ", ".join(missing)
            + ". Review bone weights or target meshes before export."
        )

    save(args.output)
    print(
        "[avatar-v2-body-regions] PASS: continuous body geometry retained; "
        "region occlusion is encoded through used skin-material groups."
    )


if __name__ == "__main__":
    main()
