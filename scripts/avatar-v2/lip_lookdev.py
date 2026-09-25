"""World-space classification for actual CC0 sculpted lips (not painted-on planes).

The source already has sculpted upper/lower lip topology. Assign materials to
its existing forward-facing polygons using measured eye spacing/height; no
invented 3D mouth mesh, UV destruction or claim of animated lip deformation.
Coordinate convention here: Blender Z up, face forward -Y, metres.
"""
from __future__ import annotations

from math import hypot, isfinite

Vec3 = tuple[float, float, float]
LIP_ROLES = ("skin", "transition", "upper_lip", "lower_lip")


def classify_lip_polygon(
    centre: Vec3,
    normal: Vec3,
    eye_midpoint: Vec3,
    eye_radius: float,
) -> str:
    if (not 0.022 <= eye_radius <= 0.05 or
            any(len(vec) != 3 or not all(isfinite(x) for x in vec)
                for vec in (centre, normal, eye_midpoint))):
        raise ValueError("Lip source needs valid, finite real-scale eye and polygon geometry.")
    # These are guide proportions ONLY; coverage is evaluated on each REAL
    # source polygon in frontal world space. Deliberately omit cheek, chin,
    # philtrum, tongue and the back of the head.
    lip_z = eye_midpoint[2] - 2.90 * eye_radius
    horiz = (centre[0] - eye_midpoint[0]) / (1.03 * eye_radius)
    vert = (centre[2] - lip_z) / (.39 * eye_radius)
    ellipse = hypot(horiz, vert)

    if (centre[1] > eye_midpoint[1] - .50 * eye_radius
            or normal[1] > -.08 or ellipse >= 1.08):
        return "skin"
    if ellipse >= .77:
        return "transition"
    return "upper_lip" if centre[2] >= lip_z else "lower_lip"


def validate_coverage(counts: dict[str, int], body_polygons: int) -> None:
    """Fail a genuine source change that tints nothing or half of the face."""
    if (body_polygons < 1000 or counts.get("upper_lip", 0) < 8
            or counts.get("lower_lip", 0) < 8
            or counts.get("transition", 0) < 16):
        raise ValueError(f"Missing separate genuine upper/lower lip polygons and shaded boundary: {counts}, body polygons={body_polygons}.")
    coverage = sum(counts.get(role, 0) for role in LIP_ROLES[1:])
    if coverage > body_polygons * .018:
        raise ValueError("Lip mask covers too much actual head/body geometry.")
