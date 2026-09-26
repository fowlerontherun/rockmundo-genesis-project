"""Measure non-authoritative V2 joint suggestions from genuine CC0 source geometry.

The original Blender source contains a continuous face and separate, real
eyeballs. These measurements reduce *guesswork* when artists place the Eye and
EarAnchor bones, but are not a substitute for human joint fitting, weight
painting or any of the production GLB validation gates.

Coordinate system: world-space Blender metres, Z up, -Y forward, +X left.
No dependence on bpy: the geometry rules must be tested without Blender.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import dist, isfinite
from statistics import median
from typing import Mapping, Sequence

Vec3 = tuple[float, float, float]


@dataclass(frozen=True)
class EyeMeasurement:
    centre: Vec3
    radius: float
    vertex_count: int


@dataclass(frozen=True)
class EarMeasurement:
    position: Vec3
    vertex_count: int
    source_band_count: int


def _points(points: Sequence[Vec3], minimum: int, name: str) -> list[Vec3]:
    if len(points) < minimum:
        raise ValueError(f"{name} has too few real source mesh vertices.")
    if any(len(p) != 3 or not all(isfinite(v) for v in p) for p in points):
        raise ValueError(f"{name} has invalid/non-finite world-space vertex coordinates.")
    return list(points)


def measure_eye(points: Sequence[Vec3]) -> EyeMeasurement:
    """Take the true AABB centre and mean radius of an existing eyeball mesh."""
    vertices = _points(points, 50, "Eyeball")
    bounds = [(min(v[axis] for v in vertices), max(v[axis] for v in vertices))
              for axis in range(3)]
    centre = tuple((low + high) * .5 for low, high in bounds)
    radius = sum(high - low for low, high in bounds) / 6.
    if not .022 <= radius <= .05:
        raise ValueError(f"Eyeball radius {radius:.4f}m is not plausible for this pinned source.")
    if any((high - low) < radius * 1.50 for low, high in bounds):
        raise ValueError("The source eyeball is flattened or not a complete sphere.")
    return EyeMeasurement(centre, radius, len(vertices))


def measure_eyes(eye_vertices: Mapping[str, Sequence[Vec3]]) -> dict[str, EyeMeasurement]:
    if set(eye_vertices) != {"L", "R"}:
        raise ValueError("Require separate, actual L and R eyeball meshes.")
    eyes = {side: measure_eye(eye_vertices[side]) for side in ("L", "R")}
    left, right = eyes["L"], eyes["R"]
    span = left.centre[0] - right.centre[0]
    if not .045 <= span <= .17:
        raise ValueError("Actual eye centres have implausible spacing or reversed left/right labels.")
    if (abs(left.centre[2] - right.centre[2]) > .018
            or abs(left.centre[1] - right.centre[1]) > .022
            or abs(left.radius - right.radius) > .012):
        raise ValueError("Left/right real eye anatomy is inconsistent; inspect source transforms.")
    midline = (left.centre[0] + right.centre[0]) * .5
    if not left.centre[0] > midline > right.centre[0]:
        raise ValueError("Left/right eyes are not on the expected sides of the sculpt.")
    return eyes


def measure_ear(
    vertices: Sequence[Vec3],
    eye: EyeMeasurement,
    side: str,
) -> EarMeasurement:
    """Choose a reviewable LOWER lateral ear-surface suggestion, not a fake pivot.

    A tight eye-relative head band excludes the neck and shoulders. Restrict to
    the side's real outer head vertices, then use the lower part of that
    *observed* lateral patch, rather than a bounding-box-derived floating spot.
    The artist must still identify the exact earlobe/piercing position.
    """
    if side not in ("L", "R"):
        raise ValueError("Ear side must be L or R.")
    body = _points(vertices, 1000, "Continuous head/body sculpt")
    direction = 1 if side == "L" else -1
    x, y, z = eye.centre
    radius = eye.radius
    candidates = [
        point for point in body
        if z - 3.10 * radius <= point[2] <= z - .92 * radius
        and y - 1.50 * radius <= point[1] <= y + 3.10 * radius
        and direction * (point[0] - x) >= .57 * radius
    ]
    if len(candidates) < 12:
        raise ValueError(f"{side} actual ear patch is not resolvable; fit the lobe manually.")
    # Retain the lateral top 30%, then select its lower 40% where the actual
    # earlobe is expected. Median is stable across small topology differences.
    lateral = sorted(candidates, key=lambda v: direction * v[0], reverse=True)
    lateral = lateral[:max(10, round(len(lateral) * .30))]
    lower = sorted(lateral, key=lambda v: v[2])[:max(6, round(len(lateral) * .40))]
    proposed = tuple(float(median(point[axis] for point in lower)) for axis in range(3))
    outward = direction * (proposed[0] - x)
    drop = z - proposed[2]
    if not .57 * radius <= outward <= 4.5 * radius:
        raise ValueError(f"{side} detected patch is not on a plausible outer ear surface.")
    if not .92 * radius <= drop <= 3.10 * radius:
        raise ValueError(f"{side} detected ear patch is not below the actual eye.")
    return EarMeasurement(proposed, len(lower), len(candidates))


def source_joint_suggestions(
    head_vertices: Sequence[Vec3],
    eyes: Mapping[str, Sequence[Vec3]],
) -> tuple[dict[str, Vec3], dict[str, int], dict[str, EyeMeasurement]]:
    measured = measure_eyes(eyes)
    ears = {
        side: measure_ear(head_vertices, measured[side], side)
        for side in ("L", "R")
    }
    if (abs(ears["L"].position[2] - ears["R"].position[2]) > .048
            or abs(ears["L"].position[1] - ears["R"].position[1]) > .06):
        raise ValueError("Bilateral ear patch suggestions disagree; artist inspection is required.")
    positions = {
        **{f"Eye.{side}": eye.centre for side, eye in measured.items()},
        **{f"EarAnchor.{side}": ear.position for side, ear in ears.items()},
    }
    samples = {
        **{f"Eye.{side}": eye.vertex_count for side, eye in measured.items()},
        **{f"EarAnchor.{side}": ear.vertex_count for side, ear in ears.items()},
    }
    if len(set(positions)) != 4 or any(not all(isfinite(v) for v in p) for p in positions.values()):
        raise ValueError("Could not measure four real bilateral eye/ear suggestions.")
    return positions, samples, measured
