"""Preview publication must fail closed and never claim V2 production readiness."""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from publish_reference_previews import publish_references, preview_names  # noqa: E402


class ReferencePreviewPublicationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name) / "full-authoring"
        self.output = pathlib.Path(self.tmp.name) / "public-preview"
        self.root.mkdir()
        self.frames = [preview_names("masculine"), preview_names("feminine")]
        for frame in self.frames:
            for name in (
                frame["source"], frame["lookdev"], frame["headMotion"],
                *frame["sourceViews"].values(), *frame["lookdevViews"].values(),
                *frame["headMotionViews"].values(),
            ):
                path = self.root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((b"glTF" if name.endswith(".glb") else b"\x89PNG\r\n\x1a\n") + b"x" * 2048)
        self.source_manifest = {
            "releaseEligible": False, "sourceArchiveSha256": "a" * 64,
            "frames": [{
                "frame": frame,
                "headMotionExperiment": {
                    "schema": "rockmundo.avatar-v2-head-rig-experiment",
                    "version": 1,
                    "frame": frame,
                    "preview": preview_names(frame)["headMotion"].split("/")[-1],
                    "views": [
                        preview_names(frame)["headMotionViews"][view].split("/")[-1]
                        for view in ("front", "quarter", "side", "face")
                    ],
                    "headTurnDegrees": 16,
                    "eyeCounterTurnDegrees": -7,
                    "headMeanDisplacementMm": 25.,
                    "torsoMeanDisplacementMm": 0.,
                    "eyeMeanDisplacementMm": {"L": 16., "R": 15.},
                    "gltfJointCount": 65,
                    "gltfSkinnedPrimitives": 11,
                    "actualSkinBuffers": True,
                    "draftWeightsOnly": True,
                    "guideHeadPivotStillUnfitted": True,
                    "artistReviewed": False,
                    "fullBodySkinned": False,
                    "faceMorphsAuthored": False,
                    "productionValidated": False,
                },
                "sourceJointSuggestions": {
                    "schema": "rockmundo.avatar-v2-source-joint-suggestions",
                    "version": 1,
                    "frame": frame,
                    "artistReviewed": False, "rigFitted": False,
                    "skinWeightsAuthored": False,
                    "suggestions": [
                        {"bone": bone, "position": [0, 0, 1], "sourceSamples": 100,
                         "realSourceGeometry": True, "artistReviewed": False}
                        for bone in ("Eye.L", "Eye.R", "EarAnchor.L", "EarAnchor.R")
                    ],
                },
            } for frame in ("masculine", "feminine")],
        }
        (self.root / "authoring-artifacts-manifest.json").write_text(
            json.dumps(self.source_manifest),
        )

    def test_publishes_only_verified_preview_images_and_unrigged_glbs(self):
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            manifest = publish_references(self.root, self.output)
        self.assertEqual(len(manifest["files"]), 30)
        self.assertFalse(manifest["productionValidated"])
        self.assertTrue(manifest["previewOnly"])
        self.assertEqual({f["frame"] for f in manifest["frames"]}, {"masculine", "feminine"})
        self.assertEqual(len(manifest["frames"][0]["sourceJointSuggestions"]["suggestions"]), 4)
        self.assertTrue(manifest["frames"][0]["headMotionEvidence"]["actualSkinBuffers"])
        self.assertFalse(manifest["frames"][0]["headMotionEvidence"]["fullBodySkinned"])
        self.assertEqual(len(list(self.output.rglob("*.blend"))), 0)
        self.assertEqual(len(list(self.output.rglob("*.glb"))), 6)
        for entry in manifest["files"]:
            self.assertTrue((self.output / entry["file"]).exists())

    def test_does_not_publish_when_full_source_pack_fails_audit(self):
        with patch("publish_reference_previews.verify_artifacts", side_effect=ValueError("invalid GLB hash")):
            with self.assertRaisesRegex(ValueError, "invalid GLB hash"):
                publish_references(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_rejects_missing_source_joint_proof_even_when_hash_verifier_is_mocked(self):
        self.source_manifest["frames"][1].pop("sourceJointSuggestions")
        (self.root / "authoring-artifacts-manifest.json").write_text(
            json.dumps(self.source_manifest),
        )
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            with self.assertRaisesRegex(ValueError, "unreviewed anatomical guide"):
                publish_references(self.root, self.output)

    def test_rejects_fake_production_ready_head_experiment_and_absent_actual_skin(self):
        self.source_manifest["frames"][0]["headMotionExperiment"]["productionValidated"] = True
        (self.root / "authoring-artifacts-manifest.json").write_text(
            json.dumps(self.source_manifest),
        )
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            with self.assertRaisesRegex(ValueError, "head rig is not verified"):
                publish_references(self.root, self.output)
        self.source_manifest["frames"][0]["headMotionExperiment"]["productionValidated"] = False
        self.source_manifest["frames"][0]["headMotionExperiment"]["actualSkinBuffers"] = False
        (self.root / "authoring-artifacts-manifest.json").write_text(
            json.dumps(self.source_manifest),
        )
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            with self.assertRaisesRegex(ValueError, "head rig is not verified"):
                publish_references(self.root, self.output)

    def test_refuses_existing_gallery_and_production_claims(self):
        self.output.mkdir()
        (self.output / "old.png").write_bytes(b"stale")
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            with self.assertRaisesRegex(ValueError, "Refusing to overwrite"):
                publish_references(self.root, self.output)
        (self.root / "authoring-artifacts-manifest.json").write_text(json.dumps({
            "releaseEligible": True, "sourceArchiveSha256": "a" * 64,
        }))
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            with self.assertRaisesRegex(ValueError, "cannot be released"):
                publish_references(self.root, pathlib.Path(self.tmp.name) / "another")


if __name__ == "__main__":
    unittest.main()
