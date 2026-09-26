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
                "headRigScene": f"{frame}-head-rig-experiment-UNAPPROVED.blend",
                "headRigPreview": f"{frame}-HEAD-RIG-EXPERIMENT-not-validated.glb",
                "starterBlend": f"{frame}-starter-four-tee-prototypes-UNAPPROVED.blend",
            }
            views = [f"{frame}-{angle}.png" for angle in ("front", "quarter", "side", "face")]
            styled_views = [f"{frame}-lookdev-{angle}.png" for angle in ("front", "quarter", "side", "face")]
            head_motion_views = [
                f"{frame}-head-rig-experiment-{angle}.png"
                for angle in ("front", "quarter", "side", "face")
            ]
            starter_styles = {
                "logo-tee": "clothing.starter.logo-tee",
                "plain-black-tee": "clothing.starter.plain-black-tee",
                "plain-white-tee": "clothing.starter.plain-white-tee",
                "vintage-charcoal-tee": "clothing.starter.vintage-charcoal-tee",
            }
            starter_variants = [
                {
                    "catalogueKey": key,
                    "name": style,
                    "style": style,
                    "preview": f"{frame}-starter-{style}-LOOKDEV-ONLY-not-validated.glb",
                    "views": {
                        angle: f"{frame}-starter-{style}-{angle}.png"
                        for angle in ("front", "quarter")
                    },
                    "actualOriginalCC0SourceSurface": True,
                    "sourceSurface": {
                        "sourceBody": "genuineOriginalCC0",
                        "sourceTotalVertices": 34000,
                        "sourceSelectedFaces": 1850,
                        "sourceSurfaceVertices": 1780,
                        "originalSurfaceConforming": True,
                        "smoothingReprojectedOnOriginalCC0": True,
                        "boundarySmoothingIterations": 10,
                        "smoothedRealBoundaryVertices": 102,
                        "postSmoothingBoundaryClearanceMm": 14.,
                        "largestConnectedOriginalComponent": True,
                        "sculptDerivedShortSleeves": True,
                        "sculptDerivedNeckCut": True,
                        "manualGarmentFitRequired": True,
                        "productionValidated": False,
                        "minimumOffsetMm": 14., "maximumOffsetMm": 14.,
                        "averageOffsetMm": 14.,
                    },
                    "authoringBoundaryEdges": 230,
                    "brand": {
                        "realCurvedPrintFaces": 42,
                        "actualOriginalBrandImage": "src/assets/rockmundo-logo.png",
                        "printOffsetMm": .65,
                        "usesExistingBrandArtwork": True,
                        "previewOnly": True,
                    } if style == "logo-tee" else None,
                    "requiresManualFullBodyRigAndGarmentWeighting": True,
                    "realGarmentArtistApproved": False,
                    "productionValidated": False,
                    "gltfMeshCount": 15,
                    "gltfSourceMappedShirt": True,
                    "gltfRealSurfaceHems": True,
                    "gltfConformingOriginalLogo": style == "logo-tee",
                    "gltfHasSkinning": False,
                    "gltfHasAnimations": False,
                }
                for style, key in starter_styles.items()
            ]
            starter_files = [
                name for item in starter_variants
                for name in [item["preview"], *item["views"].values()]
            ]
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
                    "realLipMaterials": {
                        "upperLipPolygons": 28,
                        "lowerLipPolygons": 40,
                        "edgeBlendPolygons": 50,
                        "sourceVertexCountPreserved": True,
                        "sourceUVCountPreserved": True,
                        "sourceSculptLipShape": "existing CC0 geometry, unchanged",
                        "previewOnly": True,
                        "lipDeformationAuthored": False,
                    },
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
                "starterTeePrototypes": {
                    "schema": "rockmundo.avatar-v2-starter-tee-authoring-proofs",
                    "version": 1, "frame": frame,
                    "scene": names["starterBlend"],
                    "realCC0Body": "genuineOriginalCC0",
                    "variants": starter_variants,
                    "oldCatalogueKeysUnchanged": True,
                    "noDatabaseItemsCreated": True,
                    "fullRigValidated": False,
                    "artistApproved": False,
                    "productionValidated": False,
                },
                "headMotionExperiment": {
                    "schema": "rockmundo.avatar-v2-head-rig-experiment",
                    "version": 1,
                    "frame": frame,
                    "scene": names["headRigScene"],
                    "preview": names["headRigPreview"],
                    "views": head_motion_views,
                    "realCC0MeshesBound": 11,
                    "sampledHeadVertices": 280,
                    "sampledStableTorsoVertices": 600,
                    "headTurnDegrees": 16,
                    "eyeCounterTurnDegrees": -7,
                    "headMeanDisplacementMm": 20.0,
                    "torsoMeanDisplacementMm": 0.01,
                    "eyeMeanDisplacementMm": {"L": 19.4, "R": 19.3},
                    "maxInfluences": 2,
                    "eyeCentresFromRealGeometry": True,
                    "guideHeadPivotStillUnfitted": True,
                    "draftWeightsOnly": True,
                    "artistReviewed": False,
                    "fullBodySkinned": False,
                    "faceMorphsAuthored": False,
                    "productionValidated": False,
                    "gltfSkins": 1,
                    "gltfSkinnedPrimitives": 11,
                    "gltfJointCount": 65,
                    "actualSkinBuffers": True,
                },
                "sourceJointSuggestions": {
                    "schema": "rockmundo.avatar-v2-source-joint-suggestions",
                    "version": 1,
                    "frame": frame,
                    "source": "actual CC0 eyeball and continuous body vertices",
                    "eyeRadiiMm": {"L": 36.0, "R": 36.0},
                    "artistReviewed": False,
                    "rigFitted": False,
                    "skinWeightsAuthored": False,
                    "suggestions": [
                        {
                            "bone": bone,
                            "position": [
                                .052 if side == "L" else -.052,
                                -.035,
                                1.56 if prefix == "Eye" else 1.50,
                            ],
                            "armatureLocal": [
                                .052 if side == "L" else -.052,
                                -.035,
                                1.56 if prefix == "Eye" else 1.50,
                            ],
                            "sourceMesh": "real_CC0_eye" if prefix == "Eye" else "real_CC0_body",
                            "sourceSamples": 400 if prefix == "Eye" else 12,
                            "realSourceGeometry": True,
                            "artistReviewed": False,
                        }
                        for prefix in ("Eye", "EarAnchor")
                        for side in ("L", "R")
                        for bone in (f"{prefix}.{side}",)
                    ],
                },
                "sourceVertices": 32000,
                "guideBones": 72,
                "fitMarkers": 95,
                "productionValidated": False,
                "requiresManualJointFit": True,
            })
            for name in [*names.values(), *views, *styled_views, *head_motion_views, *starter_files]:
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
        self.assertEqual(report["verifiedFiles"], 66)
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

    def test_ragged_unchanged_or_detached_cloth_edge_cannot_ship_as_starter_proof(self):
        surface = self.data["frames"][0]["starterTeePrototypes"]["variants"][1]["sourceSurface"]
        surface["smoothingReprojectedOnOriginalCC0"] = False
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "unverified CC0-derived garment"):
            verify_artifacts(self.root)
        surface["smoothingReprojectedOnOriginalCC0"] = True
        surface["postSmoothingBoundaryClearanceMm"] = 50
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "unverified CC0-derived garment"):
            verify_artifacts(self.root)

    def test_missing_real_starter_chest_artwork_is_rejected(self):
        self.data["frames"][0]["starterTeePrototypes"]["variants"][0]["brand"] = None
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "logo art must be UV-fitted"):
            verify_artifacts(self.root)

    def test_false_certification_of_an_existing_starter_garment_is_rejected(self):
        self.data["frames"][1]["starterTeePrototypes"]["variants"][0]["productionValidated"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "unverified CC0-derived garment"):
            verify_artifacts(self.root)

    def test_starter_tee_proofs_reject_fake_or_missing_item_variants(self):
        self.data["frames"][1]["starterTeePrototypes"]["variants"].pop()
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "four exact existing"):
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

    def test_missing_lip_material_zones_are_rejected(self):
        self.data["frames"][0]["lookdevGeometry"]["realLipMaterials"]["upperLipPolygons"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "upper/lower lip sculpt"):
            verify_artifacts(self.root)

    def test_lip_shader_must_preserve_real_unmodified_uv_and_sculpt(self):
        self.data["frames"][1]["lookdevGeometry"]["realLipMaterials"]["sourceUVCountPreserved"] = False
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "upper/lower lip sculpt"):
            verify_artifacts(self.root)

    def test_unrigged_lip_material_cannot_claim_real_singing_deformation(self):
        self.data["frames"][0]["lookdevGeometry"]["realLipMaterials"]["lipDeformationAuthored"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "upper/lower lip sculpt"):
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

    def test_missing_real_joint_suggestions_are_rejected(self):
        self.data["frames"][0]["sourceJointSuggestions"]["suggestions"].pop()
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "four distinct measured"):
            verify_artifacts(self.root)

    def test_joint_guide_must_not_claim_artist_approval_or_skin_weights(self):
        self.data["frames"][0]["sourceJointSuggestions"]["rigFitted"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "already-certified"):
            verify_artifacts(self.root)

    def test_fake_ear_vertex_count_or_nan_coords_are_rejected(self):
        entry = self.data["frames"][1]["sourceJointSuggestions"]["suggestions"][2]
        entry["sourceSamples"] = 0
        entry["position"][1] = float("nan")
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "no valid unreviewed"):
            verify_artifacts(self.root)

    def test_absent_or_forged_experimental_rig_cannot_pass(self):
        self.data["frames"][0]["headMotionExperiment"]["fullBodySkinned"] = True
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "falsely certified experimental"):
            verify_artifacts(self.root)
        self.data["frames"][0]["headMotionExperiment"]["fullBodySkinned"] = False
        self.data["frames"][0]["headMotionExperiment"]["gltfSkinnedPrimitives"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "lacks measured"):
            verify_artifacts(self.root)

    def test_head_turn_must_actually_move_head_but_not_stable_torso(self):
        self.data["frames"][1]["headMotionExperiment"]["headMeanDisplacementMm"] = 0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "lacks measured"):
            verify_artifacts(self.root)
        self.data["frames"][1]["headMotionExperiment"]["headMeanDisplacementMm"] = 19.0
        self.data["frames"][1]["headMotionExperiment"]["torsoMeanDisplacementMm"] = 14.0
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "lacks measured"):
            verify_artifacts(self.root)

    def test_missing_actual_blender_proof_frame_is_rejected(self):
        self.data["frames"][0]["headMotionExperiment"]["views"].pop()
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "incomplete"):
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
