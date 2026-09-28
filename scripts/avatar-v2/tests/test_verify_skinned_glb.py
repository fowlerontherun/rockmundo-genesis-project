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
    """Generate complete, readable GLB 2.0 binary fixtures (not JSON-only fakes)."""
    binary = bytearray()
    views = []
    arities = {"SCALAR": 1, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    formats = {5121: "B", 5123: "H", 5126: "f"}
    widths = {5121: 1, 5123: 2, 5126: 4}
    for index, accessor in enumerate(doc.get("accessors", [])):
        component = accessor.setdefault("componentType", 5126)
        shape = accessor["type"]
        count = accessor["count"]
        arity = arities[shape]
        start = len(binary)
        if start % widths[component]:
            binary.extend(b"\x00" * (-start % widths[component]))
            start = len(binary)
        for _ in range(count):
            if shape == "MAT4":
                values = [1 if k in (0, 5, 10, 15) else 0 for k in range(16)]
            elif index == 2:  # Default WEIGHTS_0 (works with integer tests too)
                values = [{5121: 255, 5123: 65535, 5126: 1}[component], 0, 0, 0]
            else:
                values = [0] * arity
            binary.extend(struct.pack("<" + formats[component] * arity, *values))
        accessor["bufferView"] = len(views)
        views.append({"buffer": 0, "byteOffset": start, "byteLength": len(binary) - start})
    doc["bufferViews"] = views
    doc["buffers"] = [{"byteLength": len(binary)}]
    binary.extend(b"\x00" * (-len(binary) % 4))
    data = json.dumps(doc).encode("utf-8")
    data += b" " * (-len(data) % 4)
    return (b"glTF" + struct.pack("<II", 2, 28 + len(data) + len(binary))
            + struct.pack("<I4s", len(data), b"JSON") + data
            + struct.pack("<I4s", len(binary), b"BIN\x00") + binary)


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
        self.path.write_bytes(glb(self.valid()) + b"\x08\x00\x00\x00BIN\x00")
        raw = bytearray(self.path.read_bytes())
        struct.pack_into("<I", raw, 8, len(raw))
        self.path.write_bytes(raw)
        with self.assertRaisesRegex(ValueError, "Malformed GLB chunk"):
            gate.inspect(self.path)

    def patch_binary(self, doc, accessor, fmt, *values):
        raw = bytearray(glb(doc))
        json_length = struct.unpack_from("<I", raw, 12)[0]
        view = doc["bufferViews"][doc["accessors"][accessor]["bufferView"]]
        offset = 20 + json_length + 8 + view["byteOffset"]
        struct.pack_into(fmt, raw, offset, *values)
        self.path.write_bytes(raw)
        return self.path

    def test_real_binary_rejects_out_of_range_vertex_joint(self):
        doc = self.valid()
        with self.assertRaisesRegex(ValueError, "JOINTS_0 index"):
            gate.inspect(self.patch_binary(doc, 1, "<H", 65000))

    def test_real_binary_rejects_non_normalised_weights(self):
        doc = self.valid()
        with self.assertRaisesRegex(ValueError, "not normalised"):
            gate.inspect(self.patch_binary(doc, 2, "<4f", 0.8, 0.8, 0, 0))

    def test_real_binary_rejects_non_finite_weights(self):
        doc = self.valid()
        with self.assertRaisesRegex(ValueError, "Non-finite"):
            gate.inspect(self.patch_binary(doc, 2, "<f", float("nan")))

    def test_real_binary_rejects_buffer_view_overrun(self):
        doc = self.valid()
        doc["accessors"][1]["byteOffset"] = 10000
        with self.assertRaisesRegex(ValueError, "bufferView bounds"):
            gate.inspect(self.write(doc))

    def test_real_binary_rejects_non_finite_inverse_bind_matrices(self):
        doc = self.valid()
        doc["skins"][0]["inverseBindMatrices"] = 3
        doc["accessors"].append({"count": len(gate.REQUIRED), "type": "MAT4", "componentType": 5126})
        with self.assertRaisesRegex(ValueError, "Non-finite inverse"):
            gate.inspect(self.patch_binary(doc, 3, "<f", float("nan")))

    def test_json_only_skin_is_not_valid_binary_evidence(self):
        raw = glb(self.valid())
        json_length = struct.unpack_from("<I", raw, 12)[0]
        without_bin = bytearray(raw[:20 + json_length])
        struct.pack_into("<I", without_bin, 8, len(without_bin))
        self.path.write_bytes(without_bin)
        with self.assertRaisesRegex(ValueError, "BIN chunk"):
            gate.inspect(self.path)

    def test_truncated_glb_rejected(self):
        self.path.write_bytes(b"glTF")
        with self.assertRaises(ValueError):
            gate.inspect(self.path)


if __name__ == "__main__":
    unittest.main()
