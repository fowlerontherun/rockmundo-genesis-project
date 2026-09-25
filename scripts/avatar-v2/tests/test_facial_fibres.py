"""Real spatial eyebrow and upper-lash fibre regressions (no Blender dependency)."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from facial_fibres import (  # noqa: E402
    brow_fibre_samples, brow_profile, sweep_tapered_fibre, upper_lash_roots,
)


class RealFacialFibresTests(unittest.TestCase):
    LEFT = (.0493, -.0353, 1.5639)
    RIGHT = (-.0493, -.0353, 1.5639)
    RADIUS = .037

    def test_brows_are_real_curved_spans_in_world_metres(self):
        left = brow_profile(self.LEFT, self.RADIUS, "L")
        right = brow_profile(self.RIGHT, self.RADIUS, "R")
        self.assertEqual(len(left), 27)
        self.assertEqual(len(right), 27)
        self.assertTrue(all(left[i][0] < left[i + 1][0] for i in range(26)))
        self.assertTrue(all(right[i][0] > right[i + 1][0] for i in range(26)))
        for a, b in zip(left, right):
            self.assertAlmostEqual(a[0], -b[0])
            self.assertAlmostEqual(a[1], b[1])
            self.assertAlmostEqual(a[2], b[2])
        self.assertGreater(left[13][1], left[0][1])
        self.assertGreater(left[13][2], left[0][2])

    def test_each_brow_has_physically_staggered_and_tapered_groom(self):
        roots = brow_fibre_samples(self.LEFT, self.RADIUS, "L")
        self.assertEqual(len(roots), 76)
        self.assertTrue(all(roots[i][0] < roots[i + 1][0] for i in range(75)))
        self.assertGreater(len({round(z, 5) for _, z, _, _ in roots}), 40)
        self.assertTrue(all(.002 <= length <= .006 for _, _, length, _ in roots))

    def test_upper_lashes_follow_actual_eye_diameter_and_eye_side(self):
        left = upper_lash_roots(self.LEFT, self.RADIUS, "L")
        right = upper_lash_roots(self.RIGHT, self.RADIUS, "R")
        self.assertEqual(len(left), 27)
        self.assertEqual(len(right), 27)
        for a, b in zip(left, right):
            self.assertAlmostEqual(a[0], -b[0])
            self.assertAlmostEqual(a[1], b[1])
            self.assertAlmostEqual(a[2], b[2])
            self.assertGreater(a[1], self.LEFT[2])
            self.assertTrue(.004 <= a[2] <= .012)
        self.assertLess(max(p[0] for p in left) - min(p[0] for p in left), 2 * self.RADIUS)

    def test_eyebrow_fibre_has_real_cylindrical_geometry_and_tapered_tip(self):
        path = ((.04, -.105, 1.615), (.043, -.107, 1.618), (.047, -.106, 1.619))
        vertices, faces = sweep_tapered_fibre(path, .00023)
        self.assertEqual(len(vertices), 18)
        self.assertEqual(len(faces), 12)
        self.assertTrue(all(len(set(face)) == 4 for face in faces))
        self.assertGreater(math.dist(vertices[0], path[0]), 1e-4)
        self.assertLess(math.dist(vertices[-1], path[2]), .000025)
        self.assertEqual(len(set(faces)), len(faces))

    def test_invalid_side_radius_fibre_shape_and_numeric_data_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "L or R"):
            brow_profile(self.LEFT, self.RADIUS, "B")
        with self.assertRaisesRegex(ValueError, "22–50mm"):
            upper_lash_roots(self.RIGHT, .2, "R")
        with self.assertRaisesRegex(ValueError, "16–100"):
            brow_profile(self.LEFT, self.RADIUS, "L", samples=3)
        with self.assertRaisesRegex(ValueError, "24–150"):
            brow_fibre_samples(self.LEFT, self.RADIUS, "L", count=2)
        with self.assertRaisesRegex(ValueError, "14–42"):
            upper_lash_roots(self.LEFT, self.RADIUS, "L", count=2)
        with self.assertRaisesRegex(ValueError, "span at least"):
            sweep_tapered_fibre(((0, 0, 0), (.00001, 0, 0), (.0001, 0, 0)), .00022)
        with self.assertRaisesRegex(ValueError, "non-finite"):
            sweep_tapered_fibre(((0, 0, 0), (.001, math.nan, 0), (.002, 0, 0)), .00022)


if __name__ == "__main__":
    unittest.main()
