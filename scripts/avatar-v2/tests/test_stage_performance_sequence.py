"""Regression tests for deterministic draft gig choreography."""
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from stage_performance_sequence import plan_performance
from export_stage_performance_plan import build_manifest, parse_sections

SECTIONS = (("intro", 8), ("verse", 16), ("chorus", 16), ("bridge", 8), ("solo", 16), ("outro", 8))

class StagePerformanceSequenceTests(unittest.TestCase):
    def test_every_role_covers_song_without_gaps(self):
        for role in ("singer", "guitar", "bass", "drums", "keys", "dj"):
            plan = plan_performance(role, SECTIONS, seed="gig-42")
            self.assertEqual(plan[0].start_beat, 0)
            self.assertEqual(plan[-1].end_beat, 72)
            for left, right in zip(plan, plan[1:]):
                self.assertEqual(left.end_beat, right.start_beat)
                self.assertNotEqual(left.clip, right.clip)
            self.assertTrue(all(0 <= x.transition_beats <= 2 for x in plan))

    def test_replay_and_tempo_are_deterministic(self):
        original = plan_performance("drums", SECTIONS, seed="gig-42")
        self.assertEqual(original, plan_performance("drums", SECTIONS, seed="gig-42"))
        self.assertEqual(original, plan_performance("drums", SECTIONS, seed="gig-42", bpm=160))

    def test_review_manifest_is_reproducible_and_explicitly_unapproved(self):
        sections = parse_sections("intro:8,verse:16,chorus:16,outro:8")
        manifest = build_manifest("gig-42", 120, sections)
        self.assertEqual(manifest, build_manifest("gig-42", 120, sections))
        self.assertEqual(manifest["durationBeats"], 48)
        self.assertFalse(manifest["runtimeIntegrated"])
        self.assertFalse(manifest["instrumentContactValidated"])
        self.assertEqual(len(manifest["roles"]), 6)
        self.assertTrue(all(plan[-1]["end_beat"] == 48 for plan in manifest["roles"].values()))
        with self.assertRaises(ValueError):
            parse_sections("verse:0")

    def test_short_section_and_invalid_input(self):
        plan = plan_performance("guitar", (("intro", 1), ("outro", 3)), seed="tiny")
        self.assertEqual(plan[-1].end_beat, 4)
        with self.assertRaises(ValueError):
            plan_performance("drums", (("verse", 0),), seed="gig")
        with self.assertRaises(ValueError):
            plan_performance("unknown", SECTIONS, seed="gig")

if __name__ == "__main__":
    unittest.main()
