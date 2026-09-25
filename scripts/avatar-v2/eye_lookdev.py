"""Math-only real-geometry eye look-development for Avatar V2 reference scenes.

Eye sphere material masks and the cornea dome use the actual Blender source
eye's rest-pose centre, radius and eye-forward vector; no painted fake anatomy
or production-rig/certification claim is made here.
"""
from __future__ import annotations

import math

Vec3 = tuple[float, float, float]


def dot(a: Vec3, b: Vec3) -> float:
    return sum(x * y for x, y in zip(a, b))


def cross(a: Vec3, b: Vec3) -> Vec3:
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def unit(value: Vec3) -> Vec3:
    length = math.sqrt(dot(value, value))
    if not math.isfinite(length) or length < 1e-8:
        raise ValueError("Eye direction must be a finite nonzero 3D vector.")
    return tuple(component / length for component in value)


def choose_eye_material(
    point: Vec3, centre: Vec3, forward: Vec3, radius: float,
) -> str:
    """Classify actual exposed front-surface eye polygons into 3D iris zones."""
    if not .008 <= radius <= .1:
        raise ValueError("Unexpected eye radius; check imported CC0 source scale.")
    f = unit(forward)
    diff = tuple(p - c for p, c in zip(point, centre))
    axial = dot(diff, f)
    radial = math.sqrt(max(0, dot(diff, diff) - axial * axial))
    # Only forward-facing geometry can receive the iris/pupil, leaving the
    # sphere rear and sides fully sclera. Material assignments do not alter UVs.
    if axial > radius * .55 and radial < radius * .215:
        return "pupil"
    if axial > radius * .50 and radial < radius * .525:
        return "iris"
    return "sclera"


def cornea_dome(
    centre: Vec3,
    forward: Vec3,
    up: Vec3,
    eyeball_radius: float,
    *,
    iris_fraction: float = .545,
    segments: int = 40,
    rings: int = 5,
) -> tuple[list[Vec3], list[tuple[int, int, int, int]]]:
    """Real, smooth, convex over-iris cornea shell in the eye's local space.

    This is separate physical geometry, not a texture or shader trick. Leave
    artist review/eye bone binding for a finished V2 character.
    """
    if not .015 <= eyeball_radius <= .1 or not .35 <= iris_fraction <= .7:
        raise ValueError("Cornea requires a measurable anatomically scaled source eye.")
    if segments < 12 or rings < 3:
        raise ValueError("Cornea must have sufficient real curvature segments.")
    f = unit(forward)
    u = unit(tuple(up[i] - dot(up, f) * f[i] for i in range(3)))
    h = unit(cross(f, u))
    radius = eyeball_radius * iris_fraction
    vertices: list[Vec3] = []
    quads: list[tuple[int, int, int, int]] = []
    for ring in range(rings + 1):
        # Centre ring is slightly open (0.001 of iris radius) so each quad has
        # four distinct vertices and normals remain stable at the apex.
        r = radius * max(.001, ring / rings)
        sphere = math.sqrt(max(0., eyeball_radius * eyeball_radius - r * r))
        dome = sphere + .00065 + .0007 * (1. - r / radius) ** 2
        for segment in range(segments):
            theta = math.tau * segment / segments
            vertices.append(tuple(
                centre[i] + f[i] * dome +
                u[i] * r * math.cos(theta) + h[i] * r * math.sin(theta)
                for i in range(3)
            ))
        if ring:
            prev = (ring - 1) * segments
            current = ring * segments
            for segment in range(segments):
                nxt = (segment + 1) % segments
                quads.append((prev + segment, prev + nxt, current + nxt, current + segment))
    return vertices, quads
