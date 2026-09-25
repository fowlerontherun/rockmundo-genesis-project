"""Pure geometry regressions for real source iris and separate cornea lookdev."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from eye_lookdev import choose_eye_material, cornea_dome, dot, unit


class EyeLookdevTests(unittest.TestCase):
    def test_exposed_source_sphere_renders_real_iris_and_pupil_regions(self):
        centre = (0., 0., 0.)
        forward = (0., -1., 0.)
        radius = .037
        self.assertEqual(choose_eye_material((0, -.037, 0), centre, forward, radius), "pupil")
        self.assertEqual(choose_eye_material((.013, -.034, 0), centre, forward, radius), "iris")
        self.assertEqual(choose_eye_material((.032, -.014, 0), centre, forward, radius), "sclera")
        self.assertEqual(choose_eye_material((0, .037, 0), centre, forward, radius), "sclera")

    def test_eye_material_regions_rotate_with_actual_eye_pivot(self):
        centre = (.025, 0, 1.6)
        forward = (1., 0., 0.)
        self.assertEqual(choose_eye_material((.062, 0., 1.6), centre, forward, .037), "pupil")
        self.assertEqual(choose_eye_material((.061, .011, 1.6), centre, forward, .037), "iris")

    def test_cornea_is_a_convex_separate_shell_over_existing_sphere(self):
        radius = .037
        verts, faces = cornea_dome((0, 0, 0), (0, -1, 0), (0, 0, 1), radius)
        self.assertEqual(len(verts), 40 * 6)
        self.assertEqual(len(faces), 40 * 5)
        self.assertEqual(len(set(faces)), len(faces))
        # All vertices must be outside original eyeball and within iris radius.
        self.assertTrue(all(math.sqrt(dot(v, v)) > radius for v in verts))
        self.assertTrue(all(math.sqrt(v[0] ** 2 + v[2] ** 2) <= .545 * radius + 1e-8 for v in verts))
        self.assertGreater(abs(verts[0][1]), abs(verts[-1][1]))

    def test_cornea_handles_rotated_eye_direction(self):
        centre = (.04, .01, 1.61)
        verts, faces = cornea_dome(centre, (1, 0, 0), (0, 0, 1), .037)
        self.assertEqual(len(verts), 240)
        self.assertGreater(min(v[0] for v in verts), centre[0])
        self.assertTrue(all(math.isfinite(c) for p in verts for c in p))

    def test_invalid_eye_dimensions_and_directions_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "radius"):
            choose_eye_material((0, 0, 0), (0, 0, 0), (0, -1, 0), 1.0)
        with self.assertRaisesRegex(ValueError, "nonzero"):
            choose_eye_material((0, 0, 0), (0, 0, 0), (0, 0, 0), .037)
        with self.assertRaisesRegex(ValueError, "scaled"):
            cornea_dome((0, 0, 0), (0, -1, 0), (0, 0, 1), .001)
        with self.assertRaisesRegex(ValueError, "nonzero"):
            cornea_dome((0, 0, 0), (0, -1, 0), (0, -1, 0), .037)


if __name__ == "__main__":
    unittest.main()
