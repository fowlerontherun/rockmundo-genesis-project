"""Geometry checks for artist-authored Avatar V2 close-up face landmarks.

This module deliberately has no Blender dependency so its geometric rules can be
regression-tested without a graphics workstation. Inputs are world-space metres
from vertex groups on ONE contiguous, skinned head mesh. Vertex groups, rather
than separate nose/ear meshes, preserve the sculpt's continuous UV/topology.
"""

from __future__ import annotations

from math import dist
from typing import Mapping, Sequence

Point = tuple[float, float, float]
LandmarkPoints = Mapping[str, Sequence[Point]]

# A handful of points or arbitrary empties cannot certify a close-up sculpt.
MIN_VERTICES = {
    "RMV2_NoseBridge": 8,
    "RMV2_NoseTip": 8,
    "RMV2_NostrilRim.L": 8,
    "RMV2_NostrilRim.R": 8,
    "RMV2_EarHelix.L": 14,
    "RMV2_EarHelix.R": 14,
    "RMV2_EarAntihelix.L": 10,
    "RMV2_EarAntihelix.R": 10,
    "RMV2_EarLobe.L": 8,
    "RMV2_EarLobe.R": 8,
}


def centre(points: Sequence[Point]) -> Point:
    return tuple(sum(p[axis] for p in points) / len(points) for axis in range(3))  # type: ignore[return-value]


def span(points: Sequence[Point], axis: int) -> float:
    return max(p[axis] for p in points) - min(p[axis] for p in points)


def front_projection(point: Point, forward: Point) -> float:
    return sum(point[axis] * forward[axis] for axis in range(3))


def audit_face_topology(
    groups: LandmarkPoints,
    anchors: Mapping[str, Point],
    *,
    forward: Point = (0, -1, 0),
) -> list[str]:
    """Return reasons a LOD0/LOD1 sculpt needs further manual topology work.

    +X is left on the RockMundo Blender guide; -Y faces the camera before
    glTF's +Y-up conversion. All thresholds are in world-space metres after the
    seed's height normalization.
    """
    errors: list[str] = []
    for name, minimum in MIN_VERTICES.items():
        count = len(groups.get(name, ()))
        if count < minimum:
            errors.append(f"{name}: {count} selected vertices; requires at least {minimum} on the continuous head mesh.")

    if any(len(groups.get(name, ())) < required for name, required in MIN_VERTICES.items()):
        return errors

    bridge = centre(groups["RMV2_NoseBridge"])
    tip = centre(groups["RMV2_NoseTip"])
    nostril_l = centre(groups["RMV2_NostrilRim.L"])
    nostril_r = centre(groups["RMV2_NostrilRim.R"])

    if span(groups["RMV2_NoseBridge"], 2) < .008:
        errors.append("Nose bridge topology is too flat vertically; retain at least 8mm of actual bridge span.")
    if span(groups["RMV2_NoseTip"], 0) < .006:
        errors.append("Nose tip topology is too narrow; retain at least 6mm of real tip width.")
    if front_projection(tip, forward) - front_projection(bridge, forward) < .006:
        errors.append("Nose tip must protrude at least 6mm forward of the bridge landmark.")
    if front_projection(tip, forward) - max(
        front_projection(nostril_l, forward),
        front_projection(nostril_r, forward),
    ) < .003:
        errors.append("Nostril rims need at least 3mm of depth behind the nose tip, not a painted flat face.")
    if nostril_l[0] - nostril_r[0] < .012 or nostril_l[0] <= bridge[0] or nostril_r[0] >= bridge[0]:
        errors.append("Left/right nostril rims must be on the correct sides and at least 12mm apart.")
    for side in ("L", "R"):
        if span(groups[f"RMV2_NostrilRim.{side}"], 0) < .003:
            errors.append(f"{side} nostril rim has less than 3mm of actual lateral topology.")

    helix_l = centre(groups["RMV2_EarHelix.L"])
    helix_r = centre(groups["RMV2_EarHelix.R"])
    if helix_l[0] - helix_r[0] < .125:
        errors.append("Left/right outer ears must be distinct and at least 125mm apart at normalized authoring scale.")
    for side, helix in (("L", helix_l), ("R", helix_r)):
        antihelix = centre(groups[f"RMV2_EarAntihelix.{side}"])
        lobe = centre(groups[f"RMV2_EarLobe.{side}"])
        if span(groups[f"RMV2_EarHelix.{side}"], 2) < .028:
            errors.append(f"{side} outer ear needs at least 28mm of authored vertical helix contour.")
        if not .002 <= dist(antihelix, helix) <= .035:
            errors.append(f"{side} antihelix must be a distinct inner contour within 35mm of its helix.")
        if helix[2] - lobe[2] < .018:
            errors.append(f"{side} earlobe must sit at least 18mm below the helix centre.")
        if (side == "L" and helix[0] <= bridge[0] + .05) or (
            side == "R" and helix[0] >= bridge[0] - .05
        ):
            errors.append(f"{side} ear appears to be on the wrong side or merged into the central face.")
        anchor = anchors.get(f"EarAnchor.{side}")
        if anchor is None:
            errors.append(f"EarAnchor.{side} is missing; fit the piercing anchor to the authored lobe.")
        elif dist(anchor, lobe) > .025:
            errors.append(f"EarAnchor.{side} is over 25mm from the sculpted lobe; earrings/glasses will float.")

    # A vertex set copied between two groups is not additional anatomy.
    for a, b in (
        ("RMV2_NoseBridge", "RMV2_NoseTip"),
        ("RMV2_NostrilRim.L", "RMV2_NostrilRim.R"),
        ("RMV2_EarHelix.L", "RMV2_EarAntihelix.L"),
        ("RMV2_EarHelix.R", "RMV2_EarAntihelix.R"),
    ):
        common = set(groups[a]) & set(groups[b])
        if len(common) / min(len(groups[a]), len(groups[b])) > .5:
            errors.append(f"{a} and {b} overlap by more than half; mark distinct sculpted contours.")

    return errors
