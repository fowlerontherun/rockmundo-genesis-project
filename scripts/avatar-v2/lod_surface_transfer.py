"""Topology-independent surface transfer for artist-retopologised Avatar V2 LODs.

A candidate LOD must already be sculpted and UV-unwrapped by an artist. Projecting
onto the authored base surface transfers genuine shape-key *deltas* and skin
weights; it never invents anatomy, adds zero-effect keys or decimates close-up
geometry. Kept free of Blender dependencies for deterministic CI tests.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import dist, isfinite, sqrt
from typing import Mapping, Sequence

Vec3 = tuple[float, float, float]
Triangle = tuple[int, int, int]
MUSCLE_KEYS = frozenset((
    "muscleToned", "muscleAthletic", "muscleMuscular", "muscleBodybuilder",
))
DISTANT_KEYS = MUSCLE_KEYS | frozenset((
    "bodySlim", "bodyBroad", "faceOval", "faceAngular", "faceSoft", "faceWide",
    "blinkLeft", "blinkRight", "jawOpen", "mouthSmile",
))
FACE_LANDMARK_PREFIXES = (
    "RMV2_Nose", "RMV2_Nostril", "RMV2_EarHelix",
    "RMV2_EarAntihelix", "RMV2_EarLobe",
)


@dataclass(frozen=True)
class SurfaceMatch:
    triangle: Triangle
    barycentric: tuple[float, float, float]
    distance_metres: float


def barycentric(point: Vec3, a: Vec3, b: Vec3, c: Vec3) -> tuple[float, float, float]:
    """Barycentric coordinates of a nearest surface point, including edges."""
    ab = tuple(b[i] - a[i] for i in range(3))
    ac = tuple(c[i] - a[i] for i in range(3))
    ap = tuple(point[i] - a[i] for i in range(3))
    d00 = sum(x * x for x in ab)
    d01 = sum(ab[i] * ac[i] for i in range(3))
    d11 = sum(x * x for x in ac)
    d20 = sum(ap[i] * ab[i] for i in range(3))
    d21 = sum(ap[i] * ac[i] for i in range(3))
    denominator = d00 * d11 - d01 * d01
    if denominator <= 1e-18:
        raise ValueError("Degenerate source triangle cannot transfer LOD data.")
    v = (d11 * d20 - d01 * d21) / denominator
    w = (d00 * d21 - d01 * d20) / denominator
    result = (1.0 - v - w, v, w)
    if not all(isfinite(weight) for weight in result):
        raise ValueError("Source surface contains non-finite triangle coordinates.")
    # Nearest-point BVH queries should already be inside a triangle. Tiny
    # floating-point excursions at an edge are safe to clamp and renormalise.
    if min(result) < -.0001 or max(result) > 1.0001:
        raise ValueError("Projected LOD vertex lies outside its source triangle.")
    positive = tuple(max(0.0, min(1.0, x)) for x in result)
    total = sum(positive)
    if total < 1e-10:
        raise ValueError("Cannot interpolate an empty triangle.")
    return tuple(x / total for x in positive)


def select_morphs(source_keys: Sequence[str], lod: int) -> list[str]:
    """LOD1 retains authored face/pose targets; distant LODs keep useful core."""
    if lod not in (1, 2, 3):
        raise ValueError("LOD retopology transfer accepts only LOD1, LOD2 or LOD3.")
    return [
        key for key in source_keys
        if key != "Basis" and (lod == 1 or key in DISTANT_KEYS)
    ]


def require_muscle_keys(source_keys: Sequence[str]) -> None:
    missing = sorted(MUSCLE_KEYS.difference(source_keys))
    if missing:
        raise ValueError("Authored source body lacks required muscle targets: " + ", ".join(missing))


def interpolate_vec(values: Sequence[Vec3], match: SurfaceMatch) -> Vec3:
    if any(index < 0 or index >= len(values) for index in match.triangle):
        raise ValueError("LOD match contains an invalid source-vertex index.")
    return tuple(
        sum(values[index][axis] * weight for index, weight in zip(match.triangle, match.barycentric))
        for axis in range(3)
    )


def shape_delta(source_basis: Sequence[Vec3], source_shape: Sequence[Vec3], match: SurfaceMatch) -> Vec3:
    if len(source_basis) != len(source_shape):
        raise ValueError("Shape key does not match source-base topology.")
    return interpolate_vec([
        tuple(source_shape[i][axis] - base[axis] for axis in range(3))
        for i, base in enumerate(source_basis)
    ], match)


def interpolate_weights(
    groups_per_vertex: Sequence[Mapping[str, float]],
    match: SurfaceMatch,
    deform_bones: set[str],
    *,
    max_deform_influences: int = 4,
) -> dict[str, float]:
    """Keep four strongest deform bones; copy UV/mask groups separately.

    Blender vertex-group names used only as sculpt landmarks must NOT be
    transferred: LOD1 needs its own manually selected nose and ear groups.
    """
    accumulated: dict[str, float] = {}
    for index, bary_weight in zip(match.triangle, match.barycentric):
        if index < 0 or index >= len(groups_per_vertex):
            raise ValueError("Skin match references a vertex outside the source mesh.")
        for name, value in groups_per_vertex[index].items():
            if name.startswith(FACE_LANDMARK_PREFIXES):
                continue
            if not (isfinite(value) and value >= 0):
                raise ValueError("Source contains an invalid skin or mask weight.")
            accumulated[name] = accumulated.get(name, 0.0) + bary_weight * value

    deform = sorted(
        ((name, value) for name, value in accumulated.items()
         if name in deform_bones and value > .0001),
        key=lambda pair: (-pair[1], pair[0]),
    )[:max_deform_influences]
    total = sum(value for _, value in deform)
    if total < .0001:
        raise ValueError("Projected LOD vertex has no meaningful deform bone.")
    result = {name: value / total for name, value in deform}
    for name, value in accumulated.items():
        if name not in deform_bones and value > .0001:
            result[name] = max(0.0, min(1.0, value))
    return result


def audit_matches(matches: Sequence[SurfaceMatch], max_distance_metres: float) -> dict[str, float | int]:
    if not matches:
        raise ValueError("Retopologised target contains no projected vertices.")
    if not (.001 <= max_distance_metres <= .1):
        raise ValueError("Source-distance limit must be between 1mm and 100mm.")
    for match in matches:
        if not (isfinite(match.distance_metres) and match.distance_metres >= 0):
            raise ValueError("LOD projection produced a non-finite or negative distance.")
    maximum = max(match.distance_metres for match in matches)
    if maximum > max_distance_metres:
        count = sum(match.distance_metres > max_distance_metres for match in matches)
        raise ValueError(
            f"{count} LOD vertices exceed source proximity "
            f"({maximum * 1000:.1f}mm max; {max_distance_metres * 1000:.1f}mm allowed)."
        )
    rms = sqrt(sum(match.distance_metres ** 2 for match in matches) / len(matches))
    return {
        "vertices": len(matches),
        "maxDistanceMm": round(maximum * 1000, 3),
        "rmsDistanceMm": round(rms * 1000, 3),
    }


def max_delta(deltas: Sequence[Vec3]) -> float:
    return max((sqrt(sum(component * component for component in d)) for d in deltas), default=0.0)
