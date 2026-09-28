"""Fail-closed glTF 2.0 skinning gate for Avatar V2 body and garment exports.

Usage: python3 scripts/avatar-v2/verify_skinned_glb.py [--garment] file.glb [...]
No third-party dependencies. A passing result is structural only, NOT fit approval.
"""
import argparse
import json
import pathlib
import struct
import sys

REQUIRED = {"Hips", "Spine1", "Spine2", "Neck", "Head", "UpperArm.L",
            "LowerArm.L", "Hand.L", "UpperArm.R", "LowerArm.R", "Hand.R",
            "UpperLeg.L", "LowerLeg.L", "Foot.L", "UpperLeg.R",
            "LowerLeg.R", "Foot.R"}


def inspect(path, *, garment=False):
    raw = pathlib.Path(path).read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("Not a glTF 2.0 binary file")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("GLB header length mismatch")
    size, kind = struct.unpack_from("<I4s", raw, 12)
    if kind != b"JSON" or 20 + size > len(raw):
        raise ValueError("Missing or truncated JSON chunk")
    # A GLB JSON chunk is four-byte aligned; reject malformed trailing chunks.\n    if size % 4:\n        raise ValueError("Unaligned GLB JSON chunk")\n    offset = 20 + size\n    binary_chunks = []\n    while offset < len(raw):\n        if offset + 8 > len(raw):\n            raise ValueError("Truncated GLB chunk header")\n        chunk_size, chunk_kind = struct.unpack_from("<I4s", raw, offset)\n        offset += 8\n        if chunk_size % 4 or offset + chunk_size > len(raw):\n            raise ValueError("Malformed GLB chunk length")\n        if chunk_kind == b"BIN\\x00":\n            binary_chunks.append(chunk_size)\n        offset += chunk_size\n    if len(binary_chunks) > 1:\n        raise ValueError("Multiple GLB BIN chunks")\n    doc = json.loads(raw[20:20 + size])
    nodes, skins, meshes, accessors = (doc.get(k, []) for k in ("nodes", "skins", "meshes", "accessors"))
    if not isinstance(nodes, list) or not isinstance(skins, list) or not isinstance(meshes, list) or not isinstance(accessors, list):
        raise ValueError("Invalid glTF top-level arrays")
    if not skins:
        raise ValueError("No glTF skins")
    if any(not isinstance(node, dict) for node in nodes) or any(not isinstance(skin, dict) for skin in skins):\n        raise ValueError("Invalid node or skin object")\n    names = {node.get("name") for node in nodes}
    if not garment:
        missing = REQUIRED - names
        if missing:
            raise ValueError("Missing runtime bones: " + ", ".join(sorted(missing)))
    if not any(isinstance(skin.get("joints"), list) and
               all(type(j) is int and 0 <= j < len(nodes) for j in skin["joints"]) and
               (({nodes[j].get("name") for j in skin["joints"]} & REQUIRED) if garment
                else ({nodes[j].get("name") for j in skin["joints"]} >= REQUIRED))
               for skin in skins):
        raise ValueError("No valid skin with required runtime joints")
    mesh_nodes = [node for node in nodes if "mesh" in node]
    if not mesh_nodes:
        raise ValueError("No mesh nodes")
    if any("skin" not in node for node in mesh_nodes):
        raise ValueError("Unskinned mesh node in export")
    bound = mesh_nodes
    checked = 0
    for node in bound:
        mi, si = node["mesh"], node["skin"]
        if type(mi) is not int or mi < 0 or mi >= len(meshes) or type(si) is not int or si < 0 or si >= len(skins):
            raise ValueError("Invalid mesh/skin index")
        skin = skins[si]
        joints = skin.get("joints")
        if not isinstance(joints, list) or not joints or any(type(j) is not int or j < 0 or j >= len(nodes) for j in joints):
            raise ValueError("Bound mesh has invalid skin joints")
        if len(joints) != len(set(joints)):\n            raise ValueError("Duplicate joint in bound skin")\n        inverse = skin.get("inverseBindMatrices")\n        if inverse is not None:\n            if type(inverse) is not int or inverse < 0 or inverse >= len(accessors):\n                raise ValueError("Invalid inverse bind matrix accessor")\n            matrix_accessor = accessors[inverse]\n            if matrix_accessor.get("count") != len(joints) or matrix_accessor.get("type") != "MAT4" or matrix_accessor.get("componentType") != 5126:\n                raise ValueError("Inverse bind matrices do not match skin joints")\n        joint_names = {nodes[j].get("name") for j in joints}
        if garment and not joint_names.intersection(REQUIRED):
            raise ValueError("Bound garment skin has no runtime joint")
        if not garment and not joint_names.issuperset(REQUIRED):
            raise ValueError("Bound body skin is missing runtime joints")
        primitives = meshes[mi].get("primitives", [])
        if not primitives:
            raise ValueError("Bound mesh has no primitives")
        for prim in primitives:
            attrs = prim.get("attributes", {})
            for name in ("POSITION", "JOINTS_0", "WEIGHTS_0"):
                idx = attrs.get(name)
                if not isinstance(idx, int) or idx < 0 or idx >= len(accessors):
                    raise ValueError("Missing or invalid " + name + " accessor")
            count = accessors[attrs["POSITION"]].get("count")
            if not count or any(accessors[attrs[n]].get("count") != count for n in ("JOINTS_0", "WEIGHTS_0")):
                raise ValueError("Skin attribute vertex counts differ")
            if accessors[attrs["JOINTS_0"]].get("type") != "VEC4" or accessors[attrs["WEIGHTS_0"]].get("type") != "VEC4":
                raise ValueError("Expected four-component joint and weight attributes")
            if accessors[attrs["JOINTS_0"]].get("componentType") not in (5121, 5123):
                raise ValueError("JOINTS_0 must use unsigned byte or unsigned short")
            if accessors[attrs["WEIGHTS_0"]].get("componentType") not in (5126, 5121, 5123):
                raise ValueError("WEIGHTS_0 has invalid component type")
            if accessors[attrs["WEIGHTS_0"]].get("componentType") != 5126 and not accessors[attrs["WEIGHTS_0"]].get("normalized"):
                raise ValueError("Integer weights must be normalized")
            checked += 1
    if not checked:
        raise ValueError("No skinned mesh primitives")
    return {"file": str(path), "skinned_primitives": checked, "skins": len(skins),
            "result": "structural_pass_only_not_fit_certified"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", nargs="+")
    parser.add_argument("--garment", action="store_true", help="Allow garment skins to reference a subset of runtime bones")
    args = parser.parse_args()
    failed = False
    for path in args.glb:
        try:
            print(json.dumps(inspect(path, garment=args.garment)))
        except (ValueError, OSError, json.JSONDecodeError, struct.error) as exc:
            failed = True
            print(json.dumps({"file": path, "result": "FAIL", "reason": str(exc)}), file=sys.stderr)
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
