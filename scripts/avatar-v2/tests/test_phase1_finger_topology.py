"""Actual CC0 mesh-edge hand trace must not route through adjacent fingers."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_finger_topology import FINGER_BONES, digit_owners, trace_missing_finger_source  # noqa: E402


def fixture():
    segments = {
        f"{digit}{joint}.{side}": (
            (x, digit_index * .03, joint * .033),
            (x, digit_index * .03, joint * .033 + .020),
        )
        for side, x in (("L", .10), ("R", -.10))
        for digit_index, digit in enumerate(("Thumb", "Index", "Middle", "Ring", "Pinky"))
        for joint in (1, 2, 3)
    }
    # Middle3.L is empty. Actual same-digit Middle2.L is initially owned,
    # connected by true source mesh edges to bare distal skin. Physically
    # closer skin 4 belongs to Ring2 and MUST NOT be used as an anchor/path.
    positions = [
        (.100, .060, .101),  # 0 trusted Middle2 surface
        (.100, .060, .106),  # 1 unclaimed, truly same surface connected edge
        (.100, .060, .111),  # 2 unclaimed distal same surface
        (.100, .060, .118),  # 3 further distal same surface
        (.101, .060, .120),  # 4 Ring2 claimed — wrong finger
        (.101, .061, .125),  # 5 skin only connected through wrong finger
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
    weights = [
        {"Middle2.L": .75, "Hand.L": .25},
        {"Hand.L": 1.},
        {"Hand.L": 1.},
        {"Hand.L": 1.},
        {"Ring2.L": 1.},
        {"Hand.L": 1.},
    ]
    return positions, edges, weights, segments


class FingerTopologyTests(unittest.TestCase):
    def test_anchors_on_real_same_digit_and_refuses_wrong_digit_bridge(self):
        positions, edges, weights, segments = fixture()
        self.assertEqual(set(segments), FINGER_BONES)
        self.assertEqual(digit_owners(weights[0]), {"Middle.L"})
        report = trace_missing_finger_source(positions, edges, weights, segments)
        middle = report["Middle3.L"]
        self.assertEqual(middle["upstreamSameDigitBone"], "Middle2.L")
        self.assertEqual(middle["sameDigitAnchorVertex"], 0)
        self.assertEqual(middle["distalTopologyVertex"], 3)
        self.assertEqual(middle["nearTargetTopologyVertices"], 4)
        self.assertEqual(middle["reachableSkinVertices"], 4)
        self.assertGreater(middle["otherDigitEdgesBlocked"], 0)
        self.assertNotIn(4, middle["conservativeCandidateVertices"])
        self.assertNotIn(5, middle["conservativeCandidateVertices"])
        self.assertTrue(middle["notAnInternalJointPivot"])
        self.assertFalse(middle["candidatePaintApplied"])
        self.assertFalse(middle["artistReviewed"])
        self.assertFalse(middle["productionValidated"])

    def test_other_side_same_digit_is_never_a_trustworthy_anchor(self):
        positions, edges, weights, segments = fixture()
        weights[0] = {"Middle2.R": .75, "Hand.L": .25}
        middle = trace_missing_finger_source(
            positions, edges, weights, segments)["Middle3.L"]
        self.assertEqual(middle["blocker"], "no-trustworthy-same-digit-parent-paint")
        self.assertIsNone(middle["sameDigitAnchorVertex"])

    def test_same_digit_predecessor_fallback_is_transparently_reported(self):
        positions, edges, weights, segments = fixture()
        weights[0] = {"Middle1.L": .75, "Hand.L": .25}
        middle = trace_missing_finger_source(
            positions, edges, weights, segments)["Middle3.L"]
        self.assertEqual(middle["upstreamSameDigitBone"], "Middle1.L")
        self.assertEqual(middle["sameDigitAnchorVertex"], 0)

    def test_competing_finger_claim_along_path_is_a_hard_boundary(self):
        positions, edges, weights, segments = fixture()
        weights[1]["Index2.L"] = .8
        middle = trace_missing_finger_source(
            positions, edges, weights, segments)["Middle3.L"]
        self.assertEqual(middle["sameDigitAnchorVertex"], 0)
        self.assertEqual(middle["reachableSkinVertices"], 1)
        self.assertGreater(middle["otherDigitEdgesBlocked"], 0)

    def test_invalid_real_mesh_indices_and_malformed_sculpt_fail_closed(self):
        positions, edges, weights, segments = fixture()
        for invalid in ([(1, 15)], [(2, 2)], [(-1, 2)]):
            with self.assertRaisesRegex(ValueError, "Malformed genuine"):
                trace_missing_finger_source(positions, invalid, weights, segments)
        positions[1] = (float("nan"), .06, .1)
        with self.assertRaisesRegex(ValueError, "Invalid source skin"):
            trace_missing_finger_source(positions, edges, weights, segments)

    def test_no_nearest_neighbour_jump_through_disconnected_source(self):
        positions, edges, weights, segments = fixture()
        report = trace_missing_finger_source(
            positions, [(3, 4)], weights, segments)["Middle3.L"]
        self.assertEqual(report["sameDigitAnchorVertex"], 0)
        self.assertEqual(report["reachableSkinVertices"], 1)
        self.assertEqual(report["nearTargetTopologyVertices"], 1)


if __name__ == "__main__":
    unittest.main()
