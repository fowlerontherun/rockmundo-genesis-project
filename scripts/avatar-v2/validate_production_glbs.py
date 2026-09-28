"""Fail closed on production-path GLBs and on unsupported status promotions.

Run after the existing JavaScript geometry/material validators. This script
also ensures that archived authoring experiments are never counted as live V2.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

from verify_skinned_glb import inspect

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "avatar-v2"
EVIDENCE = ROOT / "art-source" / "avatar-v2" / "evidence"
FRAMES = ("masculine", "feminine")
LODS = range(4)
STATUSES = {"planned", "asset_ready", "validated", "blocked"}


def _read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _evidence(entry, relative, file, *, kind, frame, lod):
    key = entry.get("qaEvidence")
    if not isinstance(key, str) or not key.startswith("art-source/avatar-v2/evidence/"):
        raise ValueError(f"{relative}: validated entry has no versioned QA evidence")
    path = (ROOT / key).resolve()
    if not path.is_relative_to(EVIDENCE.resolve()) or not path.is_file():
        raise ValueError(f"{relative}: missing or unsafe QA evidence path")
    record = _read(path)
    expected = {
        "schema": "rockmundo.avatar-v2-qa-evidence",
        "version": 1, "kind": kind, "frame": frame, "lod": lod,
        "assetPath": relative,
        "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
        "sourceOnly": False,
        "rigReviewed": True, "visualApproved": True, "performanceApproved": True,
    }
    if any(record.get(k) != v for k, v in expected.items()):
        raise ValueError(f"{relative}: QA evidence mismatches real GLB or approval gates")
    if not isinstance(record.get("reviewer"), str) or not record["reviewer"].strip():
        raise ValueError(f"{relative}: QA evidence has no independent reviewer")
    if not isinstance(record.get("sourceSha256"), str) or len(record["sourceSha256"]) != 64:
        raise ValueError(f"{relative}: source provenance checksum is missing")
    proof = record.get("proofFiles")
    if not isinstance(proof, list) or len(proof) < 4:
        raise ValueError(f"{relative}: front/side/back and performance proofs required")
    for name in proof:
        if not isinstance(name, str) or not name.startswith("art-source/avatar-v2/evidence/"):
            raise ValueError(f"{relative}: unsafe QA proof path")
        target = (ROOT / name).resolve()
        if not target.is_relative_to(EVIDENCE.resolve()) or not target.is_file():
            raise ValueError(f"{relative}: missing QA proof {name}")


def validate():
    body = _read(PUBLIC / "manifest.json")
    garment = _read(PUBLIC / "clothing" / "manifest.json")
    if body.get("schema") != "rockmundo.avatar-v2-assets" or body.get("contractVersion") != "2.0":
        raise ValueError("Unexpected body manifest schema or contract")
    if garment.get("schema") != "rockmundo.avatar-v2-garments" or garment.get("version") != 1:
        raise ValueError("Unexpected garment manifest schema")
    if body.get("assetVersion") != garment.get("assetVersion"):
        raise ValueError("Body and garment asset versions differ")

    known = set()
    body_keys = set()
    for item in body.get("assets", []):
        frame, lod, status = item.get("frame"), item.get("lod"), item.get("status")
        if frame not in FRAMES or type(lod) is not int or lod not in LODS:
            raise ValueError("Unexpected frame/LOD in body manifest")
        key = (frame, lod)
        if key in body_keys:
            raise ValueError(f"Duplicate base manifest entry: {key}")
        body_keys.add(key)
        if status not in STATUSES:
            raise ValueError(f"Unknown body status: {key}")
        relative = f"avatar-v2/{frame}/base-lod{lod}.glb"
        if item.get("file") != f"{frame}/base-lod{lod}.glb":
            raise ValueError(f"Incorrect body asset path: {key}")
        _asset(item, relative, kind="body", frame=frame, lod=lod, known=known)
    if body_keys != {(f, l) for f in FRAMES for l in LODS}:
        raise ValueError("Base body manifest must cover all eight frame/LOD pairs")

    keys = set()
    for item in garment.get("items", []):
        key = item.get("itemKey")
        if not isinstance(key, str) or not key or key in keys:
            raise ValueError("Duplicate or missing garment item key")
        keys.add(key)
        status = item.get("status")
        if status not in STATUSES:
            raise ValueError(f"{key}: unknown garment status")
        files = []
        for frame in FRAMES:
            mapped = item.get("frames", {}).get(frame)
            if not isinstance(mapped, dict):
                raise ValueError(f"{key}: missing {frame} frame")
            for lodname, relative in mapped.items():
                if lodname not in {f"lod{n}" for n in LODS}:
                    raise ValueError(f"{key}: unexpected {lodname}")
                lod = int(lodname[-1])
                expected = f"avatar-v2/clothing/{frame}/{key}-lod{lod}.glb"
                if relative != expected:
                    raise ValueError(f"{key}: incorrect {frame} {lodname} path")
                files.append(relative)
                qa = item.get("qaEvidence", {}).get(frame, {}).get(lodname)
                _asset({"status": status, "qaEvidence": qa}, relative,
                       kind="garment", frame=frame, lod=lod, known=known)
        if status in {"asset_ready", "validated"} and len(files) != 8:
            raise ValueError(f"{key}: {status} garment needs all eight distinct frame/LOD files")
        if len(files) != len(set(files)):
            raise ValueError(f"{key}: duplicated garment GLB path")

    # Staged blockouts/proofs belong only in private authoring storage, not
    # in the live production folder even when no manifest references them.
    stray = {p.relative_to(ROOT / "public").as_posix()
             for p in PUBLIC.rglob("*.glb")} - known
    if stray:
        raise ValueError(f"Unregistered GLBs in public production path: {sorted(stray)}")
    return {"result": "pass", "inspectedPaths": len(known),
            "productionApproval": "only separately signed validated assets may be served"}


def _asset(entry, relative, *, kind, frame, lod, known):
    if relative in known:
        raise ValueError(f"Duplicate production GLB across manifest records: {relative}")
    known.add(relative)
    path = (ROOT / "public" / relative).resolve()
    if not path.is_relative_to(PUBLIC.resolve()):
        raise ValueError(f"Unsafe asset path: {relative}")
    status = entry["status"]
    if status == "blocked" and path.exists():
        raise ValueError(f"{relative}: blocked GLB must remain quarantined")
    if not path.exists():
        if status in {"asset_ready", "validated"}:
            raise ValueError(f"{relative}: status {status} with no real binary")
        return
    inspect(path, garment=kind == "garment")
    if status == "validated":
        _evidence(entry, relative, path, kind=kind, frame=frame, lod=lod)


if __name__ == "__main__":
    try:
        print(json.dumps(validate(), indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"[avatar-v2/production] ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
