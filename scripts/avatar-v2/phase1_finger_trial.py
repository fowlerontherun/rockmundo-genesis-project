"""Quarantined first-pass skin transfer from REAL same-finger parent vertices.

ONLY an experimental UNFITTED Blender source copy may call this function.
The selected vertices must be linked by actual CC0 mesh edges to significant
SAME-DIGIT parent skin, lie close to the missing guide, carry no other finger
weights, and retain ALL significant pre-existing non-parent influences.

This deliberately cannot certify a body, produce reviewed anatomical pivots,
fix creases, sculpt correctives or supply release assets. NEVER apply it to
an already artist-painted production .blend.
"""
from __future__ import annotations

from math import isfinite
from typing import Mapping, Sequence

from phase1_body_contract import DIGITS, normalise_four, segment_distance
from phase1_finger_topology import FINGER_BONES


def propose_quarantined_finger_trial(
    positions: Sequence[Sequence[float]],
    original: Sequence[Mapping[str, float]],
    segments: Mapping[str, tuple[Sequence[float], Sequence[float]]],
    topology: Mapping[str, Mapping],
) -> tuple[dict[int, dict[str, float]], dict]:
    """Propose meaningful 4+ vertex local parent-to-child weights, not tokens.

    This is a genuine geometric/weighted trial on a SEPARATE unapproved copy;
    the caller must independently verify both original and resulting Blender
    vertex weights, articulated deformation, source provenance and no release.
    """
    if (not positions or len(positions) != len(original)
            or set(segments) != FINGER_BONES or not set(topology) <= FINGER_BONES):
        raise ValueError("Requires actual source skin, all 30 bone guides and declared missed joints")
    if any(len(p) != 3 or any(not isfinite(x) for x in p) for p in positions):
        raise ValueError("Invalid real CC0 source geometry")
    proposals: dict[int, dict[str, float]] = {}
    details = {}
    for target, trace in sorted(topology.items()):
        base, side = target.split(".")
        digit, joint = base.rstrip("123"), int(base[-1])
        parent = trace.get("upstreamSameDigitBone")
        if (trace.get("sourceTopologyOnly") is not True
                or trace.get("artistReviewed") is not False
                or trace.get("productionValidated") is not False
                or trace.get("candidatePaintApplied") is not False
                or trace.get("missingJoint") != target):
            raise ValueError(f"{target}: source topology record is not a genuine unapproved probe")
        if parent is not None and parent not in {
            f"{digit}{earlier}.{side}" for earlier in range(1, joint)
        }:
            raise ValueError(f"{target}: missing joint references wrong upstream finger or hand")
        candidate_ids = trace.get("conservativeCandidateVertices")
        if (not isinstance(candidate_ids, list)
                or any(type(i) is not int or not 0 <= i < len(positions)
                       for i in candidate_ids)
                or len(set(candidate_ids)) != len(candidate_ids)):
            raise ValueError(f"{target}: unsafe original CC0 source vertex IDs")
        accepted: dict[int, dict[str, float]] = {}
        rejected = {"original-other-finger-paint": 0,
                    "source-outside-guide": 0,
                    "no-meaningful-parent-weight": 0,
                    "cannot-preserve-four-influences": 0,
                    "source-vertex-already-assigned": 0}
        enabled = (parent is not None and trace.get("blocker") is None
                   and trace.get("sameDigitAnchorVertex") is not None
                   and trace.get("distalTopologyVertex") is not None)
        if enabled:
            for index in candidate_ids:
                if index in proposals:
                    rejected["source-vertex-already-assigned"] += 1
                    continue
                weights = original[index]
                if any(
                    value > .0001 and bone != parent and bone != target
                    and any(bone == f"{other}{j}.{other_side}"
                            for other in DIGITS for other_side in ("L", "R")
                            for j in (1, 2, 3))
                    for bone, value in weights.items()
                ):
                    # Do not steal even 0.1% of another painted finger,
                    # including other joints of the same digit.
                    rejected["original-other-finger-paint"] += 1
                    continue
                if weights.get(target, 0) > .0001 or weights.get(parent, 0) < .25:
                    rejected["no-meaningful-parent-weight"] += 1
                    continue
                distance, axis = segment_distance(
                    positions[index], *segments[target]
                )
                if distance > .018 or not -.40 <= axis <= 1.5:
                    rejected["source-outside-guide"] += 1
                    continue
                share = min(.22, weights[parent] * .30)
                candidate = dict(weights)
                candidate[parent] = weights[parent] - share
                candidate[target] = share
                result = normalise_four(candidate)
                # Do not erase any significant previously weighted vertex
                # to make a child joint's numerical count look better.
                if (result.get(target, 0) < .065
                        or result.get(parent, 0) < .10
                        or any(old > .07 and old_name not in (parent, target)
                               and (old_name not in result or
                                    abs(result[old_name] - old) > .045)
                               for old_name, old in weights.items())):
                    rejected["cannot-preserve-four-influences"] += 1
                    continue
                accepted[index] = result
        # No fake four-vertex group: if an actual local source is too thin
        # or the paint is already committed elsewhere, DO NOT apply anything.
        sufficient = len(accepted) >= 4
        if sufficient:
            proposals.update(accepted)
        details[target] = {
            "originalTopologyCandidates": len(candidate_ids),
            "acceptedActualSourceVertices": len(accepted) if sufficient else 0,
            "rejected": rejected,
            "appliedInIsolatedTrial": sufficient,
            "blocker": (trace.get("blocker") if not enabled
                        else None if sufficient
                        else "insufficient-safe-original-same-digit-parent-skin"),
            "artistReviewed": False, "productionValidated": False,
        }
    report = {
        "schema": "rockmundo.avatar-v2-unfitted-same-digit-skin-trial",
        "trialOnly": True, "artistReviewed": False, "productionValidated": False,
        "sourceUnfitted": True, "requiresHumanAnatomicalFitAndRepaint": True,
        "actualSourceVerticesTouched": len(proposals),
        "perFinger": details,
    }
    return proposals, report
