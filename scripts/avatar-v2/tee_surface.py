"""Avatar V2: inspect a physical T-shirt pattern on the actual CC0 body mesh.

This is not a procedural *runtime* shirt and not a certified garment. For the
four ALREADY EXISTING Starter Wardrobe tees, select the connected shoulder,
chest and upper-arm surface on the genuine stylized source body and lift its
topology along its *real* surface normals. Artists must subsequently sculpt
appropriate cloth thickness, physically author seams, UVs, garments and weights.
"""
from __future__ import annotations

from collections import defaultdict, deque
from math import isfinite
from typing import Sequence

Vec3 = tuple[float, float, float]

# Stable existing DB keys. Never create a second set of store items or boosts.
STARTER_TEES = (
    ("logo-tee", "clothing.starter.logo-tee", "Rockmundo Logo Tee"),
    ("plain-black-tee", "clothing.starter.plain-black-tee", "Plain Black Tee"),
    ("plain-white-tee", "clothing.starter.plain-white-tee", "Plain White Tee"),
    ("vintage-charcoal-tee", "clothing.starter.vintage-charcoal-tee", "Vintage Charcoal Tee"),
)


def upper_shirt_edge(abs_x: float) -> float:
    """U-shaped neck, rising toward the sculpt's genuine outer shoulders."""
    if not isfinite(abs_x) or abs_x < 0:
        raise ValueError("Invalid measured garment surface coordinate.")
    t = max(0., min(1., (abs_x - .075) / .135))
    smooth = t * t * (3. - 2. * t)
    return 1.355 + .135 * smooth


def inside_shirt_region(point: Vec3) -> bool:
    """Approximate editable cutting boundaries, *never* final cloth sizing."""
    if len(point) != 3 or not all(isfinite(v) for v in point):
        raise ValueError("Invalid real source geometry for starter tee proof.")
    x, _y, z = point
    side = abs(x)
    if side > .415:
        return False
    # Short sleeves grow from the actual connected arm surface, rather than
    # scaling the chest into a wrist-width poncho.
    lower = .995 if side < .225 else 1.285
    return lower < z < upper_shirt_edge(side)


def largest_connected_surface(
    positions: Sequence[Vec3], polygons: Sequence[Sequence[int]],
) -> list[int]:
    """Return only the actual connected CC0 torso+short-sleeve component.

    A source sculpt can have separate fingers/inner overlapping triangles in
    this height band; disconnected islands must never become loose clothing.
    """
    if len(positions) < 1000 or len(polygons) < 800:
        raise ValueError("A complete, original CC0 body mesh is required.")
    if any(len(p) != 3 or not all(isfinite(v) for v in p) for p in positions):
        raise ValueError("The original body has invalid real vertex coordinates.")
    selected = {}
    links: dict[tuple[int, int], list[int]] = defaultdict(list)
    for index, polygon in enumerate(polygons):
        if len(polygon) < 3 or any(vertex < 0 or vertex >= len(positions) for vertex in polygon):
            raise ValueError("The body contains an invalid source face.")
        centre = tuple(sum(positions[vertex][axis] for vertex in polygon) / len(polygon)
                       for axis in range(3))
        if not inside_shirt_region(centre):
            continue
        selected[index] = tuple(polygon)
        for a, b in zip(polygon, (*polygon[1:], polygon[0])):
            links[tuple(sorted((a, b)))].append(index)
    if len(selected) < 100:
        raise ValueError("The measured body has no substantial real torso/upper-arm surface.")
    neighbours: dict[int, set[int]] = defaultdict(set)
    for faces in links.values():
        if len(faces) >= 2:
            for face in faces:
                neighbours[face].update(other for other in faces if other != face)

    remaining = set(selected)
    components = []
    while remaining:
        current = remaining.pop()
        component = {current}
        queue = deque([current])
        while queue:
            for adjacent in neighbours[queue.popleft()] & remaining:
                remaining.remove(adjacent)
                component.add(adjacent)
                queue.append(adjacent)
        components.append(component)
    main = max(components, key=len)
    if len(main) < 350:
        raise ValueError("No connected real shoulder/chest surface; no tee may be published.")

    front = back = left = right = 0
    for index in main:
        p = selected[index]
        x = sum(positions[i][0] for i in p) / len(p)
        y = sum(positions[i][1] for i in p) / len(p)
        z = sum(positions[i][2] for i in p) / len(p)
        if 1.08 < z < 1.34 and abs(x) < .22:
            if y < -.07:
                front += 1
            if y > .035:
                back += 1
        if abs(x) > .23 and z > 1.29:
            left += x > 0
            right += x < 0
    if min(front, back, left, right) < 8:
        raise ValueError(
            "The connected real garment does not cover front/back chest and BOTH short sleeves: "
            f"{front=}, {back=}, {left=}, {right=}."
        )
    # Stable source-face order preserves the original Blender topology.
    return sorted(main)


def validate_surface_projection(
    source_points: Sequence[Vec3], projected_points: Sequence[Vec3], *,
    expected_offset: float = .014,
) -> dict:
    """Physical proximity check; no huge floating shell or false approval."""
    if len(source_points) < 350 or len(source_points) != len(projected_points):
        raise ValueError("Garment must retain all selected original body vertices.")
    distances = []
    from math import dist
    for a, b in zip(source_points, projected_points):
        if any(not isfinite(v) for v in (*a, *b)):
            raise ValueError("Garment has a non-finite original or projected coordinate.")
        distance = dist(a, b)
        if not .008 <= distance <= .023:
            raise ValueError("Garment topology is detached from the genuine source surface.")
        distances.append(distance)
    mean = sum(distances) / len(distances)
    if abs(mean - expected_offset) > .001:
        raise ValueError("The source-normal offset differs from the requested cloth shell.")
    return {
        "sourceSurfaceVertices": len(source_points),
        "minimumOffsetMm": round(min(distances) * 1000, 3),
        "maximumOffsetMm": round(max(distances) * 1000, 3),
        "averageOffsetMm": round(mean * 1000, 3),
        "originalSurfaceConforming": True,
        "manualGarmentFitRequired": True,
        "productionValidated": False,
    }
