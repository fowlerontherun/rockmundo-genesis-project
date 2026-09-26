"""Regression tests for production rig review gates (no Blender required)."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from rig_review import audit_rig_review, CLOSEUP_REVIEWS, PERFORMANCE_REVIEWS


class RigReviewTests(unittest.TestCase):
    def test_new_closeup_rig_requires_every_independent_review(self):
        errors = audit_rig_review({}, "ArtistRig", 0)
        self.assertEqual(len(errors), len(CLOSEUP_REVIEWS) + len(PERFORMANCE_REVIEWS))
        for key in (*CLOSEUP_REVIEWS, *PERFORMANCE_REVIEWS):
            self.assertTrue(any(key in error for error in errors))

    def test_one_missing_instrument_review_blocks_export(self):
        properties = {key: True for key in (*CLOSEUP_REVIEWS, *PERFORMANCE_REVIEWS)}
        properties["rockmundoAvatarV2DrumPoseApproved"] = False
        errors = audit_rig_review(properties, "ArtistRig", 1)
        self.assertEqual(len(errors), 1)
        self.assertIn("DrumPoseApproved", errors[0])

    def test_approved_closeup_rig_has_no_review_errors(self):
        properties = {key: True for key in (*CLOSEUP_REVIEWS, *PERFORMANCE_REVIEWS)}
        self.assertEqual(audit_rig_review(properties, "ArtistRig", 0), [])

    def test_guide_cannot_bypass_gate_with_all_approvals(self):
        properties = {key: True for key in (*CLOSEUP_REVIEWS, *PERFORMANCE_REVIEWS)}
        properties["rockmundoAvatarV2RigGuide"] = True
        properties["rockmundoAvatarV2RequiresManualFit"] = True
        self.assertEqual(len(audit_rig_review(properties, "Guide", 0)), 2)

    def test_distant_lod_still_rejects_unfinished_guide(self):
        self.assertEqual(audit_rig_review({}, "ArtistRig", 3), [])
        errors = audit_rig_review({"rockmundoAvatarV2RigGuide": True}, "Guide", 3)
        self.assertEqual(len(errors), 1)

    def test_truthy_non_boolean_is_not_artist_approval(self):
        properties = {key: True for key in (*CLOSEUP_REVIEWS, *PERFORMANCE_REVIEWS)}
        properties["rockmundoAvatarV2WeightsApproved"] = "true"
        self.assertTrue(any("WeightsApproved" in e for e in audit_rig_review(properties, "Rig", 0)))


if __name__ == "__main__":
    unittest.main()
