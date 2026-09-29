"""Validate an UNAPPROVED CC0 source-weight report against a separate handle scene.

The Blender caller supplies actual source vertices and live rig-bone geometry,
so a previous run, opposite body or unrelated source cannot silently place
surface hints on artist-movable anatomical controls. This NEVER fits a joint.
"""
from __future__ import annotations

from math import dist, isfinite
from typing import Mapping, Sequence

from phase1_body_contract import DIGITS, segment_distance

FINGER_BONES = {
    f"{digit}{joint}.{side}"
    for side in ("L", "R")
    for digit in DIGITS
    for joint in (1, 2, 3)
}


def validate_finger_handoff(
    report: Mapping,
    frame: str,
    source_positions: Sequence[Sequence[float]],
    bone_segments: Mapping[str, tuple[Sequence[float], Sequence[float]]],
) -> dict[str, dict]:
    """Return precisely matched source-surface hints, rejecting stale inputs.

    No derived hint is an anatomical pivot; every actual fit handle remains
    editable and untouched. Distances are metres except sourceDistanceMm.
    """
    if frame not in ("masculine", "feminine"):
        raise ValueError("Unknown independent frame")
    if (report.get("schema") != "rockmundo.avatar-v2-unfitted-binding-experiment"
            or report.get("version") != 1 or report.get("frame") != frame
            or report.get("sourceUnfitted") is not True
            or report.get("artistReviewed") is not False
            or report.get("productionValidated") is not False
            or report.get("error")):
        raise ValueError("Requires successful UNFITTED, UNAPPROVED same-frame probe")
    if len(source_positions) < 1000 or report.get("realSourceVertices") != len(source_positions):
        raise ValueError("Source mesh vertex count differs from real Blender diagnostic")
    if set(bone_segments) != FINGER_BONES:
        raise ValueError("An actual complete 30-segment finger rig is required")
    if not all(len(p) == 3 and all(isfinite(x) for x in p) for p in source_positions):
        raise ValueError("Invalid real source mesh geometry")

    initial = report.get("initialSkinAudit")
    hints = report.get("fingerFitReviewHints")
    if not isinstance(initial, dict) or not isinstance(hints, dict):
        raise ValueError("Missing real Blender paint audit and source-surface hints")
    absent = set(initial.get("missingDeformBones", [])) & FINGER_BONES
    if not absent or set(hints) != absent:
        raise ValueError("Source hint names do not exactly match actual unweighted joints")

    for name, hint in sorted(hints.items()):
        if not isinstance(hint, dict):
            raise ValueError(f"{name}: malformed source-surface hint")
        if (hint.get("hintIsOnSkinNotInternalJointPivot") is not True
                or hint.get("artistReviewed") is not False
                or hint.get("productionValidated") is not False):
            raise ValueError(f"{name}: an unapproved surface hint must never claim joint approval")
        index = hint.get("nearestActualSourceVertexIndex")
        if type(index) is not int or not 0 <= index < len(source_positions):
            raise ValueError(f"{name}: invalid original source vertex")
        point = source_positions[index]
        if len(hint.get("actualSourceSurfacePosition", [])) != 3 or dist(
            point, hint["actualSourceSurfacePosition"]
        ) > .000003:
            raise ValueError(f"{name}: source mesh changed since heat probe")
        head, tail = bone_segments[name]
        if (len(hint.get("currentGuideHead", [])) != 3
                or len(hint.get("currentGuideTail", [])) != 3
                or dist(head, hint["currentGuideHead"]) > .000005
                or dist(tail, hint["currentGuideTail"]) > .000005):
            raise ValueError(f"{name}: guide bone changed since heat probe; regenerate hints")
        actual_distance_mm = segment_distance(point, head, tail)[0] * 1000
        recorded = hint.get("sourceDistanceMm")
        if (not isinstance(recorded, (float, int)) or not isfinite(recorded)
                or abs(actual_distance_mm - recorded) > .015):
            raise ValueError(f"{name}: hint distance differs from actual source scene")
        donors = hint.get("nearestSourceWeights")
        if not isinstance(donors, dict) or any(
            not isinstance(w, (float, int)) or not isfinite(w) or w < 0 or w > 1.001
            for w in donors.values()
        ):
            raise ValueError(f"{name}: invalid diagnostic paint ownership")
        digit = name.split(".")[0].rstrip("123")
        side = name.rsplit(".", 1)[1]
        competing = sorted(
            bone for bone, value in donors.items()
            if value > .0001 and bone.endswith("." + side)
            and any(bone.startswith(other) for other in DIGITS if other != digit)
        )
        if (hint.get("nearbyOtherDigitWeights") != competing
                or hint.get("possibleWrongFingerSurface") is not bool(competing)):
            raise ValueError(f"{name}: incorrect wrong-digit topology warning")
    return dict(sorted(hints.items()))
