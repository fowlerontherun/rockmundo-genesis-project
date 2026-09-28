"""Regression tests for fail-closed Avatar V2 GLB structural inspection."""
import importlib.util
import json
import pathlib
import struct
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "verify_skinned_glb.py"
spec = importlib.util.spec_from_file_location("verify_skinned_glb", SCRIPT)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def glb(doc):
    data = json.dumps(doc).encode("utf-8")
    data += b" " * (-len(data) % 4)
    return b"glTF" + struct.pack("<II", 2, 20 + len(data)) + struct.pack("<I4s", len(data), b"JSON") + data


class StructuralSkinGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = pathlib.Path(self.temp.name) / "candidate.glb"

    def write(self, doc):
        self.path.write_bytes(glb(doc))
        return self.path

    def valid(self):
        names = sorted(gate.REQUIRED)
        return {
            "nodes": [{"name": name} for name in names] + [{"mesh": 0, "skin": 0}],
            "skins": [{"joints": list(range(len(names)))}],
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "JOINTS_0": 1, "WEIGHTS_0": 2}}]}],
            "accessors": [{"count": 4, "type": "VEC3"}, {"count": 4, "type": "VEC4", "componentType": 5123}, {"count": 4, "type": "VEC4", "componentType": 5126}],
        }

    def test_valid_structural_candidate(self):
        self.assertEqual(gate.inspect(self.write(self.valid()))["skinned_primitives"], 1)

    def test_static_mesh_rejected(self):
        doc = self.valid()
        doc["skins"] = []
        with self.assertRaisesRegex(ValueError, "No glTF skins"):
            gate.inspect(self.write(doc))

    def test_missing_bone_rejected(self):
        doc = self.valid()
        doc["nodes"][0]["name"] = "wrong"
        with self.assertRaisesRegex(ValueError, "Missing runtime bones"):
            gate.inspect(self.write(doc))

    def test_mismatched_weights_rejected(self):
        doc = self.valid()
        doc["accessors"][2]["count"] = 3
        with self.assertRaisesRegex(ValueError, "vertex counts differ"):
            gate.inspect(self.write(doc))

    def test_out_of_range_joint_rejected(self):
        doc = self.valid()
        doc["skins"][0]["joints"].append(999)
        with self.assertRaisesRegex(ValueError, "No valid skin"):
            gate.inspect(self.write(doc))

    def test_garment_subset_accepted_but_body_rejected(self):
        doc = self.valid()
        doc["skins"][0]["joints"] = [sorted(gate.REQUIRED).index("Hips")]
        self.assertEqual(gate.inspect(self.write(doc), garment=True)["skinned_primitives"], 1)
        with self.assertRaisesRegex(ValueError, "No valid skin"):
            gate.inspect(self.path)

    def test_garment_unknown_joint_rejected(self):
        doc = self.valid()
        doc["skins"][0]["joints"] = [0]
        doc["nodes"][0]["name"] = "not_a_runtime_bone"
        with self.assertRaisesRegex(ValueError, "No valid skin"):
            gate.inspect(self.write(doc), garment=True)

    def test_unskinned_second_mesh_rejected(self):
        doc = self.valid()
        doc["nodes"].append({"mesh": 0})
        with self.assertRaisesRegex(ValueError, "Unskinned mesh"):
            gate.inspect(self.write(doc))

    def test_second_mesh_bound_to_incomplete_body_skin_rejected(self):
        doc = self.valid()
        doc["skins"].append({"joints": [0]})
        doc["nodes"].append({"mesh": 0, "skin": 1})
        with self.assertRaisesRegex(ValueError, "Bound body skin"):
            gate.inspect(self.write(doc))

    def test_second_garment_skin_without_runtime_joint_rejected(self):
        doc = self.valid()
        doc["nodes"].append({"name": "custom_non_runtime_joint"})
        doc["skins"].append({"joints": [len(doc["nodes"]) - 1]})
        doc["nodes"].append({"mesh": 0, "skin": 1})
        with self.assertRaisesRegex(ValueError, "Bound garment skin"):
            gate.inspect(self.write(doc), garment=True)

    def test_integer_weights_must_be_normalized(self):
        doc = self.valid()
        doc["accessors"][2]["componentType"] = 5123
        with self.assertRaisesRegex(ValueError, "must be normalized"):
            gate.inspect(self.write(doc))

    def test_duplicate_skin_joint_rejected(self):
        doc = self.valid()
        doc["skins"][0]["joints"].append(0)
        with self.assertRaisesRegex(ValueError, "Duplicate joint"):
            gate.inspect(self.write(doc))

    def test_inverse_bind_count_mismatch_rejected(self):
        doc = self.valid()
        doc["skins"][0]["inverseBindMatrices"] = len(doc["accessors"])
        doc["accessors"].append({"count": 1, "type": "MAT4", "componentType": 5126})
        with self.assertRaisesRegex(ValueError, "Inverse bind matrices"):
            gate.inspect(self.write(doc))

    def test_malformed_chunk_length_rejected(self):
        self.path.write_bytes(glb(self.valid()) + b"\\x08\\x00\\x00\\x00BIN\\x00")
        raw = bytearray(self.path.read_bytes())
        struct.pack_into("<I", raw, 8, len(raw))
        self.path.write_bytes(raw)
        with self.assertRaisesRegex(ValueError, "Malformed GLB chunk"):
            gate.inspect(self.path)

    def test_truncated_glb_rejected(self):
        self.path.write_bytes(b"glTF")
        with self.assertRaises(ValueError):
            gate.inspect(self.path)


if __name__ == "__main__":
    unittest.main()
