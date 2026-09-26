"""Pure review gate for artist-finished Avatar V2 rigs.

These explicit flags record human review, not automated proof that an animation
or mesh is correct. Geometry, skin and GLB validation run separately.
"""
from __future__ import annotations

from typing import Mapping, Any

CLOSEUP_REVIEWS = (
    "rockmundoAvatarV2JointFitApproved",
    "rockmundoAvatarV2WeightsApproved",
    "rockmundoAvatarV2StagePoseApproved",
)
PERFORMANCE_REVIEWS = (
    "rockmundoAvatarV2SingingPoseApproved",
    "rockmundoAvatarV2GuitarPoseApproved",
    "rockmundoAvatarV2BassPoseApproved",
    "rockmundoAvatarV2DrumPoseApproved",
    "rockmundoAvatarV2MicrophonePoseApproved",
)


def audit_rig_review(properties: Mapping[str, Any], name: str, lod: int) -> list[str]:
    """Reject unfinished guides and missing explicit approvals for close-up LODs."""
    errors = []
    if properties.get("rockmundoAvatarV2RigGuide"):
        errors.append(
            f"{name} is still an authoring proportion guide; finish fitting, "
            "binding and pose QA before clearing the guide marker."
        )
    if properties.get("rockmundoAvatarV2RequiresManualFit"):
        errors.append(f"{name} still requires manual rig fitting, skin weighting and pose QA.")
    if lod <= 1:
        for key in CLOSEUP_REVIEWS:
            if properties.get(key) is not True:
                errors.append(f"{name} is missing explicit artist approval: {key}.")
        for key in PERFORMANCE_REVIEWS:
            if properties.get(key) is not True:
                errors.append(f"{name} is missing performance-pose approval: {key}.")
    return errors
