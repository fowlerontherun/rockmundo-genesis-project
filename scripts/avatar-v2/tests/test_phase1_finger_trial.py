"""No false unpainted-finger fixes or cross-digit heat transfers."""
import copy
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_finger_trial import propose_quarantined_finger_trial  # noqa: E402


def fixture():
    segments = {
        f"{digit}{j}.{side}": (
            (x, digit_index * .03, j * .033),
            (x, digit_index * .03, j * .033 + .020),
        )
        for side, x in (("L", .1), ("R", -.1))
        for digit_index, digit in enumerate(
            ("Thumb", "Index", "Middle", "Ring", "Pinky"))
        for j in (1, 2, 3)
    }
    source = [(.1 + delta, .12, .080)
              for delta in (-.002, -.001, 0, .001, .002, .003)]
    original = [{"Pinky1.L": .75, "Hand.L": .25} for _ in source]
    target = "Pinky2.L"
    # Pinky2 guide z=.066..086, our actual source samples z=.080.
    trace = {
        target: {
            "missingJoint": target, "upstreamSameDigitBone": "Pinky1.L",
            "sourceTopologyOnly": True, "candidatePaintApplied": False,
            "artistReviewed": False, "productionValidated": False,
            "sameDigitAnchorVertex": 0, "distalTopologyVertex": 4,
            "blocker": None, "conservativeCandidateVertices": list(range(6)),
        },
    }
    return source, original, segments, trace


class QuarantinedSkinTrialTests(unittest.TestCase):
    def test_local_real_parent_skin_yields_at_least_four_meaningful_vertices(self):
        source, original, segments, trace = fixture()
        before = copy.deepcopy(original)
        proposed, report = propose_quarantined_finger_trial(
            source, original, segments, trace)
        self.assertEqual(original, before)
        self.assertEqual(len(proposed), 6)
        self.assertEqual(report["perFinger"]["Pinky2.L"]["acceptedActualSourceVertices"], 6)
        self.assertTrue(report["perFinger"]["Pinky2.L"]["appliedInIsolatedTrial"])
        self.assertFalse(report["productionValidated"])
        for weights in proposed.values():
            self.assertEqual(set(weights), {"Pinky1.L", "Pinky2.L", "Hand.L"})
            self.assertGreater(weights["Pinky2.L"], .065)
            self.assertGreater(weights["Pinky1.L"], .1)
            self.assertAlmostEqual(sum(weights.values()), 1., places=8)

    def test_never_overwrites_other_digits_even_at_token_weights(self):
        source, original, segments, trace = fixture()
        for i in range(3):
            original[i]["Ring1.L"] = .0002
        proposed, report = propose_quarantined_finger_trial(
            source, original, segments, trace)
        self.assertEqual(proposed, {})
        self.assertFalse(report["perFinger"]["Pinky2.L"]["appliedInIsolatedTrial"])
        self.assertEqual(report["perFinger"]["Pinky2.L"]["rejected"]
                         ["original-other-finger-paint"], 3)

    def test_never_drops_significant_existing_four_influences(self):
        source, original, segments, trace = fixture()
        original[:] = [{
            "Pinky1.L": .26, "Hand.L": .26,
            "LowerArm.L": .25, "UpperArm.L": .23,
        } for _ in source]
        proposed, report = propose_quarantined_finger_trial(
            source, original, segments, trace)
        self.assertEqual(proposed, {})
        self.assertEqual(report["perFinger"]["Pinky2.L"]["rejected"]
                         ["cannot-preserve-four-influences"], 6)

    def test_no_fabricated_group_if_only_three_real_eligible_vertices(self):
        source, original, segments, trace = fixture()
        trace["Pinky2.L"]["conservativeCandidateVertices"] = [0, 1, 2]
        proposed, report = propose_quarantined_finger_trial(
            source, original, segments, trace)
        self.assertEqual(proposed, {})
        self.assertEqual(report["perFinger"]["Pinky2.L"]["acceptedActualSourceVertices"], 0)

    def test_wrong_hand_parent_and_fake_approval_are_rejected(self):
        source, original, segments, trace = fixture()
        trace["Pinky2.L"]["upstreamSameDigitBone"] = "Pinky1.R"
        with self.assertRaisesRegex(ValueError, "wrong upstream finger"):
            propose_quarantined_finger_trial(source, original, segments, trace)
        source, original, segments, trace = fixture()
        trace["Pinky2.L"]["artistReviewed"] = True
        with self.assertRaisesRegex(ValueError, "not a genuine unapproved"):
            propose_quarantined_finger_trial(source, original, segments, trace)

    def test_stale_indices_bad_guides_and_missing_target_skin_block(self):
        source, original, segments, trace = fixture()
        trace["Pinky2.L"]["conservativeCandidateVertices"].append(900)
        with self.assertRaisesRegex(ValueError, "unsafe original CC0"):
            propose_quarantined_finger_trial(source, original, segments, trace)
        source, original, segments, trace = fixture()
        original[0]["Pinky2.L"] = .5
        proposed, report = propose_quarantined_finger_trial(
            source, original, segments, trace)
        self.assertEqual(len(proposed), 5)
        self.assertEqual(report["perFinger"]["Pinky2.L"]["rejected"]
                         ["no-meaningful-parent-weight"], 1)
        source, original, segments, trace = fixture()
        segments.pop("Pinky2.L")
        with self.assertRaisesRegex(ValueError, "all 30"):
            propose_quarantined_finger_trial(source, original, segments, trace)


if __name__ == "__main__":
    unittest.main()
