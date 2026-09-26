"""Deterministic preliminary head-only skinning gates (no Blender dependency)."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from head_motion_weights import body_weights, rigid_weights, validate_draft_weights


class ExperimentalHeadSkinningTests(unittest.TestCase):
    PIVOT = 1.49
    EYE = 1.64

    def test_head_and_lower_body_are_separate_and_transition_smoothly(self):
        self.assertEqual(body_weights((.03, -.03, 1.72), self.PIVOT, self.EYE), {"Head": 1.0})
        self.assertEqual(body_weights((.03, -.03, 1.0), self.PIVOT, self.EYE), {"Hips": 1.0})
        self.assertEqual(body_weights((.03, -.03, 1.35), self.PIVOT, self.EYE), {"Neck": 1.0})
        at_pivot = body_weights((0, 0, self.PIVOT), self.PIVOT, self.EYE)
        self.assertEqual(set(at_pivot), {"Head", "Neck"})
        self.assertAlmostEqual(sum(at_pivot.values()), 1.)
        values = [
            body_weights((0, 0, z / 1000), self.PIVOT, self.EYE).get("Head", 0.0)
            for z in range(1400, 1650)
        ]
        self.assertTrue(all(a <= b for a, b in zip(values, values[1:])))
        self.assertEqual(max(values), 1.)

    def test_independent_eyes_are_rigid_and_not_mirrored(self):
        self.assertEqual(rigid_weights("Eye.L"), {"Eye.L": 1.})
        self.assertEqual(rigid_weights("Eye.R"), {"Eye.R": 1.})
        with self.assertRaisesRegex(ValueError, "independently identified"):
            rigid_weights("Jaw")

    def test_real_vertex_weights_are_finite_complete_normalized_and_two_max(self):
        points = [(0, 0, 1. + i * .009) for i in range(100)]
        skin = [body_weights(p, self.PIVOT, self.EYE) for p in points]
        report = validate_draft_weights(
            skin, vertex_count=100, group_names={"Head", "Neck", "Hips"},
            source_verified_eyes=True,
        )
        self.assertEqual(report["maxInfluences"], 2)
        self.assertEqual(report["vertexCount"], 100)
        self.assertFalse(report["artistReviewed"])
        self.assertFalse(report["fullBodySkinned"])
        self.assertFalse(report["productionValidated"])

    def test_never_accepts_forged_eyeballs_or_unweighted_body(self):
        skin = [rigid_weights("Head") for _ in range(50)]
        with self.assertRaisesRegex(ValueError, "guessed"):
            validate_draft_weights(skin, vertex_count=50, group_names={"Head"}, source_verified_eyes=False)
        with self.assertRaisesRegex(ValueError, "cover every"):
            validate_draft_weights(skin, vertex_count=51, group_names={"Head"}, source_verified_eyes=True)
        skin[2] = {}
        with self.assertRaisesRegex(ValueError, "zero or excessive"):
            validate_draft_weights(skin, vertex_count=50, group_names={"Head"}, source_verified_eyes=True)

    def test_rejects_invalid_guide_dimensions_or_bad_weights(self):
        with self.assertRaisesRegex(ValueError, "inconsistent heights"):
            body_weights((0, 0, 1.6), 1.2, 1.64)
        with self.assertRaisesRegex(ValueError, "non-finite"):
            body_weights((0, math.nan, 1.60), self.PIVOT, self.EYE)
        too_many = [{"Hips": .25, "Head": .25, "Neck": .5} for _ in range(50)]
        with self.assertRaisesRegex(ValueError, "excessive"):
            validate_draft_weights(
                too_many, vertex_count=50, group_names={"Hips", "Head", "Neck"},
                source_verified_eyes=True,
            )
        off_bone = [{"Jaw": 1.0} for _ in range(50)]
        with self.assertRaisesRegex(ValueError, "missing"):
            validate_draft_weights(
                off_bone, vertex_count=50, group_names={"Hips", "Head"},
                source_verified_eyes=True,
            )


if __name__ == "__main__":
    unittest.main()
