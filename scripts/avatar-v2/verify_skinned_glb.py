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
    doc = json.loads(raw[20:20 + size])
    nodes, skins, meshes, accessors = (doc.get(k, []) for k in ("nodes", "skins", "meshes", "accessors"))
    if not isinstance(nodes, list) or not isinstance(skins, list) or not isinstance(meshes, list) or not isinstance(accessors, list):
        raise ValueError("Invalid glTF top-level arrays")
    if not skins:
        raise ValueError("No glTF skins")
    names = {node.get("name") for node in nodes}
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
    bound = [node for node in nodes if "mesh" in node and "skin" in node]
    if not bound:
        raise ValueError("No mesh node bound to a skin")
    checked = 0
    for node in bound:
        mi, si = node["mesh"], node["skin"]
        if type(mi) is not int or mi < 0 or mi >= len(meshes) or type(si) is not int or si < 0 or si >= len(skins):
            raise ValueError("Invalid mesh/skin index")
        for prim in meshes[mi].get("primitives", []):
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
