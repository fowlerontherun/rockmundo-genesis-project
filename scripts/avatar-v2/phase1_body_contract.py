"""Shared, Blender-independent rules for Phase 1 Avatar V2 body certification.

Candidate preparation is NOT artist approval. The same weight and pose contract
applies independently to the real CC0 masculine and feminine fitted bodies.
"""
from __future__ import annotations

from math import isfinite, radians
from typing import Mapping

FRAMES = ("masculine", "feminine")
REGIONS = ("torso", "upper-arms", "lower-arms", "hands", "hips",
           "upper-legs", "lower-legs", "feet")
DIGITS = ("Thumb", "Index", "Middle", "Ring", "Pinky")
TWISTS = tuple(f"{part}.{side}" for side in ("L", "R")
               for part in ("UpperArmTwist", "ForearmTwist", "ThighTwist"))
CORE = ("Hips", "Spine1", "Spine2", "Neck", "Head", "Jaw")
DEFORM_BONES = CORE + tuple(
    f"{part}.{side}" for side in ("L", "R")
    for part in ("Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg",
                 "LowerLeg", "Foot", "Toe")
) + tuple(
    f"{digit}{joint}.{side}" for side in ("L", "R")
    for digit in DIGITS for joint in (1, 2, 3)
) + TWISTS
ATTACHMENT_BONES = ("Eye.L", "Eye.R", "EarAnchor.L", "EarAnchor.R")
CORRECTIVES = tuple(
    f"pose{joint}{side}" for joint in ("Shoulder", "Elbow", "Hip", "Knee")
    for side in ("Left", "Right")
)
# Angle in degrees; positive/negative is pose direction in WORLD space.
# These are deterministic QA poses, not authored or substituted animations.
POSES = {
    "reach": {"UpperArm.L": (0, 1, 0, -105), "UpperArm.R": (0, 1, 0, 105)},
    "arm-fold": {"LowerArm.L": (0, 1, 0, 115), "LowerArm.R": (0, 1, 0, -115)},
    "wrist-roll": {"Hand.L": (1, 0, 0, 85), "Hand.R": (1, 0, 0, -85)},
    "crouch": {"UpperLeg.L": (1, 0, 0, 85), "UpperLeg.R": (1, 0, 0, 85),
               "LowerLeg.L": (1, 0, 0, -110), "LowerLeg.R": (1, 0, 0, -110)},
    "seated-drums": {"UpperLeg.L": (1, 0, 0, 90), "UpperLeg.R": (1, 0, 0, 90),
                     "LowerLeg.L": (1, 0, 0, -90), "LowerLeg.R": (1, 0, 0, -90),
                     "UpperArm.L": (1, 0, 0, -35), "UpperArm.R": (1, 0, 0, -35)},
    "ankle-flex": {"Foot.L": (1, 0, 0, 35), "Foot.R": (1, 0, 0, 35),
                   "Toe.L": (1, 0, 0, -25), "Toe.R": (1, 0, 0, -25)},
    "instrument-grip": {f"{digit}{joint}.{side}": (0, 1, 0, 65)
                        for side in ("L", "R") for digit in DIGITS
                        for joint in (1, 2, 3)},
    "torso-twist": {"Spine1": (0, 0, 1, 20), "Spine2": (0, 0, 1, 28)},
}
# Mirror src/features/player-model/v2/avatarV2PoseCorrectives.ts JOINTS.
# The real game uses these exact quaternion-angle thresholds after stage IK.
CORRECTIVE_DRIVERS = {
    f"pose{joint}{side_name}": (f"{bone}.{side}", start, full)
    for joint, bone, start, full in (
        ("Shoulder", "UpperArm", .20, 1.05),
        ("Elbow", "LowerArm", .16, 1.45),
        ("Hip", "UpperLeg", .18, 1.02),
        ("Knee", "LowerLeg", .16, 1.45),
    )
    for side_name, side in (("Left", "L"), ("Right", "R"))
}


def pose_corrective_weights(pose: Mapping[str, tuple[float, float, float, float]]) -> dict[str, float]:
    """Match Three.js smoothstep of the actual bone's angular rest-pose delta.

    Each test pose contains (world axis x/y/z, signed degrees). The QA uses
    angular distance just like the live controller, never signed bend alone.
    """
    values = {}
    for name, (bone, start, full) in CORRECTIVE_DRIVERS.items():
        spec = pose.get(bone)
        angle = 0.0 if spec is None else radians(abs(spec[3]))
        if not isfinite(angle):
            raise ValueError(f"Non-finite angular input for {bone}")
        t = max(0.0, min(1.0, (angle - start) / (full - start)))
        values[name] = t * t * (3.0 - 2.0 * t)
    return values


# Bone-to-region mapping for genuine face-weighted occlusion material assignment.
REGION_BONES = {
    "torso": {"Spine1", "Spine2", "Neck", "Head", "Jaw"},
    "upper-arms": {f"{part}.{side}" for side in ("L", "R")
                   for part in ("Shoulder", "UpperArm", "UpperArmTwist")},
    "lower-arms": {f"{part}.{side}" for side in ("L", "R")
                   for part in ("LowerArm", "ForearmTwist")},
    "hands": {f"{part}.{side}" for side in ("L", "R")
              for part in ("Hand",)} |
             {f"{digit}{joint}.{side}" for side in ("L", "R")
              for digit in DIGITS for joint in (1, 2, 3)},
    "hips": {"Hips"},
    "upper-legs": {f"{part}.{side}" for side in ("L", "R")
                   for part in ("UpperLeg", "ThighTwist")},
    "lower-legs": {f"LowerLeg.{side}" for side in ("L", "R")},
    "feet": {f"{part}.{side}" for side in ("L", "R")
             for part in ("Foot", "Toe")},
}


def normalise_four(weights: Mapping[str, float], *, epsilon: float = 0.0001) -> dict[str, float]:
    """Fail on invalid input; retain top four meaningful influences and re-normalise."""
    if not weights:
        raise ValueError("A body vertex has no skin weights")
    if any(not isinstance(w, (int, float)) or not isfinite(w) or w < 0
           for w in weights.values()):
        raise ValueError("Negative or non-finite skin weight")
    ordered = sorted(((bone, float(weight)) for bone, weight in weights.items()
                      if weight > epsilon), key=lambda item: (-item[1], item[0]))[:4]
    total = sum(weight for _, weight in ordered)
    if not total:
        raise ValueError("A body vertex has no meaningful skin weights")
    return {bone: weight / total for bone, weight in ordered}


def region_from_weights(vertex_weights: list[Mapping[str, float]]) -> str:
    """A polygon is assigned to its dominant *actual skinning* region."""
    totals = {region: 0.0 for region in REGIONS}
    for weights in vertex_weights:
        for region, bones in REGION_BONES.items():
            totals[region] += sum(weights.get(bone, 0.0) for bone in bones)
    return max(REGIONS, key=lambda region: totals[region])


def report_errors(report: dict) -> list[str]:
    """Prevent either gender being called Phase 1 complete without independent evidence."""
    errors = []
    if report.get("frame") not in FRAMES:
        errors.append("Unrecognised frame")
    if not report.get("jointFit", {}).get("reviewed"):
        errors.append("Missing artist-reviewed joint-fit report")
    if report.get("missingDeformBones"):
        errors.append("Some required deform bones carry no body weight")
    if report.get("insufficientDeformBones"):
        errors.append("Required finger or twist chains have insufficient real weighted vertices")
    if report.get("nonBodyBoneInfluences"):
        errors.append("Body contains undeclared deform bone influences")
    if report.get("invalidWeights", 0):
        errors.append("Invalid non-finite or negative source weights")
    if report.get("unweightedVertices", 1) or report.get("overInfluencedVertices", 1):
        errors.append("Unweighted or over-influenced vertices")
    if report.get("unnormalisedVertices", 1):
        errors.append("Unnormalised skin weights")
    if set(report.get("bodyRegions", [])) != set(REGIONS):
        errors.append("Incomplete body occlusion region coverage")
    if set(report.get("poseResults", {})) != set(POSES):
        errors.append("Missing deterministic deformation tests")
    if any(not pose.get("pass", False) for pose in report.get("poseResults", {}).values()):
        errors.append("One or more deformation poses failed")
    if set(report.get("correctives", [])) != set(CORRECTIVES):
        errors.append("Missing authored shoulder/elbow/hip/knee correction shapes")
    return errors
