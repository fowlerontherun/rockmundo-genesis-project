"""Regression tests for independent masculine and feminine body candidate gates."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_body_contract import (  # noqa: E402
    ATTACHMENT_BONES, CORRECTIVES, DEFORM_BONES, POSES,
    REGIONS, normalise_four, region_from_weights, report_errors,
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
            "missingDeformBones": [],
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
