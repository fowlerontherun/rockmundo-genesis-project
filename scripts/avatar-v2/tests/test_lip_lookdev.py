"""No invented mouth: only classify real finite frontal source polygons."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lip_lookdev import classify_lip_polygon, validate_coverage


class RealSourceLipTests(unittest.TestCase):
    EYE = (0., -.035, 1.564)
    R = .037
    Z = 1.564 - 2.9 * R
    N = (0., -1., 0.)

    def role(self, point, normal=None):
        return classify_lip_polygon(point, normal or self.N, self.EYE, self.R)

    def test_actual_upper_lower_lip_regions_have_separate_material_zones(self):
        self.assertEqual(self.role((0., -.09, self.Z + .005)), "upper_lip")
        self.assertEqual(self.role((0., -.09, self.Z - .005)), "lower_lip")
        self.assertEqual(self.role((.033, -.09, self.Z)), "transition")

    def test_cheeks_nose_chin_back_of_head_and_eye_ball_cannot_be_tinted(self):
        for pos in ((.08, -.09, self.Z),
                    (0., -.09, self.Z + .06),
                    (0., -.09, self.Z - .05),
                    (0., -.02, self.Z)):
            self.assertEqual(self.role(pos), "skin", pos)
        self.assertEqual(self.role((0., -.09, self.Z), (0, +1, 0)), "skin")

    def test_lip_geometry_scales_with_an_actual_measured_eye_radius(self):
        small = classify_lip_polygon(
            (0., -.11, 1.56 - 2.9 * .024 + .002), self.N,
            (0., -.02, 1.56), .024,
        )
        large = classify_lip_polygon(
            (0., -.11, 1.65 - 2.9 * .048 - .002), self.N,
            (0., -.02, 1.65), .048,
        )
        self.assertEqual(small, "upper_lip")
        self.assertEqual(large, "lower_lip")

    def test_invalid_geometry_never_becomes_a_certain_facial_material(self):
        for p, n, radius in [
            ((0, 0, 0), self.N, .1),
            ((float("nan"), 0, 0), self.N, .037),
            ((0, 0, 0), (float("inf"), -1, 0), .037),
            ((0, 0), self.N, .037),
        ]:
            with self.assertRaises(ValueError):
                classify_lip_polygon(p, n, self.EYE, radius)

    def test_real_bilateral_lip_polygon_evidence_is_mandatory(self):
        # Real masculine CC0 mesh uses 12,500 source QUADS (not the 25,000
        # triangulated glTF faces), so evidence thresholds must count quads.
        validate_coverage({
            "skin": 12456, "transition": 22,
            "upper_lip": 12, "lower_lip": 10,
        }, 12500)
        validate_coverage({
            "skin": 24882, "transition": 50,
            "upper_lip": 28, "lower_lip": 40,
        }, 25000)
        for counts in [
            {"skin": 24985, "transition": 5, "upper_lip": 5, "lower_lip": 5},
            {"skin": 20000, "transition": 2000, "upper_lip": 1500, "lower_lip": 1500},
        ]:
            with self.assertRaisesRegex(ValueError, "[Ll]ip"):
                validate_coverage(counts, 25000)


if __name__ == "__main__":
    unittest.main()
