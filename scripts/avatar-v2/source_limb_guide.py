"""Build UNAPPROVED source-driven arm and finger guide landmarks from real CC0 skin.

The original generic guide used 0.475 * full body height for palm X, putting
its finger bones ~0.5 METRES away from either genuine source sculpt. Source
geometry supplies better INITIAL placement. Only independent artist-snapped
handles plus weight painting and review can promote a body to production.

Pure Python with no Blender dependencies so geometric/safety checks run in CI.
World axes: Blender X horizontal, Y depth, Z up, metres.
"""
from __future__ import annotations

from math import dist, isfinite
from statistics import median
from typing import Sequence

Vec3 = tuple[float, float, float]
DIGIT_LENGTHS = {
    "Thumb": (.020, .017, .014),
    "Index": (.022, .018, .015),
    "Middle": (.024, .020, .016),
    "Ring": (.022, .018, .015),
    "Pinky": (.018, .015, .012),
}
DIGIT_DEPTH_SPREAD = {
    "Thumb": -.045, "Index": -.012, "Middle": 0.,
    "Ring": .012, "Pinky": .024,
}
DIGIT_X_OFFSETS = {
    "Thumb": -.030, "Index": -.002, "Middle": .003,
    "Ring": .001, "Pinky": -.004,
}


def median_point(vertices: Sequence[Vec3]) -> Vec3:
    if not vertices:
        raise ValueError("No actual body vertices in the anatomical guide slice")
    return tuple(float(median(p[i] for p in vertices)) for i in range(3))


def percentile(values: Sequence[float], pct: float) -> float:
    ordered = sorted(values)
    if not ordered or not 0 <= pct <= 1:
        raise ValueError("No distal source vertices or invalid percentile")
    return float(ordered[round((len(ordered) - 1) * pct)])


def source_limb_landmarks(body_vertices: Sequence[Sequence[float]]) -> dict:
    """True per-frame medians at shoulder, elbow, wrist, palm and fingertip.

    These are *source-proximate unreviewed guides*, not anatomical pivot or
    individualized knuckle fitting. The samples must be actual body vertices
    and both halves must be measured INDEPENDENTLY.
    """
    if len(body_vertices) < 1000:
        raise ValueError("Requires a continuous actual CC0 body with >=1000 vertices")
    points = [tuple(map(float, p)) for p in body_vertices]
    if any(len(p) != 3 or not all(isfinite(x) for x in p) for p in points):
        raise ValueError("Invalid non-finite/incorrect body vertex coordinates")
    floor = min(p[2] for p in points)
    ceiling = max(p[2] for p in points)
    height = ceiling - floor
    if not 1.3 <= height <= 2.1:
        raise ValueError("Unexpected normalized source body height")
    centre_x = (min(p[0] for p in points) + max(p[0] for p in points)) * .5
    result = {"realSourceVertexCount": len(points), "height": height,
              "artistReviewed": False, "sourceGuideOnly": True, "sides": {}}
    for side, direction in (("L", 1), ("R", -1)):
        outer = max(direction * (p[0] - centre_x) for p in points)
        if not .12 <= outer <= .56:
            raise ValueError(f"{side} actual hand reach is outside pinned body scale")
        landmarks = {}
        slice_rules = (
            ("shoulder", .755, .34, .018),
            ("elbow", .615, .56, .018),
            ("wrist", .490, .70, .018),
        )
        for name, fraction, lateral, thickness in slice_rules:
            level = floor + height * fraction
            matches = [p for p in points
                       if abs(p[2] - level) <= height * thickness
                       and direction * (p[0] - centre_x) > lateral * outer]
            if len(matches) < 15:
                raise ValueError(f"{side} actual {name} skin patch is not measurable")
            landmarks[name] = median_point(matches)
        wrist = landmarks["wrist"]
        distal = [
            p[2] for p in points
            if direction * (p[0] - centre_x) > outer * .77
            and wrist[2] - height * .18 < p[2] < wrist[2]
        ]
        if len(distal) < 30:
            raise ValueError(f"{side} has no independent actual hand/fingertip source patch")
        tip = percentile(distal, .01)
        palm_level = wrist[2] - .40 * (wrist[2] - tip)
        palm_candidates = [p for p in points
                           if abs(p[2] - palm_level) <= height * .014
                           and direction * (p[0] - centre_x) > outer * .77]
        if len(palm_candidates) < 12:
            raise ValueError(f"{side} actual palm patch is unresolved")
        landmarks["palm"] = median_point(palm_candidates)
        palm = landmarks["palm"]
        if not (landmarks["shoulder"][2] > landmarks["elbow"][2] >
                wrist[2] > palm[2] > tip + .012):
            raise ValueError(f"{side} source shoulder/wrist/palm joint order is implausible")
        if not (direction * (landmarks["elbow"][0] - landmarks["shoulder"][0]) > .03
                and direction * (wrist[0] - landmarks["elbow"][0]) > .02):
            raise ValueError(f"{side} measured source arm points backwards")
        if not .017 <= dist(wrist, palm) <= .13:
            raise ValueError(f"{side} measured hand length is implausible")
        middle_source_length = sum(DIGIT_LENGTHS["Middle"]) * height
        finger_scale = .9 * (palm[2] - tip) / middle_source_length
        if not .25 <= finger_scale <= 1.2:
            raise ValueError(f"{side} observed finger reach is not anatomically plausible")
        result["sides"][side] = {
            **landmarks, "observedFingertipLevel": tip,
            "unreviewedFingerLengthScale": finger_scale,
            "actualOuterReach": outer,
        }
    for joint in ("shoulder", "elbow", "wrist", "palm"):
        left = result["sides"]["L"][joint]
        right = result["sides"]["R"][joint]
        if abs(left[2] - right[2]) > .06 or abs(left[1] - right[1]) > .085:
            raise ValueError(f"Left/right observed {joint} skin patches do not match")
    return result


def source_finger_bone_segments(side: str, limb: dict, height: float) -> dict[str, tuple[Vec3, Vec3]]:
    """Place all 15 provisional finger segments per side along real palm axis."""
    if side not in ("L", "R"):
        raise ValueError("Unknown source arm side")
    direction = 1 if side == "L" else -1
    wrist, palm = limb["wrist"], limb["palm"]
    hand_vector = tuple((p - w) / dist(wrist, palm) for p, w in zip(palm, wrist))
    segments = {}
    for digit, lengths in DIGIT_LENGTHS.items():
        depth = DIGIT_DEPTH_SPREAD[digit] * height * (1. if digit == "Thumb" else .6)
        x = direction * DIGIT_X_OFFSETS[digit] * height
        height_offset = .022 * height if digit == "Thumb" else 0.
        start = (palm[0] + x, palm[1] + depth, palm[2] + height_offset)
        axis = hand_vector
        if digit == "Thumb":
            tilted = (axis[0] - direction * .24, axis[1], axis[2] + .15)
            norm = sum(x * x for x in tilted) ** .5
            axis = tuple(x / norm for x in tilted)
        for index, length in enumerate(lengths, start=1):
            distance = length * height * limb["unreviewedFingerLengthScale"] * (
                .65 if digit == "Thumb" else 1.
            )
            end = tuple(x + distance * unit for x, unit in zip(start, axis))
            segments[f"{digit}{index}.{side}"] = (start, end)
            start = end
    return segments
