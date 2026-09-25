"""Avatar V2 retopology correspondence regression tests (no Blender needed)."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lod_surface_transfer import (  # noqa: E402
    SurfaceMatch, audit_matches, barycentric, interpolate_vec,
    interpolate_weights, max_delta, require_muscle_keys, select_morphs,
    shape_delta,
)

TRIANGLE = [(0., 0., 0.), (1., 0., 0.), (0., 1., 0.)]


class RetopoSurfaceTransferTests(unittest.TestCase):
    def test_transfers_uv_position_inside_triangle(self):
        result = barycentric((.25, .5, 0.), *TRIANGLE)
        self.assertEqual(len(result), 3)
        self.assertAlmostEqual(sum(result), 1.)
        self.assertAlmostEqual(result[0], .25)
        self.assertAlmostEqual(result[1], .25)
        self.assertAlmostEqual(result[2], .5)
        match = SurfaceMatch((0, 1, 2), result, .001)
        self.assertEqual(interpolate_vec(TRIANGLE, match), (.25, .5, 0.))

    def test_transfers_edge_and_vertex_without_negative_weights(self):
        for point in [(0., 0., 0.), (.5, .5, 0.), (0., 1., 0.)]:
            weights = barycentric(point, *TRIANGLE)
            self.assertTrue(all(0 <= w <= 1 for w in weights))
            self.assertAlmostEqual(sum(weights), 1.)

    def test_refuses_degenerate_and_outside_projection(self):
        with self.assertRaisesRegex(ValueError, "Degenerate"):
            barycentric((0, 0, 0), TRIANGLE[0], TRIANGLE[0], TRIANGLE[1])
        with self.assertRaisesRegex(ValueError, "outside"):
            barycentric((1.5, 1.5, 0), *TRIANGLE)

    def test_target_shape_delta_uses_source_surface_weights_not_generic_morph(self):
        match = SurfaceMatch((0, 1, 2), (.2, .3, .5), .006)
        shape = [(0., 0., .01), (1., 0., .03), (0., 1., .05)]
        delta = shape_delta(TRIANGLE, shape, match)
        self.assertAlmostEqual(delta[0], 0)
        self.assertAlmostEqual(delta[1], 0)
        self.assertAlmostEqual(delta[2], .2 * .01 + .3 * .03 + .5 * .05)
        self.assertAlmostEqual(max_delta([delta]), delta[2])
        with self.assertRaisesRegex(ValueError, "topology"):
            shape_delta(TRIANGLE, shape[:-1], match)

    def test_skin_prunes_to_four_and_normalizes_body_influences(self):
        groups = [
            {"Head": .4, "Neck": .3, "Spine2": .2, "Hips": .07,
             "Spine1": .03, "RMV2_NoseBridge": 1.0, "RMV2_TattooMask": .65},
            {"Head": .5, "Neck": .25, "Spine2": .1, "Hips": .1,
             "Spine1": .05, "RMV2_NoseBridge": 1.0, "RMV2_TattooMask": .5},
            {"Head": .55, "Neck": .2, "Spine2": .15, "Hips": .05,
             "Spine1": .05, "RMV2_NoseBridge": 1.0, "RMV2_TattooMask": .6},
        ]
        fit = SurfaceMatch((0, 1, 2), (.2, .3, .5), 0)
        rig = {"Head", "Neck", "Spine2", "Hips", "Spine1"}
        skin = interpolate_weights(groups, fit, rig)
        self.assertEqual(len([name for name in skin if name in rig]), 4)
        self.assertAlmostEqual(sum(value for name, value in skin.items() if name in rig), 1.)
        self.assertNotIn("RMV2_NoseBridge", skin)
        self.assertGreater(skin["Head"], skin["Neck"])
        self.assertGreater(skin["RMV2_TattooMask"], .5)

    def test_invalid_source_skin_and_unskinned_projection_rejected(self):
        match = SurfaceMatch((0, 1, 2), (.2, .3, .5), .001)
        with self.assertRaisesRegex(ValueError, "no meaningful deform"):
            interpolate_weights([{"RMV2_Region": 1.}] * 3, match, {"Head"})
        with self.assertRaisesRegex(ValueError, "invalid"):
            interpolate_weights([{"Head": float("nan")}] * 3, match, {"Head"})
        with self.assertRaisesRegex(ValueError, "invalid source-vertex"):
            interpolate_vec(TRIANGLE, SurfaceMatch((0, 1, 100), (.2, .3, .5), 0))

    def test_distant_lods_only_keep_materially_useful_shape_keys(self):
        authored = [
            "Basis", "muscleToned", "muscleAthletic", "muscleMuscular",
            "muscleBodybuilder", "blinkLeft", "jawOpen", "visemeAA",
            "mouthPucker", "poseElbowLeft", "bodySlim",
        ]
        self.assertEqual(select_morphs(authored, 1), authored[1:])
        self.assertEqual(select_morphs(authored, 2), [
            "muscleToned", "muscleAthletic", "muscleMuscular",
            "muscleBodybuilder", "blinkLeft", "jawOpen", "bodySlim",
        ])
        self.assertEqual(select_morphs(authored, 3), select_morphs(authored, 2))
        with self.assertRaisesRegex(ValueError, "LOD1"):
            select_morphs(authored, 0)
        with self.assertRaisesRegex(ValueError, "muscle"):
            require_muscle_keys(["muscleToned", "muscleAthletic", "muscleMuscular"])
        require_muscle_keys(authored)

    def test_rejects_retropology_vertices_too_far_from_original_sculpt(self):
        matches = [
            SurfaceMatch((0, 1, 2), (.3, .3, .4), .003),
            SurfaceMatch((0, 1, 2), (.2, .3, .5), .02),
        ]
        report = audit_matches(matches, .025)
        self.assertEqual(report["vertices"], 2)
        self.assertAlmostEqual(report["maxDistanceMm"], 20.)
        self.assertGreater(report["rmsDistanceMm"], 14.)
        with self.assertRaisesRegex(ValueError, "1 LOD vertices"):
            audit_matches(matches, .015)
        with self.assertRaisesRegex(ValueError, "no projected"):
            audit_matches([], .02)

    def test_bad_correspondence_distance_fails_without_silent_pass(self):
        for distance in [float("nan"), float("inf"), -1.]:
            with self.assertRaisesRegex(ValueError, "non-finite or negative"):
                audit_matches([SurfaceMatch((0, 1, 2), (.3, .3, .4), distance)], .025)
        with self.assertRaisesRegex(ValueError, "between 1mm"):
            audit_matches([SurfaceMatch((0, 1, 2), (.3, .3, .4), 0.)], .0001)


if __name__ == "__main__":
    unittest.main()
