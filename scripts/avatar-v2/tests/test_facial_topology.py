"""Regression tests for Blender-independent sculpt topology geometry rules."""

import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from facial_topology import audit_face_topology


def oval(x, y, z, rx, rz, count):
    return [
        (x + math.cos(i * math.tau / count) * rx,
         y + math.sin(i * math.tau / count) * .0005,
         z + math.sin(i * math.tau / count) * rz)
        for i in range(count)
    ]


def valid_sculpt():
    groups = {
        "RMV2_NoseBridge": oval(0, -.084, 1.61, .009, .012, 12),
        "RMV2_NoseTip": oval(0, -.118, 1.565, .011, .006, 12),
        "RMV2_NostrilRim.L": oval(.017, -.108, 1.551, .005, .003, 10),
        "RMV2_NostrilRim.R": oval(-.017, -.108, 1.551, .005, .003, 10),
    }
    for side, sign in (("L", 1), ("R", -1)):
        groups[f"RMV2_EarHelix.{side}"] = oval(.096 * sign, -.012, 1.604, .010, .040, 18)
        groups[f"RMV2_EarAntihelix.{side}"] = oval(.084 * sign, -.022, 1.597, .006, .024, 12)
        groups[f"RMV2_EarLobe.{side}"] = oval(.097 * sign, -.020, 1.553, .007, .006, 10)
    anchors = {
        "EarAnchor.L": (.097, -.020, 1.551),
        "EarAnchor.R": (-.097, -.020, 1.551),
    }
    return groups, anchors


class FacialTopologyTests(unittest.TestCase):
    def test_valid_sculpt_has_distinct_deep_nostrils_and_fitted_earlobes(self):
        groups, anchors = valid_sculpt()
        self.assertEqual(audit_face_topology(groups, anchors), [])

    def test_missing_real_nostril_vertex_group_fails(self):
        groups, anchors = valid_sculpt()
        groups["RMV2_NostrilRim.L"] = []
        self.assertTrue(any("RMV2_NostrilRim.L" in error for error in audit_face_topology(groups, anchors)))

    def test_painted_flat_nose_is_not_certified(self):
        groups, anchors = valid_sculpt()
        groups["RMV2_NoseTip"] = [(x, -.085, z) for x, _, z in groups["RMV2_NoseTip"]]
        self.assertTrue(any("protrude" in error for error in audit_face_topology(groups, anchors)))

    def test_reversed_nostrils_are_rejected(self):
        groups, anchors = valid_sculpt()
        groups["RMV2_NostrilRim.L"], groups["RMV2_NostrilRim.R"] = (
            groups["RMV2_NostrilRim.R"], groups["RMV2_NostrilRim.L"]
        )
        self.assertTrue(any("correct sides" in error for error in audit_face_topology(groups, anchors)))

    def test_floating_earring_anchor_is_rejected(self):
        groups, anchors = valid_sculpt()
        anchors["EarAnchor.R"] = (-.22, -.04, 1.6)
        self.assertTrue(any("EarAnchor.R" in error for error in audit_face_topology(groups, anchors)))

    def test_reused_helix_as_inner_contour_is_rejected(self):
        groups, anchors = valid_sculpt()
        groups["RMV2_EarAntihelix.L"] = groups["RMV2_EarHelix.L"][:]
        self.assertTrue(any("overlap" in error or "distinct inner contour" in error
                            for error in audit_face_topology(groups, anchors)))

    def test_flat_ear_contour_is_rejected(self):
        groups, anchors = valid_sculpt()
        groups["RMV2_EarHelix.R"] = [(x, y, 1.6) for x, y, _ in groups["RMV2_EarHelix.R"]]
        self.assertTrue(any("vertical helix" in error for error in audit_face_topology(groups, anchors)))


if __name__ == "__main__":
    unittest.main()
