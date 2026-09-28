"""Reject floating generic limb guides and test independently measured hands."""
from __future__ import annotations

import pathlib
import sys
import unittest
from math import isfinite

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from source_limb_guide import (  # noqa: E402
    source_limb_landmarks, source_finger_bone_segments,
)


def both_source_surfaces():
    # Deterministic source-like asymmetric arm/tip cloud; not substituted
    # production art. The GitHub Blender workflow tests the ACTUAL two CC0.
    vertices = [
        (.05 * (i % 7) / 7, .02 * ((i % 9) - 4),
         .04 + i * 1.76 / 1200)
        for i in range(1201)
    ]
    locations = [
        (.213, 1.369),
        (.327, 1.122),
        (.388, .903),
        (.400, .836),
        (.394, .740),
    ]
    for direction in (1, -1):
        for x, z in locations:
            for n in range(90):
                vertices.append((
                    direction * (x + ((n % 11) - 5) * .002),
                    .025 + ((n % 13) - 6) * .003,
                    z + ((n % 9) - 4) * .002,
                ))
    return vertices


class SourceLimbGuideTests(unittest.TestCase):
    def test_each_source_frame_measures_actual_skin_landmarks_not_height_times_x(self):
        body = both_source_surfaces()
        measured = source_limb_landmarks(body)
        self.assertFalse(measured["artistReviewed"])
        self.assertEqual(measured["realSourceVertexCount"], len(body))
        self.assertEqual(set(measured["sides"]), {"L", "R"})
        for side, sign in (("L", 1), ("R", -1)):
            limb = measured["sides"][side]
            self.assertLess(sign * limb["palm"][0], .475 * measured["height"] * .7)
            self.assertGreater(sign * limb["wrist"][0], sign * limb["elbow"][0])
            self.assertGreater(limb["wrist"][2], limb["palm"][2])
            self.assertTrue(isfinite(limb["unreviewedFingerLengthScale"]))
            fingers = source_finger_bone_segments(side, limb, measured["height"])
            self.assertEqual(len(fingers), 15)
            for key, (head, tail) in fingers.items():
                self.assertTrue(key.endswith("." + side))
                self.assertGreater(sum((a - b) ** 2 for a, b in zip(head, tail)), 1e-6)
                self.assertLess(abs(head[0]), .53)

    def test_missing_opposite_side_and_bad_body_scale_fail_closed(self):
        all_body = both_source_surfaces()
        with self.assertRaisesRegex(ValueError, "actual shoulder"):
            source_limb_landmarks([p for p in all_body if p[0] >= 0])
        with self.assertRaisesRegex(ValueError, "continuous actual CC0"):
            source_limb_landmarks(all_body[:25])
        with self.assertRaisesRegex(ValueError, "non-finite"):
            source_limb_landmarks([*all_body[:-1], (float("nan"), .0, .7)])
        with self.assertRaisesRegex(ValueError, "Unknown"):
            source_finger_bone_segments("x", {}, 1.8)


if __name__ == "__main__":
    unittest.main()
