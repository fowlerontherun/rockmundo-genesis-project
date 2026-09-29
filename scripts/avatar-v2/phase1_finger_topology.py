"""Trace REAL same-digit CC0 skin across mesh edges for the missing finger joints.

Source bone heat sometimes paints the nearest skin to the WRONG finger.
Euclidean-nearest red markers alone must therefore never drive anatomical
handle placement. Walk only the actual original mesh connectivity, starting
from a nearby vertex with substantial same-digit upstream bone weight, and
REFUSE to cross an edge into skin claimed by another digit.

Pure Python. All positions, edge indices and original Blender heat weights
are observed, never modified. This produces artist reference samples, NOT
joint centres, finished weights, automatic bone fitting or skin certification.
"""
from __future__ import annotations

import heapq
from math import dist, isfinite
from typing import Mapping, Sequence

from phase1_body_contract import DIGITS, segment_distance

FINGER_BONES = {
    f"{digit}{joint}.{side}"
    for side in ("L", "R")
    for digit in DIGITS
    for joint in (1, 2, 3)
}
MAX_GEODESIC = .045
MAX_GUIDE_DISTANCE = .035
MAX_PARENT_DISTANCE = .09


def digit_owners(weights: Mapping[str, float], *, threshold: float = .08) -> set[str]:
    """Observed significant heat skin; omit unrelated torso/hand groups."""
    return {
        f"{digit}.{side}"
        for digit in DIGITS for side in ("L", "R")
        if any(weights.get(f"{digit}{joint}.{side}", 0.) > threshold
               for joint in (1, 2, 3))
    }


def trace_missing_finger_source(
    positions: Sequence[Sequence[float]],
    edges: Sequence[Sequence[int]],
    weights: Sequence[Mapping[str, float]],
    segments: Mapping[str, tuple[Sequence[float], Sequence[float]]],
) -> dict[str, dict]:
    """Source-mesh connected SAME-DIGIT seeds and reachable skin samples.

    A red wrong-finger nearest-source hint can be compared to a green
    actually heat-owned same-digit anchor. Unclaimed vertices traversed from
    the anchor remain only possible topology routes, not known digit skin.
    """
    n = len(positions)
    if n == 0 or len(weights) != n or set(segments) != FINGER_BONES:
        raise ValueError("Need all 30 real finger segments and corresponding source skin")
    if any(len(p) != 3 or not all(isfinite(v) for v in p) for p in positions):
        raise ValueError("Invalid source skin coordinates")
    if any(not isinstance(w, Mapping) or any(
        not isfinite(value) or value < 0 or value > 1.001
        for value in w.values()
    ) for w in weights):
        raise ValueError("Invalid original Blender heat paint")
    adj = [set() for _ in positions]
    for edge in edges:
        if (len(edge) != 2 or any(type(v) is not int or v < 0 or v >= n for v in edge)
                or edge[0] == edge[1]):
            raise ValueError("Malformed genuine CC0 source mesh edges")
        a, b = edge
        adj[a].add(b)
        adj[b].add(a)

    missing = sorted(
        bone for bone in FINGER_BONES
        if not any(v.get(bone, 0) > .0001 for v in weights)
    )
    outputs = {}
    for name in missing:
        base, side = name.split(".")
        digit = base.rstrip("123")
        joint = int(base[-1])
        # Prefer the immediate SAME DIGIT upstream bone; if that bone is
        # itself missing, use the nearest already heat-painted ancestor.
        parent = next(
            (f"{digit}{prior}.{side}" for prior in range(joint - 1, 0, -1)
             if any(v.get(f"{digit}{prior}.{side}", 0) >= .20 for v in weights)),
            None,
        )
        head, tail = segments[name]
        base_report = {
            "missingJoint": name, "upstreamSameDigitBone": parent,
            "sourceTopologyOnly": True, "artistReviewed": False,
            "productionValidated": False, "notAnInternalJointPivot": True,
            "nearestWrongDigitMayBeElsewhere": True,
            "candidatePaintApplied": False,
        }
        if not parent:
            outputs[name] = {
                **base_report, "blocker": "no-trustworthy-same-digit-parent-paint",
                "sameDigitAnchorVertex": None, "distalTopologyVertex": None,
                "reachableSkinVertices": 0, "otherDigitEdgesBlocked": 0,
                "conservativeCandidateVertices": [],
            }
            continue
        # The nearest already-owned parent surface gives a real topology start
        # WITHOUT trusting the nearest (potentially wrong-digit) target skin.
        # Don't accept blended parent skin already claimed by adjacent digits.
        seeds = [
            i for i, w in enumerate(weights)
            if w.get(parent, 0) >= .20 and digit_owners(w).issubset({f"{digit}.{side}"})
            and dist(positions[i], head) <= MAX_PARENT_DISTANCE
        ]
        if not seeds:
            outputs[name] = {
                **base_report, "blocker": "same-digit-parent-paint-has-no-local-source-vertex",
                "sameDigitAnchorVertex": None, "distalTopologyVertex": None,
                "reachableSkinVertices": 0, "otherDigitEdgesBlocked": 0,
                "conservativeCandidateVertices": [],
            }
            continue
        anchor = min(seeds, key=lambda i: (dist(positions[i], head), i))
        # Actual polygon EDGE lengths, not geometric jumps through an
        # adjacent finger's skin or false assumed proximity in empty space.
        shortest = {anchor: 0.}
        queue = [(0., anchor)]
        blocked = 0
        while queue:
            cost, current = heapq.heappop(queue)
            if cost > shortest[current] + 1e-9:
                continue
            if cost >= MAX_GEODESIC:
                continue
            for neighbor in sorted(adj[current]):
                observed_owners = digit_owners(weights[neighbor])
                if not observed_owners.issubset({f"{digit}.{side}"}):
                    blocked += 1
                    continue
                step = dist(positions[current], positions[neighbor])
                if not 1e-7 < step <= .018:
                    continue
                distance = cost + step
                if (distance > MAX_GEODESIC
                        or dist(positions[neighbor], head) > MAX_PARENT_DISTANCE):
                    continue
                if distance + 1e-9 < shortest.get(neighbor, float("inf")):
                    shortest[neighbor] = distance
                    heapq.heappush(queue, (distance, neighbor))
        # A near-target topology point can be *unclaimed* skin. It is an
        # inspectable surface route only; NEVER auto paint it as this digit.
        nearby = []
        safe = []
        for i, cost in shortest.items():
            separation, along = segment_distance(positions[i], head, tail)
            if separation <= MAX_GUIDE_DISTANCE and -.40 <= along <= 1.5:
                nearby.append((i, cost, separation, along))
                if (weights[i].get(parent, 0) >= .25
                        and digit_owners(weights[i]).issubset({f"{digit}.{side}"})
                        and separation <= .018):
                    safe.append(i)
        # Prefer the most distal observed nearby topology sample; still a
        # surface point, NEVER a fitted pivot or production accepted weight.
        distal = min(
            nearby, key=lambda row: (-row[3], row[2], row[1], row[0])
        ) if nearby else None
        outputs[name] = {
            **base_report,
            "blocker": None if distal else "cannot-trace-local-distal-source-without-crossing-digit",
            "sameDigitAnchorVertex": anchor,
            "sameDigitAnchorWorld": [round(x, 6) for x in positions[anchor]],
            "sameDigitAnchorParentWeight": round(weights[anchor][parent], 5),
            "anchorToMissingGuideHeadMm": round(dist(positions[anchor], head) * 1000, 3),
            "distalTopologyVertex": distal[0] if distal else None,
            "distalTopologyWorld": [round(x, 6) for x in positions[distal[0]]]
                if distal else None,
            "distalFromAnchorGeodesicMm": round(distal[1] * 1000, 3)
                if distal else None,
            "distalGuideSurfaceMm": round(distal[2] * 1000, 3)
                if distal else None,
            "reachableSkinVertices": len(shortest),
            "nearTargetTopologyVertices": len(nearby),
            "otherDigitEdgesBlocked": blocked,
            "conservativeCandidateVertices": sorted(safe),
            "candidatePaintApplied": False,
            "requiresActualDigitTopologyReview": True,
        }
    return outputs
