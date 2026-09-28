"""Phase 0: real public-asset quarantine and promotion regression tests."""
import importlib.util
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "validate_production_glbs.py"
sys.path.insert(0, str(SCRIPT.parent))
spec = importlib.util.spec_from_file_location("validate_production_glbs", SCRIPT)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class ProductionGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.public = self.root / "public" / "avatar-v2"
        (self.public / "clothing").mkdir(parents=True)
        old = (gate.ROOT, gate.PUBLIC, gate.EVIDENCE, gate.SOURCE)
        gate.ROOT, gate.PUBLIC = self.root, self.public
        gate.SOURCE = self.root / "art-source" / "avatar-v2"
        gate.EVIDENCE = gate.SOURCE / "evidence"
        self.addCleanup(lambda: (
            setattr(gate, "ROOT", old[0]),
            setattr(gate, "PUBLIC", old[1]),
            setattr(gate, "EVIDENCE", old[2]),
            setattr(gate, "SOURCE", old[3]),
        ))
        self.body = {
            "schema": "rockmundo.avatar-v2-assets", "contractVersion": "2.0",
            "assetVersion": "v2-alpha-1",
            "assets": [
                {"frame": frame, "lod": lod,
                 "file": f"{frame}/base-lod{lod}.glb", "status": "planned"}
                for frame in gate.FRAMES for lod in gate.LODS
            ],
        }
        self.garment = {
            "schema": "rockmundo.avatar-v2-garments", "version": 1,
            "assetVersion": "v2-alpha-1", "items": [],
        }
        self.save()

    def save(self):
        (self.public / "manifest.json").write_text(json.dumps(self.body))
        (self.public / "clothing" / "manifest.json").write_text(json.dumps(self.garment))

    def test_planned_and_absent_production_assets_are_quarantined(self):
        report = gate.validate()
        self.assertEqual(report["inspectedPaths"], 8)

    def test_unapproved_source_is_never_auto_promoted(self):
        path = self.root / "art-source" / "avatar-v2" / "source-only.glb"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"glTF")
        self.assertEqual(gate.validate()["result"], "pass")

    def test_asset_ready_requires_a_real_binary(self):
        self.body["assets"][0]["status"] = "asset_ready"
        self.save()
        with self.assertRaisesRegex(ValueError, "no real binary"):
            gate.validate()

    def test_validated_requires_separate_review_evidence(self):
        self.body["assets"][0]["status"] = "validated"
        filename = self.public / "masculine" / "base-lod0.glb"
        filename.parent.mkdir(parents=True)
        filename.write_bytes(b"fake GLB; mocked inspection only")
        self.save()
        with patch.object(gate, "inspect", return_value={"result": "binary_pass_only"}):
            with self.assertRaisesRegex(ValueError, "versioned QA evidence"):
                gate.validate()

    def reviewed_body(self):
        """Construct a complete review fixture, never a production art asset."""
        item = self.body["assets"][0]
        item["status"] = "validated"
        binary = self.public / "masculine" / "base-lod0.glb"
        binary.parent.mkdir(parents=True, exist_ok=True)
        binary.write_bytes(b"mock binary; inspected separately in test suite")
        editable = gate.SOURCE / "masculine" / "base.blend"
        editable.parent.mkdir(parents=True, exist_ok=True)
        editable.write_bytes(b"BLENDER" + b"editable source fixture")
        proofs = {}
        gate.EVIDENCE.mkdir(parents=True, exist_ok=True)
        for view in ("front", "side", "back", "performance"):
            image = gate.EVIDENCE / f"masculine-lod0-{view}.png"
            image.write_bytes(b"\x89PNG\r\n\x1a\n" + view.encode())
            proofs[view] = {
                "path": image.relative_to(self.root).as_posix(),
                "sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
            }
        evidence = {
            "schema": "rockmundo.avatar-v2-qa-evidence", "version": 1,
            "kind": "body", "frame": "masculine", "lod": 0,
            "assetVersion": "v2-alpha-1",
            "assetPath": "avatar-v2/masculine/base-lod0.glb",
            "sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
            "sourceOnly": False, "rigReviewed": True, "visualApproved": True,
            "performanceApproved": True,
            "author": "artist-one", "reviewer": "reviewer-two",
            "approvedAt": "2025-09-01T12:00:00Z",
            "sourceFile": editable.relative_to(self.root).as_posix(),
            "sourceSha256": hashlib.sha256(editable.read_bytes()).hexdigest(),
            "proofFiles": proofs,
        }
        record = gate.EVIDENCE / "masculine-lod0.json"
        record.write_text(json.dumps(evidence))
        item["qaEvidence"] = record.relative_to(self.root).as_posix()
        self.save()
        return evidence, record

    def test_real_source_and_four_hashed_proofs_allow_independent_review(self):
        self.reviewed_body()
        with patch.object(gate, "inspect", return_value={"result": "binary_pass_only"}):
            self.assertEqual(gate.validate()["result"], "pass")

    def test_evidence_requires_an_independent_reviewer(self):
        evidence, record = self.reviewed_body()
        evidence["reviewer"] = evidence["author"]
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "independent QA reviewer"):
                gate.validate()

    def test_evidence_rejects_missing_or_non_utc_approval(self):
        evidence, record = self.reviewed_body()
        evidence["approvedAt"] = "tomorrow"
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "UTC approvedAt"):
                gate.validate()

    def test_evidence_rejects_forged_source_digest(self):
        evidence, record = self.reviewed_body()
        evidence["sourceSha256"] = "0" * 64
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "editable source checksum"):
                gate.validate()

    def test_evidence_rejects_duplicated_or_missing_views(self):
        evidence, record = self.reviewed_body()
        del evidence["proofFiles"]["back"]
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "front/side/back/performance"):
                gate.validate()

    def test_evidence_rejects_tampered_proof_image(self):
        evidence, record = self.reviewed_body()
        image = self.root / evidence["proofFiles"]["front"]["path"]
        image.write_bytes(image.read_bytes() + b"tampered")
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "altered front QA proof"):
                gate.validate()

    def test_evidence_rejects_mismatched_asset_version(self):
        evidence, record = self.reviewed_body()
        evidence["assetVersion"] = "older-release"
        record.write_text(json.dumps(evidence))
        with patch.object(gate, "inspect", return_value={}):
            with self.assertRaisesRegex(ValueError, "evidence mismatches"):
                gate.validate()

    def test_duplicate_base_entry_is_rejected(self):
        self.body["assets"].append(dict(self.body["assets"][0]))
        self.save()
        with self.assertRaisesRegex(ValueError, "Duplicate base"):
            gate.validate()

    def test_unregistered_binary_cannot_land_under_public(self):
        filename = self.public / "references" / "preview-only.glb"
        filename.parent.mkdir(parents=True)
        filename.write_bytes(b"glTF")
        with self.assertRaisesRegex(ValueError, "Unregistered GLBs"):
            gate.validate()

    def test_planned_manifest_with_present_invalid_glb_fails(self):
        filename = self.public / "masculine" / "base-lod0.glb"
        filename.parent.mkdir(parents=True)
        filename.write_bytes(b"glTF")
        with self.assertRaisesRegex(ValueError, "Not a glTF"):
            gate.validate()

    def test_wrong_frame_routing_cannot_pass(self):
        self.body["assets"][0]["file"] = "feminine/base-lod0.glb"
        self.save()
        with self.assertRaisesRegex(ValueError, "Incorrect body asset path"):
            gate.validate()

    def test_mismatched_asset_version_is_rejected(self):
        self.garment["assetVersion"] = "v2-legacy"
        self.save()
        with self.assertRaisesRegex(ValueError, "asset versions differ"):
            gate.validate()

    def test_validated_partial_garment_cannot_ship(self):
        item = {
            "itemKey": "clothing.test.fixture", "status": "validated",
            "frames": {"masculine": {}, "feminine": {}},
        }
        self.garment["items"] = [item]
        self.save()
        with self.assertRaisesRegex(ValueError, "all eight"):
            gate.validate()


if __name__ == "__main__":
    unittest.main()
