"""Pure regression gates for genuine V2 Starter Wardrobe shirt extraction."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from tee_surface import (
    STARTER_TEES, inside_shirt_region, largest_connected_surface,
    upper_shirt_edge, validate_surface_projection,
)


def continuous_anatomical_torso():
    # Test only: connected synthetic mesh with actual mesh topology for
    # validating extraction logic. Production builder uses pinned CC0 sculpt.
    rings, steps = 23, 80
    points = [
        (.245 * math.cos(theta * 2 * math.pi / steps),
         .16 * math.sin(theta * 2 * math.pi / steps) - .012,
         .95 + z * .028)
        for z in range(rings)
        for theta in range(steps)
    ]
    polygons = []
    for z in range(rings - 1):
        for t in range(steps):
            nxt = (t + 1) % steps
            polygons.append((
                z * steps + t, z * steps + nxt,
                (z + 1) * steps + nxt, (z + 1) * steps + t,
            ))
    return points, polygons


class StarterTeeSurfaceTests(unittest.TestCase):
    def test_exact_already_existing_four_starter_item_keys_not_new_shop_inventory(self):
        self.assertEqual([entry[1] for entry in STARTER_TEES], [
            'clothing.starter.logo-tee', 'clothing.starter.plain-black-tee',
            'clothing.starter.plain-white-tee', 'clothing.starter.vintage-charcoal-tee',
        ])
        self.assertEqual(len(set(x[0] for x in STARTER_TEES)), 4)

    def test_real_sculpt_cut_has_curved_neck_and_short_bilateral_sleeves(self):
        self.assertLess(upper_shirt_edge(0), upper_shirt_edge(.19))
        self.assertTrue(inside_shirt_region((0, -.15, 1.20)))
        self.assertFalse(inside_shirt_region((0, -.15, 1.50)))
        self.assertTrue(inside_shirt_region((.30, -.05, 1.39)))
        self.assertFalse(inside_shirt_region((.30, -.05, 1.02)))
        self.assertFalse(inside_shirt_region((.55, -.05, 1.39)))

    def test_picks_real_connected_chest_back_and_both_sleeves_not_floaters(self):
        points, faces = continuous_anatomical_torso()
        selected = largest_connected_surface(points, faces)
        self.assertGreater(len(selected), 350)
        self.assertLess(len(selected), len(faces))
        left = [i for i in selected if any(points[v][0] > .23 for v in faces[i])]
        right = [i for i in selected if any(points[v][0] < -.23 for v in faces[i])]
        self.assertGreater(len(left), 8)
        self.assertGreater(len(right), 8)

    def test_smaller_feminine_source_uses_actual_scaled_neck_and_both_arm_regions(self):
        points, faces = continuous_anatomical_torso()
        smaller = [(x * .94, y * .96, z * 1.72 / 1.80) for x, y, z in points]
        selected = largest_connected_surface(smaller, faces, "feminine")
        self.assertGreater(len(selected), 350)
        self.assertTrue(inside_shirt_region((.29 * .94, -.05, 1.38 * 1.72 / 1.80), "feminine"))
        self.assertFalse(inside_shirt_region((.5, -.05, 1.3), "feminine"))
        self.assertGreater(len([
            i for i in selected if any(smaller[v][0] > .19 * .94 for v in faces[i])
        ]), 8)
        self.assertGreater(len([
            i for i in selected if any(smaller[v][0] < -.19 * .94 for v in faces[i])
        ]), 8)

    def test_refuses_missing_real_mesh_disconnected_stub_and_missing_back(self):
        points, faces = continuous_anatomical_torso()
        with self.assertRaisesRegex(ValueError, 'complete, original'):
            largest_connected_surface(points[:900], faces[:400])
        # Flip the full continuous source forward, leaving no back chest:
        flattened = [(x, -abs(y) - .09, z) for x, y, z in points]
        with self.assertRaisesRegex(ValueError, 'front/back'):
            largest_connected_surface(flattened, faces)

    def test_genuine_normal_projection_limits_detached_giant_poncho_geometry(self):
        points = [(.02 * i, -.15, 1.18) for i in range(400)]
        shifted = [(x, y - .014, z) for x, y, z in points]
        audit = validate_surface_projection(points, shifted)
        self.assertEqual(audit['averageOffsetMm'], 14)
        self.assertEqual(audit['sourceSurfaceVertices'], 400)
        self.assertFalse(audit['productionValidated'])
        with self.assertRaisesRegex(ValueError, 'detached'):
            validate_surface_projection(points, [(x, y - .18, z) for x, y, z in points])
        with self.assertRaisesRegex(ValueError, 'non-finite'):
            validate_surface_projection(points, [(x, float('nan'), z) for x, y, z in points])


if __name__ == '__main__':
    unittest.main()
