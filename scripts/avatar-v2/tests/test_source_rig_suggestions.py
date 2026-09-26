"""Pure geometry regressions for suggested joints from real Blender mesh vertices."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from source_rig_suggestions import measure_eye, measure_eyes, source_joint_suggestions  # noqa: E402


def eye_sphere(x: float, y: float = -.035, z: float = 1.56, radius: float = .036):
    return [
        (x + radius * math.cos(a) * math.sin(b),
         y + radius * math.sin(a) * math.sin(b),
         z + radius * math.cos(b))
        for a in (2 * math.pi * step / 24 for step in range(24))
        for b in (math.pi * index / 16 for index in range(17))
    ]


def continuous_body():
    # Most torso and face vertices must not be misidentified as outer earlobes.
    points = [
        (.035 * math.cos(2 * math.pi * i / 35),
         .038 * math.sin(2 * math.pi * i / 35),
         .35 + (i % 38) * .026)
        for i in range(1400)
    ]
    # True lateral mirrored lower-head patches with many actual 3D samples.
    for side in (-1, 1):
        for index in range(140):
            points.append((
                side * (.102 + (index % 7) * .001),
                .017 + (index % 9) * .002,
                1.487 + (index % 13) * .003,
            ))
    return points


class SourceJointSuggestionsTests(unittest.TestCase):
    def setUp(self):
        self.eyes = {"L": eye_sphere(.052), "R": eye_sphere(-.052)}
        self.body = continuous_body()

    def test_reads_true_sphere_centres_and_radius_without_guides(self):
        eyes = measure_eyes(self.eyes)
        self.assertAlmostEqual(eyes["L"].centre[0], .052, places=3)
        self.assertAlmostEqual(eyes["R"].centre[0], -.052, places=3)
        self.assertAlmostEqual(eyes["L"].radius, .036, places=3)
        self.assertGreater(eyes["L"].vertex_count, 50)

    def test_four_suggestions_are_on_actual_source_vertices_or_eye_centres(self):
        positions, counts, eyes = source_joint_suggestions(self.body, self.eyes)
        self.assertEqual(set(positions), {"Eye.L", "Eye.R", "EarAnchor.L", "EarAnchor.R"})
        self.assertGreater(counts["EarAnchor.L"], 5)
        self.assertGreater(counts["EarAnchor.R"], 5)
        self.assertGreater(positions["EarAnchor.L"][0], positions["Eye.L"][0])
        self.assertLess(positions["EarAnchor.R"][0], positions["Eye.R"][0])
        self.assertAlmostEqual(positions["EarAnchor.L"][0], -positions["EarAnchor.R"][0], places=4)
        self.assertAlmostEqual(positions["EarAnchor.L"][2], positions["EarAnchor.R"][2], places=4)
        for side in ("L", "R"):
            self.assertLess(positions[f"EarAnchor.{side}"][2], positions[f"Eye.{side}"][2])
            self.assertGreater(positions[f"Eye.{side}"][2] - positions[f"EarAnchor.{side}"][2], eyes[side].radius)

    def test_wrong_side_or_missing_eye_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "separate"):
            measure_eyes({"L": self.eyes["L"]})
        with self.assertRaisesRegex(ValueError, "spacing or reversed"):
            measure_eyes({"L": self.eyes["R"], "R": self.eyes["L"]})

    def test_flattened_eye_or_non_finite_input_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "flattened"):
            measure_eye([(x, -.035, z) for x, _, z in self.eyes["L"]])
        broken = dict(self.eyes)
        broken["L"] = [*self.eyes["L"][:-1], (math.nan, 0, 0)]
        with self.assertRaisesRegex(ValueError, "non-finite"):
            measure_eyes(broken)

    def test_no_fake_or_swapped_ear_patch_fallback(self):
        without_ears = [point for point in self.body if abs(point[0]) < .07]
        with self.assertRaisesRegex(ValueError, "not resolvable"):
            source_joint_suggestions(without_ears, self.eyes)
        unilateral = [point for point in self.body if point[0] >= -.07]
        with self.assertRaisesRegex(ValueError, "not resolvable"):
            source_joint_suggestions(unilateral, self.eyes)

    def test_body_must_have_real_source_geometry(self):
        with self.assertRaisesRegex(ValueError, "too few"):
            source_joint_suggestions(self.body[:50], self.eyes)


if __name__ == "__main__":
    unittest.main()
