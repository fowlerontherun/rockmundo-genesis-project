"""Shared, Blender-independent rules for Phase 1 Avatar V2 body certification.

Candidate preparation is NOT artist approval. The same weight and pose contract
applies independently to the real CC0 masculine and feminine fitted bodies.
"""
from __future__ import annotations

from math import dist, isfinite, radians
from typing import Mapping, Sequence

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



def segment_distance(point: Sequence[float], head: Sequence[float],
                     tail: Sequence[float]) -> tuple[float, float]:
    """True point-to-fitted-bone-segment distance in Blender world metres."""
    if (any(len(v) != 3 or not all(isfinite(x) for x in v)
            for v in (point, head, tail))):
        raise ValueError("Invalid non-finite or non-3D finger-fitting geometry")
    direction = [end - start for start, end in zip(head, tail)]
    span2 = sum(x * x for x in direction)
    if span2 < 1e-8:
        raise ValueError("A fitted finger joint has no usable length")
    t = sum((p - h) * d for p, h, d in zip(point, head, direction)) / span2
    nearest = [h + min(1., max(0., t)) * d for h, d in zip(head, direction)]
    return dist(point, nearest), t


def audit_missing_finger_geometry(
    positions: Sequence[Sequence[float]],
    existing: Sequence[Mapping[str, float]],
    segments: Mapping[str, tuple[Sequence[float], Sequence[float]]],
    *,
    radius_m: float = .009,
) -> dict[str, dict]:
    """For each truly missing finger bone, inspect ALL real source vertices.

    Do not repeat the old misleading measurement that omitted vertices already
    claimed by another bone-heat finger group. That made physically close
    finger segments incorrectly appear 55–70mm away from the CC0 source.
    No proposed or artist skin weights are modified by this diagnostic.
    """
    if len(positions) != len(existing) or not .004 <= radius_m <= .016:
        raise ValueError("Invalid source body sample or local finger radius")
    required = {f"{digit}{joint}.{side}" for side in ("L", "R")
                for digit in DIGITS for joint in (1, 2, 3)}
    if set(segments) != required:
        raise ValueError("Require complete 30-joint actual finger geometry")
    missing = sorted(name for name in required
                     if not any(w.get(name, 0) > .0001 for w in existing))
    results = {}
    for name in missing:
        side = name.rsplit(".", 1)[1]
        head, tail = segments[name]
        length = dist(head, tail)
        if length < 1e-4:
            raise ValueError(f"Degenerate fitted finger {name}")
        radius = min(radius_m, max(.004, length * .44))
        closest = float("inf")
        near = eligible = hand_near = claimed_other = 0
        competing: dict[str, int] = {}
        for point, weights in zip(positions, existing):
            distance, along = segment_distance(point, head, tail)
            closest = min(closest, distance)
            if distance > radius or not -.10 <= along <= 1.1:
                continue
            near += 1
            if weights.get(f"Hand.{side}", 0) > .05:
                hand_near += 1
            actual_owners = [finger for finger in sorted(required)
                             if weights.get(finger, 0) > .0001]
            if actual_owners:
                claimed_other += 1
                for owner in actual_owners:
                    competing[owner] = competing.get(owner, 0) + 1
            elif weights.get(f"Hand.{side}", 0) > .05:
                eligible += 1
        # JSON cannot encode Infinity portably. No source vertices is a hard
        # input error; every real CC0 has a complete continuous body mesh.
        if not positions:
            raise ValueError("No actual source skin vertices for finger audit")
        if near == 0 and closest > .035:
            problem = "guide-floats-far-from-source-skin"
        elif claimed_other:
            problem = "nearby-vertices-claimed-by-other-fingers"
        elif hand_near == 0:
            problem = "no-nearby-existing-same-side-hand-weight"
        elif eligible:
            problem = "bone-heat-missed-eligible-local-palm-vertices"
        else:
            problem = "requires-artist-detailed-finger-fitting"
        results[name] = {
            "nearestActualSourceMm": round(closest * 1000, 3),
            "geometricRadiusMm": round(radius * 1000, 3),
            "nearbyActualSourceVertices": near,
            "nearbyExistingHandVertices": hand_near,
            "nearbyUnclaimedHandVertices": eligible,
            "nearbyOtherFingerClaimedVertices": claimed_other,
            "competingFingerGroups": competing,
            "blocker": problem,
            "reviewedAnatomicalFit": False,
            "automaticProductionApproval": False,
        }
    return results


def propose_missing_finger_weights(
    positions: Sequence[Sequence[float]],
    existing: Sequence[Mapping[str, float]],
    segments: Mapping[str, tuple[Sequence[float], Sequence[float]]],
    *,
    radius_m: float = .009,
) -> tuple[dict[int, dict[str, float]], dict]:
    """Non-authoritative finger *starting paint*, only from reviewed fitted bones.

    For each vertex with existing trustworthy hand skin, find its nearest actual
    fitted finger segment (not a world-space A-pose axis assumption). Do not
    invent hand weights; never replace any pre-existing artist finger weights.
    Never mark the seed approved; a real person must clean hand and grip poses.
    """
    if len(positions) != len(existing) or not .004 <= radius_m <= .016:
        raise ValueError("Unexpected body positions/weights or finger-paint radius")
    required = {f"{digit}{joint}.{side}" for side in ("L", "R")
                for digit in DIGITS for joint in (1, 2, 3)}
    if set(segments) != required:
        raise ValueError("Only complete bilateral fitted 30-joint finger geometry is accepted")
    total = {name: 0 for name in required}
    for weights in existing:
        for name in required:
            if weights.get(name, 0) > .0001:
                total[name] += 1
    missing = required - {name for name, count in total.items() if count}
    # A locally seeded vertex may NEVER skip a higher-quality artist-painted
    # finger group. Existing skin is copied and only one proposed new group
    # can be painted on any existing Hand-weighted point.
    proposals = {}
    near_but_no_hand = {side: 0 for side in ("L", "R")}
    proximity = {name: {"nearestUnclaimedSourceMm": float("inf"),
                        "bodyVerticesNearSegment": 0,
                        "existingHandVerticesNearSegment": 0}
                 for name in missing}
    for i, (point, original) in enumerate(zip(positions, existing)):
        if any(original.get(name, 0) > .0001 for name in required):
            continue
        best = None
        for side in ("L", "R"):
            palm = original.get(f"Hand.{side}", 0)
            for name in sorted(name for name in missing if name.endswith(f".{side}")):
                head, tail = segments[name]
                length = dist(head, tail)
                radius = min(radius_m, max(.004, length * .44))
                separation, along = segment_distance(point, head, tail)
                evidence = proximity[name]
                evidence["nearestUnclaimedSourceMm"] = min(
                    evidence["nearestUnclaimedSourceMm"], round(separation * 1000, 3))
                # Reject points beyond real end planes (e.g. palms, adjacent
                # fingers or an accidentally misplaced guide endpoint).
                if separation > radius or not -.10 <= along <= 1.1:
                    continue
                evidence["bodyVerticesNearSegment"] += 1
                if palm > .05:
                    evidence["existingHandVerticesNearSegment"] += 1
                if palm <= .05:
                    near_but_no_hand[side] += 1
                    continue
                candidate = (separation / radius, name, palm)
                if best is None or candidate[:2] < best[:2]:
                    best = candidate
        if best is None:
            continue
        proportion, chosen, parent_weight = best
        share = parent_weight * (.34 + .46 * (1. - proportion))
        if share <= .01:
            continue
        candidate_weights = dict(original)
        parent = f"Hand.{chosen.rsplit('.', 1)[1]}"
        candidate_weights[parent] = max(0., candidate_weights[parent] - share)
        candidate_weights[chosen] = share
        proposals[i] = normalise_four(candidate_weights)
        total[chosen] += 1
    for evidence in proximity.values():
        if evidence["nearestUnclaimedSourceMm"] == float("inf"):
            evidence["nearestUnclaimedSourceMm"] = None
    report = {
        "candidateOnly": True,
        "basedOnReviewedFittedBoneGeometry": True,
        "automaticApproval": False,
        "untouchedArtistFingerGroups": sorted(required - missing),
        "proposedVertices": len(proposals),
        "proposedPerFinger": {name: total[name] for name in sorted(required)},
        "stillMissing": sorted(name for name in required if total[name] < 4),
        "nearFittedFingersButMissingHandWeights": near_but_no_hand,
        "unpaintedJointGeometry": {name: proximity[name] for name in sorted(missing)},
        "missingJointSourceEvidence": audit_missing_finger_geometry(
            positions, existing, segments, radius_m=radius_m
        ),
        "requiresArtistRepaintAndGripReview": True,
    }
    return proposals, report


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
