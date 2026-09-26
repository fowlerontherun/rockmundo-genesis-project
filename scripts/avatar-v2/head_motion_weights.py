"""Uncertified Avatar V2 head-turn/eye-gaze DEFORMATION EXPERIMENT.

Only the genuinely separate CC0 eyeballs have source-verified anatomical
centres. The Head and Neck pivot in this experiment is still the UNFITTED
proportional guide. These soft weights allow objective visual testing of a
basic head turn, NOT authored skinning, gameplay deformation or facial morphs.

Pure geometry so both frames' weight boundaries can be audited without bpy.
"""
from __future__ import annotations

from math import isfinite
from typing import Mapping, Sequence

Vec3 = tuple[float, float, float]


def body_weights(point: Vec3, guide_head_pivot_z: float, measured_eye_z: float) -> dict[str, float]:
    """Two deform influences max; a ~16cm head/neck transition.

    Hips is a motionless, experimental body anchor. Head and Neck are both
    actual named V2 guide bones, but none is artist-approved in this proof.
    """
    if (len(point) != 3 or not all(isfinite(x) for x in point)
            or not isfinite(guide_head_pivot_z) or not isfinite(measured_eye_z)):
        raise ValueError("Head experiment has non-finite physical sculpt coordinates.")
    if not .09 <= measured_eye_z - guide_head_pivot_z <= .35:
        raise ValueError("The measured eye and unfitted head guide have inconsistent heights.")
    start = guide_head_pivot_z - .055
    end = guide_head_pivot_z + .105
    if point[2] <= start:
        return {"Neck": 1.0} if point[2] > guide_head_pivot_z - .20 else {"Hips": 1.0}
    if point[2] >= end:
        return {"Head": 1.0}
    t = max(0.0, min(1.0, (point[2] - start) / (end - start)))
    # Smoothstep, continuous zero slope across the two transition boundaries.
    head = t * t * (3. - 2. * t)
    if head <= 1e-8:
        return {"Neck": 1.0}
    if 1. - head <= 1e-8:
        return {"Head": 1.0}
    return {"Head": head, "Neck": 1. - head}


def rigid_weights(bone: str) -> dict[str, float]:
    if bone not in ("Eye.L", "Eye.R", "Head"):
        raise ValueError("Only independently identified eyes and head detail may be rigid-bound.")
    return {bone: 1.0}


def validate_draft_weights(
    weights: Sequence[Mapping[str, float]],
    *,
    vertex_count: int,
    group_names: set[str],
    source_verified_eyes: bool,
) -> dict:
    if not source_verified_eyes:
        raise ValueError("Cannot test gaze using guessed eyeball pivots.")
    if len(weights) != vertex_count or vertex_count < 50:
        raise ValueError("Experimental skinning must cover every actual mesh vertex.")
    used: set[str] = set()
    influences_max = 0
    for i, entry in enumerate(weights):
        if not entry or len(entry) > 2:
            raise ValueError(f"Draft vertex {i} has zero or excessive bone influences.")
        if not set(entry) <= group_names:
            raise ValueError(f"Draft vertex {i} refers to a missing V2 guide bone.")
        if not all(isfinite(value) and 0 < value <= 1. for value in entry.values()):
            raise ValueError(f"Draft vertex {i} contains invalid skin weights.")
        if abs(sum(entry.values()) - 1.) > 1e-5:
            raise ValueError(f"Draft vertex {i} must use normalized influences.")
        influences_max = max(influences_max, len(entry))
        used.update(entry)
    return {
        "vertexCount": len(weights),
        "maxInfluences": influences_max,
        "usedDraftBones": sorted(used),
        "artistReviewed": False,
        "fullBodySkinned": False,
        "productionValidated": False,
    }
