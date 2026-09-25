"""Blender-independent 3D brow and eyelash construction on actual Avatar V2 faces.

Coordinates are world-space metres: Blender Z up, -Y forward, +X left.
All hair roots are later individually projected onto the *real continuous*
CC0 skin surface by the Blender adapter. This module only defines controlled
curves and converts their swept tapered fibres into exportable 3D mesh, never
pretending that these additional meshes are the final skinned brow/lash system.
"""
from __future__ import annotations

from math import cos, dist, isfinite, pi, sin, sqrt, tau

Vec3 = tuple[float, float, float]
MIN_EYE_RADIUS = .022
MAX_EYE_RADIUS = .05


def validate_eye(eye: Vec3, radius: float, side: str) -> int:
    if side not in ("L", "R"):
        raise ValueError("Eyebrow and eyelash side must be L or R.")
    if not MIN_EYE_RADIUS <= radius <= MAX_EYE_RADIUS or not isfinite(radius):
        raise ValueError("Real eye radius must be in the 22–50mm range.")
    if len(eye) != 3 or not all(isfinite(x) for x in eye):
        raise ValueError("Eye pivot must have finite world-space coordinates.")
    return 1 if side == "L" else -1


def brow_profile(
    eye: Vec3, radius: float, side: str, samples: int = 27,
) -> list[tuple[float, float, float]]:
    """Inside-out x/z brow arc and physical half-width before skin projection."""
    sign = validate_eye(eye, radius, side)
    if not 16 <= samples <= 100:
        raise ValueError("Eyebrow strips need 16–100 uniformly ordered samples.")
    result = []
    for i in range(samples):
        t = i / (samples - 1)
        x = eye[0] + sign * radius * (-.91 + 2.02 * t)
        z = eye[2] + radius * (.995 + .16 * sin(pi * t) + .04 * (1. - t))
        # Narrow on both ends; broadest above the central/outer eye.
        half_width = radius * (.009 + .103 * sin(pi * t) ** .85)
        result.append((x, z, half_width))
    return result


def brow_fibre_samples(
    eye: Vec3, radius: float, side: str, count: int = 112,
) -> list[tuple[float, float, float, float]]:
    """Deterministic hair-root arc coordinates: x,z,length and forward offset."""
    sign = validate_eye(eye, radius, side)
    if not 24 <= count <= 150:
        raise ValueError("Brow detailing requires 24–150 actual 3D fibres per brow.")
    result = []
    for i in range(count):
        t = .055 + .86 * (i + .5) / count
        centre_z = eye[2] + radius * (.995 + .16 * sin(pi * t) + .04 * (1.-t))
        half = radius * (.015 + .145 * sin(pi * t) ** .85)
        # Two naturally staggered directions across the breadth of the arch,
        # without randomness, to produce repeatable real Blender meshes.
        offset = (((i * 17) % 13) / 12. - .5) * half * 1.55
        x = eye[0] + sign * radius * (-.91 + 2.02 * t)
        z = centre_z + offset
        length = .0025 + .0028 * sin(pi * t)
        result.append((x, z, length, .0012))
    return result


def upper_lash_roots(
    eye: Vec3, radius: float, side: str, count: int = 27,
) -> list[tuple[float, float, float]]:
    """x/z on anatomically scaled UPPER eyelid, lash length in metres."""
    sign = validate_eye(eye, radius, side)
    if not 14 <= count <= 42:
        raise ValueError("An upper eyelid needs 14–42 discrete real 3D fibres.")
    roots = []
    for i in range(count):
        u = -.82 + 1.64 * (i + .5) / count
        x = eye[0] + sign * radius * u
        z = eye[2] + radius * (.60 * sqrt(1. - u * u) + .065)
        length = (.005 + .004 * max(0., u) + .001 * sin(pi * (u + 1.) / 2.))
        roots.append((x, z, length))
    return roots


def _vec(a: Vec3, b: Vec3) -> Vec3:
    return tuple(a[i] - b[i] for i in range(3))


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def _unit(a: Vec3) -> Vec3:
    norm = sqrt(sum(x*x for x in a))
    if norm < 1e-10 or not isfinite(norm):
        raise ValueError("Cannot sweep an empty or non-finite physical hair fibre.")
    return tuple(v / norm for v in a)


def sweep_tapered_fibre(
    points: tuple[Vec3, Vec3, Vec3],
    radius: float,
    sides: int = 6,
) -> tuple[list[Vec3], list[tuple[int, int, int, int]]]:
    """Exportable tube with THREE true 3D rings (not a flat alpha hair card).

    Produces consistently outward-facing quad strips with a subpixel physical
    tip. The Blender adapter joins all fibres in each brow/lash into one mesh
    to avoid per-hair scene nodes/draw calls.
    """
    if not .00012 <= radius <= .00075 or not 5 <= sides <= 10:
        raise ValueError("Source eyebrow/lash fibre radius or facets are outside safe bounds.")
    if len(points) != 3 or any(len(point) != 3 for point in points):
        raise ValueError("Fibre needs three genuine 3D control points.")
    if not all(isfinite(v) for point in points for v in point):
        raise ValueError("Fibre contains non-finite sculpt coordinates.")
    if dist(points[0], points[-1]) < .001:
        raise ValueError("A physical hair fibre must span at least 1mm.")
    vertices: list[Vec3] = []
    faces: list[tuple[int, int, int, int]] = []
    for ring, point in enumerate(points):
        if ring == 0:
            tangent = _unit(_vec(points[1], points[0]))
        elif ring == 2:
            tangent = _unit(_vec(points[2], points[1]))
        else:
            tangent = _unit(_vec(points[2], points[0]))
        axis = (0., 0., 1.) if abs(tangent[2]) < .85 else (0., -1., 0.)
        radial_u = _unit(_cross(tangent, axis))
        radial_v = _cross(tangent, radial_u)
        r = radius * (1.0 if ring == 0 else .70 if ring == 1 else .075)
        for segment in range(sides):
            theta = tau * segment / sides
            vertices.append(tuple(
                point[k] + r * (cos(theta) * radial_u[k] + sin(theta) * radial_v[k])
                for k in range(3)
            ))
        if ring:
            first = (ring - 1) * sides
            current = ring * sides
            for segment in range(sides):
                after = (segment + 1) % sides
                faces.append((
                    first + segment,
                    first + after,
                    current + after,
                    current + segment,
                ))
    return vertices, faces
