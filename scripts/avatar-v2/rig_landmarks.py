"""Blender-independent Avatar V2 skeleton landmark fitting.

All coordinates are Blender armature-local metres (Z-up, -Y-forward, +X-left).
This module does not skin a mesh, sculpt a character, or certify art quality.
Artists position named scene handles over real joints; the Blender adapter
transfers those coordinates to the existing production-named armature.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import dist, isfinite
from typing import Mapping, Sequence

Vec3 = tuple[float, float, float]
MIN_BONE_METRES = .003
MIN_LANDMARK_EDIT_METRES = .002


@dataclass(frozen=True)
class BoneSpec:
    name: str
    parent: str | None
    connected: bool
    head: Vec3
    tail: Vec3


@dataclass(frozen=True)
class FitBone:
    head: Vec3
    tail: Vec3


def marker_name(bone_name: str, endpoint: str) -> str:
    if endpoint not in ("head", "tail"):
        raise ValueError(f"Unsupported landmark endpoint {endpoint}")
    return f"RMV2_FIT__{bone_name}__{endpoint}"


def is_twist(name: str) -> bool:
    return name.startswith(("UpperArmTwist.", "ForearmTwist.", "ThighTwist."))


def position_markers(bones: Sequence[BoneSpec]) -> dict[str, Vec3]:
    """One editable tail per bone; connected heads share the parent's tail."""
    markers: dict[str, Vec3] = {}
    for bone in bones:
        if is_twist(bone.name):
            continue
        if not bone.connected or not bone.parent:
            markers[marker_name(bone.name, "head")] = bone.head
        # Eyes and earring anchors move as whole rigid guide bones. Moving
        # their HEAD is sufficient and preserves the authored gaze/tip vector.
        if not bone.name.startswith(("Eye.", "EarAnchor.")):
            markers[marker_name(bone.name, "tail")] = bone.tail
    return markers


def moved_markers(
    placed: Mapping[str, Vec3],
    reference: Mapping[str, Vec3],
    tolerance: float = MIN_LANDMARK_EDIT_METRES,
) -> list[str]:
    return [
        name for name, point in placed.items()
        if name in reference and dist(point, reference[name]) > tolerance
    ]


def fit_bones(
    bones: Sequence[BoneSpec],
    markers: Mapping[str, Vec3],
) -> dict[str, FitBone]:
    """Build a complete proposed fit before touching a single Blender bone."""
    specs = {bone.name: bone for bone in bones}
    if len(specs) != len(bones):
        raise ValueError("Duplicate bone names in the authoring rig.")
    required = position_markers(bones)
    missing = sorted(set(required) - set(markers))
    if missing:
        raise ValueError("Missing sculpt placement handles: " + ", ".join(missing))

    fitted: dict[str, FitBone] = {}
    visiting: set[str] = set()

    def solve(name: str) -> FitBone:
        if name in fitted:
            return fitted[name]
        if name in visiting:
            raise ValueError("Cycle in parent rig chain at " + name)
        if name not in specs:
            raise ValueError("Missing parent bone " + name)
        visiting.add(name)
        bone = specs[name]
        parent_fit = solve(bone.parent) if bone.parent else None
        if bone.connected and parent_fit:
            head = parent_fit.tail
        elif is_twist(name) and parent_fit:
            head = tuple(parent_fit.head[i] * .62 + parent_fit.tail[i] * .38 for i in range(3))
        else:
            head = markers[marker_name(name, "head")]

        if is_twist(name) and parent_fit:
            tail = tuple(parent_fit.head[i] * .28 + parent_fit.tail[i] * .72 for i in range(3))
        elif name.startswith(("Eye.", "EarAnchor.")):
            tail = tuple(head[i] + bone.tail[i] - bone.head[i] for i in range(3))
        else:
            tail = markers[marker_name(name, "tail")]

        if not all(isfinite(v) for v in (*head, *tail)):
            raise ValueError(f"{name} has a non-finite sculpt marker.")
        if dist(head, tail) < MIN_BONE_METRES:
            raise ValueError(f"{name} fitted length is shorter than {MIN_BONE_METRES * 1000:.0f}mm minimum.")
        fit = FitBone(head, tail)
        fitted[name] = fit
        visiting.remove(name)
        return fit

    for bone in bones:
        solve(bone.name)
    return fitted


def audit_sculpt_fit(fitted: Mapping[str, FitBone]) -> list[str]:
    """Reject obvious swapped sides and misplaced joints before changing rig."""
    errors: list[str] = []
    hips = fitted.get("Hips")
    if not hips:
        return ["The fitted rig needs a Hips bone."]
    midline = hips.head[0]
    for name, bone in fitted.items():
        if name.endswith((".L", ".R")):
            sign = 1 if name.endswith(".L") else -1
            if sign * (bone.head[0] - midline) < .005:
                errors.append(f"{name} is on the wrong side of the body's midline (+X is L).")

    head = fitted.get("Head")
    if head and head.head[2] < hips.tail[2]:
        errors.append("Head must remain above the chest and hips.")
    for side in ("L", "R"):
        arm = fitted.get(f"UpperArm.{side}")
        forearm = fitted.get(f"LowerArm.{side}")
        hand = fitted.get(f"Hand.{side}")
        if arm and forearm and hand:
            sign = 1 if side == "L" else -1
            if not (sign * (arm.tail[0] - arm.head[0]) > .015
                    and sign * (forearm.tail[0] - forearm.head[0]) > .015
                    and sign * (hand.tail[0] - hand.head[0]) > .005):
                errors.append(f"{side} arm / hand landmarks must extend outward from the shoulders.")
        thigh = fitted.get(f"UpperLeg.{side}")
        calf = fitted.get(f"LowerLeg.{side}")
        if thigh and calf:
            if thigh.tail[2] >= thigh.head[2] - .05 or calf.tail[2] >= calf.head[2] - .05:
                errors.append(f"{side} leg landmarks must descend from hip to ankle.")
        eye = fitted.get(f"Eye.{side}")
        ear = fitted.get(f"EarAnchor.{side}")
        if eye and ear and abs(ear.head[0] - midline) <= abs(eye.head[0] - midline):
            errors.append(f"EarAnchor.{side} must sit farther out than Eye.{side}.")
    return errors
