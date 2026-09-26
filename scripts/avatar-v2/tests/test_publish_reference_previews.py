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
                frame["source"], frame["lookdev"],
                *frame["sourceViews"].values(), *frame["lookdevViews"].values(),
            ):
                path = self.root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((b"glTF" if name.endswith(".glb") else b"\x89PNG\r\n\x1a\n") + b"x" * 2048)
        (self.root / "authoring-artifacts-manifest.json").write_text(json.dumps({
            "releaseEligible": False, "sourceArchiveSha256": "a" * 64,
        }))

    def test_publishes_only_verified_preview_images_and_unrigged_glbs(self):
        with patch("publish_reference_previews.verify_artifacts", return_value={"passed": True}):
            manifest = publish_references(self.root, self.output)
        self.assertEqual(len(manifest["files"]), 20)
        self.assertFalse(manifest["productionValidated"])
        self.assertTrue(manifest["previewOnly"])
        self.assertEqual({f["frame"] for f in manifest["frames"]}, {"masculine", "feminine"})
        self.assertEqual(len(list(self.output.rglob("*.blend"))), 0)
        self.assertEqual(len(list(self.output.rglob("*.glb"))), 4)
        for entry in manifest["files"]:
            self.assertTrue((self.output / entry["file"]).exists())

    def test_does_not_publish_when_full_source_pack_fails_audit(self):
        with patch("publish_reference_previews.verify_artifacts", side_effect=ValueError("invalid GLB hash")):
            with self.assertRaisesRegex(ValueError, "invalid GLB hash"):
                publish_references(self.root, self.output)
        self.assertFalse(self.output.exists())

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
