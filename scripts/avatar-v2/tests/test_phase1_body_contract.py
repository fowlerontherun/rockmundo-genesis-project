"""Regression tests for independent masculine and feminine body candidate gates."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_body_contract import (  # noqa: E402
    ATTACHMENT_BONES, CORRECTIVES, CORRECTIVE_DRIVERS, DEFORM_BONES, POSES,
    REGIONS, normalise_four, pose_corrective_weights, propose_missing_finger_weights,
    region_from_weights, report_errors,
)


class Phase1BodyContractTests(unittest.TestCase):
    def test_required_articulation_and_bilateral_finger_chains(self):
        for side in ("L", "R"):
            for digit in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
                for joint in (1, 2, 3):
                    self.assertIn(f"{digit}{joint}.{side}", DEFORM_BONES)
            for name in ("UpperArmTwist", "ForearmTwist", "ThighTwist", "Toe"):
                self.assertIn(f"{name}.{side}", DEFORM_BONES)
            self.assertIn(f"Eye.{side}", ATTACHMENT_BONES)
            self.assertIn(f"EarAnchor.{side}", ATTACHMENT_BONES)
        self.assertEqual(len(DEFORM_BONES), len(set(DEFORM_BONES)))

    def test_pose_drivers_match_live_typescript_contract(self):
        runtime = (pathlib.Path(__file__).resolve().parents[3]
                   / "src/features/player-model/v2/avatarV2PoseCorrectives.ts").read_text()
        for corrective, (bone, start, full) in CORRECTIVE_DRIVERS.items():
            with self.subTest(corrective=corrective):
                expected = (
                    f"{corrective}: {{ bone: '{bone}', "
                    f"start: {format(start, '.2f').lstrip('0')}, full: {full:.2f} }},"
                )
                self.assertIn(expected, runtime)

    def test_correctives_follow_actual_pose_and_reset(self):
        reach = pose_corrective_weights(POSES["reach"])
        self.assertGreater(reach["poseShoulderLeft"], .99)
        self.assertGreater(reach["poseShoulderRight"], .99)
        self.assertEqual(reach["poseElbowLeft"], 0)
        crouch = pose_corrective_weights(POSES["crouch"])
        for name in ("poseHipLeft", "poseHipRight", "poseKneeLeft", "poseKneeRight"):
            self.assertGreater(crouch[name], .99)
        inactive = pose_corrective_weights(POSES["instrument-grip"])
        self.assertEqual(set(inactive), set(CORRECTIVES))
        self.assertTrue(all(value == 0 for value in inactive.values()))
        self.assertTrue(all(value == 0 for value in pose_corrective_weights({}).values()))
        with self.assertRaises(ValueError):
            pose_corrective_weights({"UpperArm.L": (0, 1, 0, float("nan"))})

    def test_real_fitted_finger_candidate_seeds_all_thirty_distinct_joints(self):
        segments = {}
        positions, original = [], []
        for side, x in (("L", .36), ("R", -.36)):
            for digit_index, digit in enumerate(
                    ("Thumb", "Index", "Middle", "Ring", "Pinky")):
                for joint in (1, 2, 3):
                    name = f"{digit}{joint}.{side}"
                    head = (x, digit_index * .028, joint * .032)
                    tail = (x, digit_index * .028, joint * .032 + .020)
                    segments[name] = (head, tail)
                    for delta in (-.002, -.001, .001, .002):
                        positions.append((x + delta, head[1], head[2] + .010))
                        original.append({f"Hand.{side}": 1.0})
        proposals, report = propose_missing_finger_weights(
            positions, original, segments, radius_m=.009)
        self.assertEqual(len(proposals), 120)
        self.assertEqual(len(report["proposedPerFinger"]), 30)
        self.assertEqual(report["stillMissing"], [])
        self.assertTrue(all(c == 4 for c in report["proposedPerFinger"].values()))
        self.assertFalse(report["automaticApproval"])
        self.assertTrue(report["requiresArtistRepaintAndGripReview"])
        for index, weights in proposals.items():
            self.assertEqual(len(weights), 2)
            self.assertAlmostEqual(sum(weights.values()), 1.)
            self.assertIn(next(iter(original[index])), weights)

    def test_proposals_never_invent_hand_skin_or_replace_existing_fingers(self):
        segments = {}
        for side, x in (("L", .36), ("R", -.36)):
            for digit_index, digit in enumerate(
                    ("Thumb", "Index", "Middle", "Ring", "Pinky")):
                for joint in (1, 2, 3):
                    segments[f"{digit}{joint}.{side}"] = (
                        (x, digit_index * .03, joint * .03),
                        (x, digit_index * .03, joint * .03 + .02))
        test_vertex = (.36, 0, .04)
        no_hand, report = propose_missing_finger_weights(
            [test_vertex], [{"LowerArm.L": 1.}], segments)
        self.assertEqual(no_hand, {})
        self.assertGreater(report["nearFittedFingersButMissingHandWeights"]["L"], 0)
        painted, report = propose_missing_finger_weights(
            [test_vertex],
            [{"Hand.L": .20, "Thumb1.L": .80}], segments)
        self.assertEqual(painted, {})
        self.assertIn("Thumb1.L", report["untouchedArtistFingerGroups"])
        with self.assertRaisesRegex(ValueError, "complete bilateral"):
            propose_missing_finger_weights(
                [test_vertex], [{"Hand.L": 1.}], {"Thumb1.L": segments["Thumb1.L"]})

    def test_weight_cleanup_is_bounded_and_deterministic(self):
        raw = {"Hips": .4, "Spine1": .3, "Spine2": .2,
               "UpperLeg.L": .1, "ThighTwist.L": .05}
        result = normalise_four(raw)
        self.assertEqual(4, len(result))
        self.assertNotIn("ThighTwist.L", result)
        self.assertAlmostEqual(sum(result.values()), 1)
        self.assertEqual(result, normalise_four(dict(reversed(list(raw.items())))))

    def test_refuses_fake_zero_nan_negative_weights(self):
        for invalid in ({}, {"Hips": 0}, {"Hips": float("nan")},
                        {"Hips": float("inf")}, {"Hips": -.1}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                normalise_four(invalid)

    def test_region_mapping_uses_bone_weights(self):
        self.assertEqual("lower-arms", region_from_weights([
            {"ForearmTwist.L": .4, "LowerArm.L": .6},
            {"LowerArm.L": 1},
            {"UpperArm.L": .1, "LowerArm.L": .9},
        ]))
        self.assertEqual("feet", region_from_weights([{"Toe.R": 1}]))

    def complete_report(self, frame):
        return {
            "frame": frame, "jointFit": {"reviewed": True},
            "missingDeformBones": [], "insufficientDeformBones": {},
            "nonBodyBoneInfluences": [], "invalidWeights": 0,
            "unweightedVertices": 0, "overInfluencedVertices": 0,
            "unnormalisedVertices": 0, "bodyRegions": list(REGIONS),
            "poseResults": {name: {"pass": True} for name in POSES},
            "correctives": list(CORRECTIVES),
        }

    def test_both_frames_require_all_evidence(self):
        for frame in ("masculine", "feminine"):
            with self.subTest(frame=frame):
                data = self.complete_report(frame)
                self.assertEqual([], report_errors(data))
                for key, value in (
                    ("jointFit", {"reviewed": False}),
                    ("unweightedVertices", 1),
                    ("overInfluencedVertices", 1),
                    ("unnormalisedVertices", 1),
                    ("missingDeformBones", ["Hand.R"]),
                    ("insufficientDeformBones", {"Index3.L": {"weighted": 1, "minimum": 4}}),
                    ("nonBodyBoneInfluences", ["Eye.L"]),
                    ("invalidWeights", 1),
                    ("bodyRegions", list(REGIONS[:-1])),
                    ("poseResults", {}),
                    ("correctives", []),
                ):
                    failed = {**data, key: value}
                    self.assertTrue(report_errors(failed), key)

    def test_no_single_good_pose_can_mask_failed_extremes(self):
        data = self.complete_report("feminine")
        data["poseResults"]["crouch"]["pass"] = False
        self.assertIn("One or more deformation poses failed", report_errors(data))
        self.assertGreaterEqual(len(POSES), 8)


if __name__ == "__main__":
    unittest.main()
