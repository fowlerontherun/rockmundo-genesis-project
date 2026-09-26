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


def inside_shirt_region(point: Vec3, frame: str = "masculine") -> bool:
    """Approximate editable cutting boundaries, *never* final cloth sizing."""
    if len(point) != 3 or not all(isfinite(v) for v in point):
        raise ValueError("Invalid real source geometry for starter tee proof.")
    if frame not in ("masculine", "feminine"):
        raise ValueError("Unknown source sculpt frame; no authored tee fit is possible.")
    x, _y, z = point
    # The pinned official sculpts are independently normalized to 1.80m and
    # 1.72m. Reusing masculine WORLD-metre sleeve heights on the smaller
    # feminine frame previously severed both real sleeves from the torso.
    height_ratio = 1. if frame == "masculine" else 1.72 / 1.80
    # Separate non-production clothing pattern per frame. Artist must still
    # inspect final girth/length and paint real garment skin weights.
    width_ratio = 1. if frame == "masculine" else .94
    side = abs(x) / width_ratio
    cut_height = z / height_ratio
    if side > .415:
        return False
    lower = .995 if side < .225 else 1.285
    return lower < cut_height < upper_shirt_edge(side)


def largest_connected_surface(
    positions: Sequence[Vec3], polygons: Sequence[Sequence[int]],
    frame: str = "masculine",
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
        if not inside_shirt_region(centre, frame):
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
    height_ratio = 1. if frame == "masculine" else 1.72 / 1.80
    width_ratio = 1. if frame == "masculine" else .94
    for index in main:
        p = selected[index]
        x = sum(positions[i][0] for i in p) / len(p)
        y = sum(positions[i][1] for i in p) / len(p)
        z = sum(positions[i][2] for i in p) / len(p)
        if 1.08 * height_ratio < z < 1.34 * height_ratio and abs(x) < .22 * width_ratio:
            if y < -.07:
                front += 1
            if y > .035:
                back += 1
        # The smaller original feminine shoulder sits below the male world-
        # space sleeve band: audit the REAL connected lateral upper-arm mesh
        # relative to that frame rather than silently accepting 0 sleeves.
        if abs(x) > .190 * width_ratio and z > 1.205 * height_ratio:
            left += x > 0
            right += x < 0
    if min(front, back, left, right) < 8:
        raise ValueError(
            "The connected real garment does not cover front/back chest and BOTH short sleeves: "
            f"{frame=}, {front=}, {back=}, {left=}, {right=}."
        )
    # Stable source-face order preserves the original Blender topology.
    return sorted(main)



def source_boundary_edges(polygons: Sequence[Sequence[int]]) -> list[tuple[int, int]]:
    """Return only true source-mesh cut loops, never interior triangle edges."""
    edge_faces: dict[tuple[int, int], int] = defaultdict(int)
    for polygon in polygons:
        if len(polygon) < 3 or len(set(polygon)) != len(polygon):
            raise ValueError("Cannot sew invalid original CC0 source garment polygons.")
        for a, b in zip(polygon, (*polygon[1:], polygon[0])):
            edge_faces[tuple(sorted((a, b)))] += 1
    borders = sorted(edge for edge, count in edge_faces.items() if count == 1)
    if len(borders) < 20:
        raise ValueError("A real tee shell requires continuous neck, hem and armhole edges.")
    if any(count > 2 for count in edge_faces.values()):
        raise ValueError("Non-manifold prototype seam: clean original selected polygons first.")
    return borders


def relax_source_boundary(
    points: Sequence[Vec3], polygons: Sequence[Sequence[int]],
    *, iterations: int = 10, strength: float = .48,
) -> tuple[list[Vec3], int]:
    """Smooth only source-connected neckline/cuffs/hem; never blur body shape.

    A selection by original polygon centroids creates polygon-staircase neck
    and sleeve edges. Iterative boundary-only Laplacian tangential smoothing
    rounds them while leaving all genuine torso/shoulder inner polygons and
    original mesh connectivity intact. Blender REPROJECTS the altered cut
    vertices onto the original real CC0 sculpt, then lifts exactly 14mm:
    this pure helper does not certify a final wearable fit.
    """
    if not 1 <= iterations <= 24 or not .01 <= strength <= .6:
        raise ValueError("Refusing unsafe or unbounded preliminary hem smoothing.")
    borders = source_boundary_edges(polygons)
    adjacency: dict[int, set[int]] = defaultdict(set)
    for a, b in borders:
        if not 0 <= a < len(points) or not 0 <= b < len(points):
            raise ValueError("Shirt boundary contains source vertices outside the mesh.")
        adjacency[a].add(b)
        adjacency[b].add(a)
    if len(adjacency) < 20:
        raise ValueError("Real CC0 torso has insufficient continuous garment boundary.")
    if any(len(neighbours) != 2 for neighbours in adjacency.values()):
        raise ValueError("Extracted shirt has open/non-manifold neckline or cuffs.")
    result = [tuple(point) for point in points]
    originals = tuple(result)
    for _ in range(iterations):
        updated = list(result)
        for index, neighbours in adjacency.items():
            a, b = tuple(sorted(neighbours))
            mean = tuple((result[a][axis] + result[b][axis]) * .5 for axis in range(3))
            proposed = tuple(result[index][axis] * (1. - strength) +
                             mean[axis] * strength for axis in range(3))
            from math import dist
            if dist(proposed, originals[index]) > .036:
                raise ValueError("Hem smoothing would detach clothing from its original source topology.")
            updated[index] = proposed
        result = updated
    return result, len(adjacency)


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
