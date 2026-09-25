"""Guard downloaded real-source authoring packs against false readiness."""
import hashlib
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from verify_source_artifacts import verify_artifacts  # noqa: E402


class AuthoringArtifactIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        self.data = {
            "schema": "rockmundo.avatar-v2-real-source-artifacts",
            "version": 1,
            "source": "blender-human-base-meshes-v1.4.1",
            "sourceLicense": "CC0-1.0",
            "assetStatus": "authoring-reference-only",
            "releaseEligible": False,
            "frames": [],
            "files": [],
        }
        for frame in ("masculine", "feminine"):
            names = {
                "sourceBlend": f"{frame}-source.blend",
                "guideBlend": f"{frame}-unfitted-rig-guide.blend",
                "fitHandlesBlend": f"{frame}-joint-handles.blend",
                "candidatePreview": f"{frame}-SOURCE-ONLY-not-validated.glb",
                "lookdevBlend": f"{frame}-artist-lookdev.blend",
                "lookdevPreview": f"{frame}-LOOKDEV-ONLY-not-validated.glb",
            }
            views = [f"{frame}-{angle}.png" for angle in ("front", "quarter", "side", "face")]
            styled_views = [f"{frame}-lookdev-{angle}.png" for angle in ("front", "quarter", "side", "face")]
            self.data["frames"].append({
                "frame": frame,
                **names,
                "contactViews": views,
                "lookdevViews": styled_views,
                "lookdevGeometry": {
                    "previewOnly": True,
                    "sculptComplete": False,
                    "jointFitComplete": False,
                    "originalBodyVertices": 32000,
                    "realEyesRecoloured": 2,
                    "realCorneasAdded": 2,
                    "realBrowAndLashMeshes": 6,
                    "browLashGeometry": [
                        {
                            "side": side,
                            "browVertices": 54,
                            "groomFibres": 76,
                            "upperLashFibres": 27,
                            "newGeometryVertices": 2050,
                            "rootProjection": "actual CC0 continuous frontal skin",
                            "unweightedPreviewOnly": True,
                        }
                        for side in ("L", "R")
                    ],
                    "eyeGeometry": [
                        {
                            "side": side,
                            "addedCorneaVertices": 240,
                            "existingEyeMaterialPolygons": {
                                "sclera": 480, "iris": 120, "pupil": 15,
                            },
                        }
                        for side in ("L", "R")
                    ],
                },
                "sourceVertices": 32000,
                "guideBones": 72,
                "fitMarkers": 95,
                "productionValidated": False,
                "requiresManualJointFit": True,
            })
            for name in [*names.values(), *views, *styled_views]:
                path = self.root / frame / name
                path.parent.mkdir(parents=True, exist_ok=True)
                header = (b"BLENDER" if path.suffix == ".blend" else
                          b"glTF" if path.suffix == ".glb" else
                          b"\x89PNG\r\n\x1a\n")
                content = header + name.encode("utf8") + b"0" * 1100
                path.write_bytes(content)
                self.data["files"].append({
                    "file": f"{frame}/{name}",
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                })
        self.write_manifest()

    def write_manifest(self):
        (self.root / "authoring-artifacts-manifest.json").write_text(
            json.dumps(self.data), encoding="utf8"
        )

    def test_complete_cc0_sources_are_authoring_only(self):
        report = verify_artifacts(self.root)
        self.assertTrue(report["passed"])
        self.assertEqual(report["verifiedFiles"], 28)
        self.assertFalse(report["productionValidated"])

    def test_never_certify_stock_source_as_production_ready(self):
        self.data["releaseEligible"] = True
        self.data["frames"][0]["productionValidated"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "production-ready"):
            verify_artifacts(self.root)

    def test_missing_feminine_faces_are_rejected(self):
        self.data["frames"][1]["contactViews"] = ["feminine-front.png"]
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "four real source proof views"):
            verify_artifacts(self.root)

    def test_modified_glb_bytes_are_rejected(self):
        (self.root / "masculine/masculine-SOURCE-ONLY-not-validated.glb").write_bytes(
            b"glTF" + b"1" * 1200
        )
        with self.assertRaisesRegex(ValueError, "modified authoring file"):
            verify_artifacts(self.root)

    def test_traversal_in_manifest_cannot_escape_authoring_directory(self):
        self.data["files"][0]["file"] = "../public/avatar-v2/base-lod0.glb"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "Unsafe authoring file path"):
            verify_artifacts(self.root)

    def test_cannot_omit_fitted_rig_handles_or_keep_fewer_bones(self):
        self.data["frames"][0]["fitMarkers"] = 5
        self.data["frames"][1]["requiresManualJointFit"] = False
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "fitMarkers"):
            verify_artifacts(self.root)

    def test_missing_original_source_geometry_is_rejected(self):
        self.data["frames"][1]["sourceVertices"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "sourceVertices"):
            verify_artifacts(self.root)

    def test_detached_or_absent_lash_groom_is_rejected(self):
        self.data["frames"][0]["lookdevGeometry"]["browLashGeometry"][0]["rootProjection"] = "guessed"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "skin-projected eyebrow"):
            verify_artifacts(self.root)

    def test_missing_eyelid_fibres_are_rejected(self):
        self.data["frames"][1]["lookdevGeometry"]["browLashGeometry"][1]["upperLashFibres"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "skin-projected eyebrow"):
            verify_artifacts(self.root)

    def test_do_not_certify_unweighted_brows_as_finished(self):
        self.data["frames"][0]["lookdevGeometry"]["browLashGeometry"][0]["unweightedPreviewOnly"] = False
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "skin-projected eyebrow"):
            verify_artifacts(self.root)

    def test_missing_real_iris_or_cornea_geometry_is_rejected(self):
        self.data["frames"][0]["lookdevGeometry"]["eyeGeometry"][0]["addedCorneaVertices"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "cornea surface data"):
            verify_artifacts(self.root)

    def test_styled_lookdev_is_not_falsely_labelled_as_complete_sculpt(self):
        self.data["frames"][1]["lookdevGeometry"]["sculptComplete"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "completed V2 model"):
            verify_artifacts(self.root)

    def test_missing_styled_source_proof_views_fail_closed(self):
        self.data["frames"][0]["lookdevViews"] = ["masculine-lookdev-front.png"]
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "eye/skin lookdev proof views"):
            verify_artifacts(self.root)

    def test_identical_raw_and_styled_glb_hashes_cannot_pass(self):
        baseline = self.data["frames"][0]["candidatePreview"]
        styled = self.data["frames"][0]["lookdevPreview"]
        raw = next(item for item in self.data["files"] if item["file"] == f"masculine/{baseline}")
        shaded = next(item for item in self.data["files"] if item["file"] == f"masculine/{styled}")
        shaded["sha256"] = raw["sha256"]
        (self.root / "masculine" / styled).write_bytes(
            (self.root / "masculine" / baseline).read_bytes()
        )
        shaded["bytes"] = (self.root / "masculine" / styled).stat().st_size
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "identical"):
            verify_artifacts(self.root)


if __name__ == "__main__":
    unittest.main()
