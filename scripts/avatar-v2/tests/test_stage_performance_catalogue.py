"""Pure regression tests for draft stage choreography (no Blender required)."""
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from stage_performance_catalogue import build_catalogue, validate_catalogue, ROLES
from rig_landmarks import position_markers
# Stage keys are checked against actual rig-guide bone names, not made-up joints.
BONES = {
    "Hips", "Spine2", "Neck", "Head",
    *(f"{name}.{side}" for side in ("L", "R")
      for name in ("Shoulder", "LowerArm", "Hand")),
}

class StagePerformanceCatalogueTests(unittest.TestCase):
    def test_all_roles_have_ten_unique_clips_and_valid_bones(self):
        clips = build_catalogue()
        self.assertEqual(len(clips), 60)
        self.assertEqual({clip.role for clip in clips}, set(ROLES))
        for role in ROLES:
            self.assertEqual(sum(clip.role == role for clip in clips), 10)
        validate_catalogue(clips, BONES)

    def test_every_bone_returns_to_rest_at_loop_boundary(self):
        for clip in build_catalogue():
            for bone in {name for _, name, _ in clip.keys}:
                keys = sorted((beat, angles) for beat, name, angles in clip.keys if name == bone)
                self.assertEqual(keys[0], (0., (0., 0., 0.)))
                self.assertEqual(keys[-1], (float(clip.beats), (0., 0., 0.)))

    def test_tempo_changes_do_not_change_choreography(self):
        slow, fast = build_catalogue(80), build_catalogue(160)
        self.assertEqual([(x.name, x.keys) for x in slow], [(x.name, x.keys) for x in fast])
        with self.assertRaises(ValueError):
            build_catalogue(0)

    def test_missing_rig_bone_fails_preflight(self):
        with self.assertRaisesRegex(ValueError, "Invalid key"):
            validate_catalogue(build_catalogue(), BONES - {"Hand.R"})

if __name__ == "__main__":
    unittest.main()
