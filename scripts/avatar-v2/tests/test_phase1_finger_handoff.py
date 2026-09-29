"""The CC0 source handoff must NOT mix frames, guides, or wrong-finger skin."""
import copy
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from phase1_body_contract import DIGITS, segment_distance  # noqa: E402
from phase1_finger_handoff import FINGER_BONES, validate_finger_handoff  # noqa: E402


def fixture():
    source = [(.23, .06, .135)] + [(3. + i * .0001, 3., 3.) for i in range(1000)]
    bones = {
        f"{digit}{joint}.{side}": (
            (x, digit_index * .03, joint * .04),
            (x, digit_index * .03, joint * .04 + .02),
        )
        for side, x in (("L", .23), ("R", -.23))
        for digit_index, digit in enumerate(DIGITS)
        for joint in (1, 2, 3)
    }
    head, tail = bones["Middle3.L"]
    mm = round(segment_distance(source[0], head, tail)[0] * 1000, 3)
    hint = {
        "nearestActualSourceVertexIndex": 0,
        "actualSourceSurfacePosition": list(source[0]),
        "sourceDistanceMm": mm,
        "currentGuideHead": list(head),
        "currentGuideTail": list(tail),
        "nearestSourceWeights": {"Hand.L": .2, "Ring2.L": .8},
        "nearbyOtherDigitWeights": ["Ring2.L"],
        "possibleWrongFingerSurface": True,
        "hintIsOnSkinNotInternalJointPivot": True,
        "artistReviewed": False,
        "productionValidated": False,
    }
    report = {
        "schema": "rockmundo.avatar-v2-unfitted-binding-experiment",
        "version": 1, "frame": "masculine",
        "sourceUnfitted": True, "artistReviewed": False,
        "productionValidated": False, "realSourceVertices": len(source),
        "initialSkinAudit": {"missingDeformBones": ["Middle3.L", "Shoulder.L"]},
        "fingerFitReviewHints": {"Middle3.L": hint},
    }
    return report, source, bones


class FingerHandoffTests(unittest.TestCase):
    def test_actual_30_segment_source_scene_and_other_digit_warning(self):
        report, source, bones = fixture()
        self.assertEqual(set(bones), FINGER_BONES)
        hints = validate_finger_handoff(report, "masculine", source, bones)
        self.assertEqual(list(hints), ["Middle3.L"])
        self.assertTrue(hints["Middle3.L"]["possibleWrongFingerSurface"])

    def test_stale_body_source_vertex_and_wrong_frame_are_rejected(self):
        report, source, bones = fixture()
        with self.assertRaisesRegex(ValueError, "same-frame"):
            validate_finger_handoff(report, "feminine", source, bones)
        source[0] = (.23, .06, .13)
        with self.assertRaisesRegex(ValueError, "source mesh changed"):
            validate_finger_handoff(report, "masculine", source, bones)

    def test_new_or_edited_handle_positions_are_not_silently_used(self):
        report, source, bones = fixture()
        bones["Middle3.L"] = ((.2, .06, .125), (.2, .06, .145))
        with self.assertRaisesRegex(ValueError, "guide bone changed"):
            validate_finger_handoff(report, "masculine", source, bones)

    def test_wrong_digit_warning_must_match_real_heat_ownership(self):
        report, source, bones = fixture()
        report["fingerFitReviewHints"]["Middle3.L"]["possibleWrongFingerSurface"] = False
        with self.assertRaisesRegex(ValueError, "wrong-digit"):
            validate_finger_handoff(report, "masculine", source, bones)

    def test_no_fake_approval_or_deleted_actual_missing_bone(self):
        report, source, bones = fixture()
        report["artistReviewed"] = True
        with self.assertRaisesRegex(ValueError, "UNFITTED"):
            validate_finger_handoff(report, "masculine", source, bones)
        report, source, bones = fixture()
        report["initialSkinAudit"]["missingDeformBones"].append("Pinky3.R")
        with self.assertRaisesRegex(ValueError, "do not exactly match"):
            validate_finger_handoff(report, "masculine", source, bones)

    def test_malformed_weight_report_or_unsafe_nearest_vertex_is_rejected(self):
        report, source, bones = fixture()
        hint = report["fingerFitReviewHints"]["Middle3.L"]
        hint["nearestActualSourceVertexIndex"] = 1001
        with self.assertRaisesRegex(ValueError, "invalid original source vertex"):
            validate_finger_handoff(report, "masculine", source, bones)
        report, source, bones = fixture()
        report["fingerFitReviewHints"]["Middle3.L"]["nearestSourceWeights"]["Ring2.L"] = float("nan")
        with self.assertRaisesRegex(ValueError, "invalid diagnostic paint"):
            validate_finger_handoff(report, "masculine", source, bones)


if __name__ == "__main__":
    unittest.main()
