"""Deterministic unit tests for fitting real Avatar V2 joint markers."""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from rig_landmarks import (  # noqa: E402
    BoneSpec, FitBone, audit_sculpt_fit, fit_bones, marker_name, moved_markers,
    position_markers,
)


def example_rig():
    bones = [
        BoneSpec("Hips", None, False, (0, 0, .89), (0, 0, 1.04)),
        BoneSpec("Spine1", "Hips", True, (0, 0, 1.04), (0, 0, 1.2)),
        BoneSpec("Spine2", "Spine1", True, (0, 0, 1.2), (0, 0, 1.4)),
        BoneSpec("Neck", "Spine2", True, (0, 0, 1.4), (0, 0, 1.47)),
        BoneSpec("Head", "Neck", True, (0, 0, 1.47), (0, -.01, 1.72)),
        BoneSpec("Jaw", "Head", False, (0, -.03, 1.53), (0, -.09, 1.51)),
    ]
    for side, sign in (("L", 1), ("R", -1)):
        bones.extend([
            BoneSpec(f"Eye.{side}", "Head", False, (sign * .04, -.07, 1.59),
                     (sign * .04, -.10, 1.59)),
            BoneSpec(f"EarAnchor.{side}", "Head", False,
                     (sign * .095, -.01, 1.55), (sign * .095, -.01, 1.57)),
            BoneSpec(f"Shoulder.{side}", "Spine2", False,
                     (sign * .045, 0, 1.38), (sign * .17, 0, 1.36)),
            BoneSpec(f"UpperArm.{side}", f"Shoulder.{side}", True,
                     (sign * .17, 0, 1.36), (sign * .42, 0, 1.3)),
            BoneSpec(f"UpperArmTwist.{side}", f"UpperArm.{side}", False,
                     (sign * .27, 0, 1.338), (sign * .35, 0, 1.318)),
            BoneSpec(f"LowerArm.{side}", f"UpperArm.{side}", True,
                     (sign * .42, 0, 1.3), (sign * .65, 0, 1.26)),
            BoneSpec(f"Hand.{side}", f"LowerArm.{side}", True,
                     (sign * .65, 0, 1.26), (sign * .73, 0, 1.25)),
            BoneSpec(f"Index1.{side}", f"Hand.{side}", False,
                     (sign * .73, -.02, 1.25), (sign * .765, -.02, 1.25)),
            BoneSpec(f"Index2.{side}", f"Index1.{side}", True,
                     (sign * .765, -.02, 1.25), (sign * .788, -.02, 1.25)),
            BoneSpec(f"Index3.{side}", f"Index2.{side}", True,
                     (sign * .788, -.02, 1.25), (sign * .805, -.02, 1.25)),
            BoneSpec(f"UpperLeg.{side}", "Hips", False,
                     (sign * .10, 0, .92), (sign * .11, 0, .5)),
            BoneSpec(f"ThighTwist.{side}", f"UpperLeg.{side}", False,
                     (sign * .104, 0, .76), (sign * .107, 0, .62)),
            BoneSpec(f"LowerLeg.{side}", f"UpperLeg.{side}", True,
                     (sign * .11, 0, .5), (sign * .12, 0, .12)),
            BoneSpec(f"Foot.{side}", f"LowerLeg.{side}", True,
                     (sign * .12, 0, .12), (sign * .12, -.11, .05)),
            BoneSpec(f"Toe.{side}", f"Foot.{side}", True,
                     (sign * .12, -.11, .05), (sign * .12, -.22, .04)),
        ])
    return bones


class SculptJointFitTests(unittest.TestCase):
    def test_marker_map_reuses_parent_tails_for_connected_chains(self):
        markers = position_markers(example_rig())
        self.assertIn(marker_name("Shoulder.L", "head"), markers)
        self.assertIn(marker_name("Shoulder.L", "tail"), markers)
        self.assertNotIn(marker_name("UpperArm.L", "head"), markers)
        self.assertNotIn(marker_name("UpperArmTwist.L", "head"), markers)
        self.assertNotIn(marker_name("UpperArmTwist.L", "tail"), markers)
        self.assertIn(marker_name("Index1.R", "head"), markers)
        self.assertNotIn(marker_name("Index2.R", "head"), markers)
        self.assertIn(marker_name("Index3.R", "tail"), markers)
        self.assertIn(marker_name("Eye.L", "head"), markers)
        self.assertNotIn(marker_name("Eye.L", "tail"), markers)
        self.assertNotIn(marker_name("EarAnchor.R", "tail"), markers)

    def test_intact_reviewed_joint_layout_has_no_swapped_or_collapsed_joints(self):
        bones = example_rig()
        fitted = fit_bones(bones, position_markers(bones))
        self.assertEqual(audit_sculpt_fit(fitted), [])
        self.assertEqual(len(fitted), len(bones))

    def test_shoulder_and_knuckle_marker_repositions_complete_connected_chains(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("Shoulder.L", "tail")] = (.18, 0, 1.37)
        markers[marker_name("UpperArm.L", "tail")] = (.43, 0, 1.31)
        markers[marker_name("Index1.L", "tail")] = (.772, -.02, 1.245)
        markers[marker_name("Index2.L", "tail")] = (.799, -.02, 1.241)
        markers[marker_name("Index3.L", "tail")] = (.822, -.02, 1.238)
        fitted = fit_bones(bones, markers)
        self.assertEqual(fitted["UpperArm.L"].head, fitted["Shoulder.L"].tail)
        self.assertEqual(fitted["LowerArm.L"].head, fitted["UpperArm.L"].tail)
        self.assertEqual(fitted["Index2.L"].head, fitted["Index1.L"].tail)
        self.assertEqual(fitted["Index3.L"].head, fitted["Index2.L"].tail)
        twist = fitted["UpperArmTwist.L"]
        upper = fitted["UpperArm.L"]
        self.assertAlmostEqual(twist.head[0], upper.head[0] * .62 + upper.tail[0] * .38)
        self.assertAlmostEqual(twist.tail[0], upper.head[0] * .28 + upper.tail[0] * .72)
        self.assertEqual(audit_sculpt_fit(fitted), [])

    def test_eye_and_ear_rigid_handle_moves_keep_original_facing_vectors(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("Eye.L", "head")] = (.052, -.079, 1.598)
        markers[marker_name("EarAnchor.L", "head")] = (.106, -.02, 1.551)
        fitted = fit_bones(bones, markers)
        self.assertAlmostEqual(fitted["Eye.L"].tail[0], .052)
        self.assertAlmostEqual(fitted["Eye.L"].tail[1], -.109)
        self.assertAlmostEqual(fitted["Eye.L"].tail[2], 1.598)
        self.assertAlmostEqual(fitted["EarAnchor.L"].tail[2], 1.571, places=6)

    def test_missing_hand_tip_does_not_silently_use_proportional_guide(self):
        bones = example_rig()
        markers = position_markers(bones)
        del markers[marker_name("Index3.R", "tail")]
        with self.assertRaisesRegex(ValueError, "Index3.R"):
            fit_bones(bones, markers)

    def test_missing_parent_and_duplicate_bones_are_rejected(self):
        bones = example_rig()
        invalid = [BoneSpec("Bad", "Missing", True, (0, 0, 0), (0, .1, 0))]
        with self.assertRaisesRegex(ValueError, "Missing parent bone"):
            fit_bones(invalid, position_markers(invalid))
        with self.assertRaisesRegex(ValueError, "Duplicate bone"):
            fit_bones(bones + [bones[0]], position_markers(bones))

    def test_fully_collapsed_bone_never_mutates_the_actual_rig(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("LowerArm.R", "tail")] = markers[marker_name("UpperArm.R", "tail")]
        with self.assertRaisesRegex(ValueError, "LowerArm.R fitted length"):
            fit_bones(bones, markers)

    def test_swapped_eyes_and_misplaced_ear_lobes_fail_artist_review(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("Eye.L", "head")] = (-.03, -.08, 1.59)
        markers[marker_name("EarAnchor.R", "head")] = (-.015, -.01, 1.55)
        issues = audit_sculpt_fit(fit_bones(bones, markers))
        self.assertTrue(any("Eye.L" in issue for issue in issues))
        self.assertTrue(any("EarAnchor.R" in issue for issue in issues))

    def test_stage_pose_joint_continuity_detects_disconnected_wrist_and_finger(self):
        bones = example_rig()
        fitted = fit_bones(bones, position_markers(bones))
        hand = fitted["Hand.L"]
        finger = fitted["Index2.R"]
        fitted["Hand.L"] = FitBone((hand.head[0] + .012, *hand.head[1:]), hand.tail)
        fitted["Index2.R"] = FitBone((finger.head[0] - .009, *finger.head[1:]), finger.tail)
        issues = audit_sculpt_fit(fitted)
        self.assertTrue(any("Hand.L is disconnected" in issue for issue in issues))
        self.assertTrue(any("Index2.R is disconnected" in issue for issue in issues))

    def test_eye_socket_spacing_mismatch_fails_review(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("Eye.L", "head")] = (.085, -.07, 1.59)
        issues = audit_sculpt_fit(fit_bones(bones, markers))
        self.assertTrue(any("distance from the midline" in issue for issue in issues))

    def test_misaligned_eye_and_ear_heights_and_offcentre_jaw_fail_review(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("Eye.L", "head")] = (.04, -.07, 1.64)
        markers[marker_name("EarAnchor.R", "head")] = (-.095, -.01, 1.61)
        markers[marker_name("Jaw", "head")] = (.045, -.03, 1.53)
        issues = audit_sculpt_fit(fit_bones(bones, markers))
        self.assertTrue(any("Eye left/right" in issue for issue in issues))
        self.assertTrue(any("EarAnchor left/right" in issue for issue in issues))
        self.assertTrue(any("Jaw hinge" in issue for issue in issues))

    def test_artist_modified_guide_threshold_ignores_submillimetre_noise(self):
        base = position_markers(example_rig())
        moved = dict(base)
        name = marker_name("Shoulder.L", "tail")
        old = base[name]
        moved[name] = (old[0] + .0008, old[1], old[2])
        self.assertEqual(moved_markers(moved, base), [])
        moved[name] = (old[0] + .009, old[1], old[2])
        self.assertEqual(moved_markers(moved, base), [name])

    def test_limb_direction_and_ear_center_checks_flag_broken_art(self):
        bones = example_rig()
        markers = position_markers(bones)
        markers[marker_name("UpperLeg.L", "tail")] = (.11, 0, 1.01)
        markers[marker_name("Hand.R", "tail")] = (-.60, 0, 1.25)
        issues = audit_sculpt_fit(fit_bones(bones, markers))
        self.assertTrue(any("L leg" in issue for issue in issues))
        self.assertTrue(any("R arm" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
