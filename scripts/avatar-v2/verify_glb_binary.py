"""Inspect real glTF 2.0 BIN bytes; a JSON-only skin declaration is not evidence.

Used by the V2 asset gate and by the real Blender-source workflow. This checks
binary integrity and bone influences, not visual fit or artist certification.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import struct

COMPONENTS = {
    5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
    5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4),
}
ARITIES = {
    "SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
    "MAT2": 4, "MAT3": 9, "MAT4": 16,
}


def parse_glb(raw: bytes):
    if len(raw) < 20 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("Not a glTF 2.0 GLB")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("GLB header length mismatch")
    offset = 12
    chunks = []
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise ValueError("Truncated GLB chunk header")
        length, kind = struct.unpack_from("<I4s", raw, offset)
        offset += 8
        if length % 4 or offset + length > len(raw):
            raise ValueError("Malformed GLB chunk length")
        chunks.append((kind, raw[offset:offset + length]))
        offset += length
    if not chunks or chunks[0][0] != b"JSON":
        raise ValueError("Missing first GLB JSON chunk")
    if len([kind for kind, _ in chunks if kind == b"JSON"]) != 1:
        raise ValueError("Duplicate GLB JSON chunks")
    bins = [chunk for kind, chunk in chunks if kind == b"BIN\x00"]
    if len(bins) != 1:
        raise ValueError("Exactly one GLB BIN chunk is required")
    return json.loads(chunks[0][1]), bins[0]


def _integer(value, name, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValueError(f"Invalid {name}")
    return value


def _accessor_reader(doc: dict, binary: bytes):
    buffers = doc.get("buffers")
    views = doc.get("bufferViews")
    accessors = doc.get("accessors")
    if not isinstance(buffers, list) or len(buffers) != 1 or "uri" in buffers[0]:
        raise ValueError("GLB requires exactly one embedded buffer")
    length = _integer(buffers[0].get("byteLength"), "buffer byteLength")
    if len(binary) - length not in (0, 1, 2, 3):
        raise ValueError("BIN length does not match embedded buffer")
    if not isinstance(views, list) or not isinstance(accessors, list):
        raise ValueError("Missing bufferViews or accessors")

    def read(index):
        if type(index) is not int or index < 0 or index >= len(accessors):
            raise ValueError("Invalid accessor index")
        a = accessors[index]
        if not isinstance(a, dict) or "sparse" in a:
            raise ValueError("Unsupported sparse or malformed accessor")
        component = a.get("componentType")
        if component not in COMPONENTS or a.get("type") not in ARITIES:
            raise ValueError("Invalid accessor component type or shape")
        fmt, width = COMPONENTS[component]
        arity = ARITIES[a["type"]]
        count = _integer(a.get("count"), "accessor count", minimum=1)
        if count > 5_000_000:
            raise ValueError("Unbounded accessor count")
        vi = _integer(a.get("bufferView"), "accessor bufferView")
        if vi >= len(views) or not isinstance(views[vi], dict):
            raise ValueError("Invalid accessor bufferView")
        view = views[vi]
        if view.get("buffer") != 0:
            raise ValueError("Accessor refers to non-embedded buffer")
        start = _integer(view.get("byteOffset", 0), "bufferView offset")
        span = _integer(view.get("byteLength"), "bufferView length")
        relative = _integer(a.get("byteOffset", 0), "accessor offset")
        packed = width * arity
        stride = view.get("byteStride", packed)
        if type(stride) is not int or stride < packed or stride % width:
            raise ValueError("Invalid accessor byte stride")
        if (start + relative) % width or relative + (count - 1) * stride + packed > span:
            raise ValueError("Accessor exceeds bufferView bounds or is misaligned")
        if start + span > length or start + span > len(binary):
            raise ValueError("bufferView exceeds declared BIN bounds")
        unpack = struct.Struct("<" + fmt * arity)
        values = [unpack.unpack_from(binary, start + relative + row * stride)
                  for row in range(count)]
        return a, values

    # Reject invalid extra accessors too, including those used by morph targets.
    for i in range(len(accessors)):
        read(i)
    return read


def verify_skin_binary(raw: bytes, doc: dict | None = None) -> dict:
    parsed, binary = parse_glb(raw)
    if doc is not None and parsed != doc:
        raise ValueError("GLB JSON differs from inspected document")
    doc = parsed
    read = _accessor_reader(doc, binary)
    skins, meshes, nodes = (doc.get(name) for name in ("skins", "meshes", "nodes"))
    if not isinstance(skins, list) or not skins or not isinstance(meshes, list) or not isinstance(nodes, list):
        raise ValueError("Missing skin, mesh or node arrays")
    checked = 0
    for skin in skins:
        if not isinstance(skin, dict):
            raise ValueError("Malformed skin")
        joints = skin.get("joints")
        if not isinstance(joints, list) or not joints or len(joints) != len(set(map(str, joints))):
            raise ValueError("Invalid or duplicate skin joints")
        if any(type(j) is not int or j < 0 or j >= len(nodes) for j in joints):
            raise ValueError("Skin joint node out of bounds")
        inverse = skin.get("inverseBindMatrices")
        if inverse is not None:
            a, matrices = read(inverse)
            if a.get("type") != "MAT4" or a.get("componentType") != 5126 or len(matrices) != len(joints):
                raise ValueError("Inverse bind matrices do not match skin joints")
            if any(not all(math.isfinite(value) for value in matrix) for matrix in matrices):
                raise ValueError("Non-finite inverse bind matrix bytes")
    for node in nodes:
        if not isinstance(node, dict) or "mesh" not in node:
            continue
        mi, si = node["mesh"], node.get("skin")
        if type(mi) is not int or mi < 0 or mi >= len(meshes):
            raise ValueError("Mesh index out of bounds")
        if type(si) is not int or si < 0 or si >= len(skins):
            raise ValueError("Unskinned mesh in exported GLB")
        joint_count = len(skins[si]["joints"])
        primitives = meshes[mi].get("primitives")
        if not isinstance(primitives, list) or not primitives:
            raise ValueError("Mesh has no primitives")
        for primitive in primitives:
            attrs = primitive.get("attributes", {})
            if not isinstance(attrs, dict) or not all(k in attrs for k in ("POSITION", "JOINTS_0", "WEIGHTS_0")):
                raise ValueError("Missing POSITION/JOINTS_0/WEIGHTS_0")
            if "JOINTS_1" in attrs or "WEIGHTS_1" in attrs:
                raise ValueError("More than four skin influences are not supported")
            pos_a, positions = read(attrs["POSITION"])
            joint_a, joint_rows = read(attrs["JOINTS_0"])
            weight_a, weight_rows = read(attrs["WEIGHTS_0"])
            if pos_a["type"] != "VEC3" or pos_a["componentType"] != 5126:
                raise ValueError("POSITION must contain float VEC3 coordinates")
            if joint_a["type"] != "VEC4" or joint_a["componentType"] not in (5121, 5123):
                raise ValueError("JOINTS_0 must contain unsigned VEC4 indices")
            if weight_a["type"] != "VEC4" or weight_a["componentType"] not in (5121, 5123, 5126):
                raise ValueError("WEIGHTS_0 has an unsupported component type")
            if weight_a["componentType"] != 5126 and weight_a.get("normalized") is not True:
                raise ValueError("Integer weights must be normalized")
            if len(positions) != len(joint_rows) or len(positions) != len(weight_rows):
                raise ValueError("Skin attribute vertex counts differ")
            weight_divisor = {5121: 255, 5123: 65535, 5126: 1}[weight_a["componentType"]]
            for pos, indices, packed in zip(positions, joint_rows, weight_rows):
                if not all(math.isfinite(value) for value in pos):
                    raise ValueError("Non-finite vertex position")
                weights = [value / weight_divisor for value in packed]
                if not all(math.isfinite(w) and 0 <= w <= 1 for w in weights):
                    raise ValueError("Non-finite or negative vertex weight")
                if abs(sum(weights) - 1) > 0.015:
                    raise ValueError("Vertex weights are not normalised")
                if any(joint >= joint_count for joint, weight in zip(indices, weights) if weight > 0.0001):
                    raise ValueError("Vertex JOINTS_0 index exceeds bound skin")
            checked += 1
    if not checked:
        raise ValueError("No skinned primitives with real BIN accessors")
    return {"skinned_primitives": checked, "result": "binary_pass_only_not_fit_certified"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", nargs="+", type=Path)
    args = parser.parse_args()
    failed = False
    for path in args.glb:
        try:
            result = verify_skin_binary(path.read_bytes())
            print(json.dumps({"file": str(path), **result}))
        except (ValueError, OSError, KeyError, TypeError, struct.error) as exc:
            failed = True
            print(json.dumps({"file": str(path), "result": "FAIL", "reason": str(exc)}))
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
