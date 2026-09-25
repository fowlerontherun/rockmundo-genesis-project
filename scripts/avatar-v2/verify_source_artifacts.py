"""Fail-closed verification for the actual CC0 Avatar V2 authoring artifact packs.

This validates artifact integrity and confirms that previews, rig guides and
Blender working files were produced for BOTH frames. It never marks an asset
as game-ready, certifies unreviewed joint positions, or updates the V2 manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib

EXPECTED_FRAMES = {"masculine", "feminine"}
PREVIEW_VIEWS = {"front", "quarter", "side", "face"}


def digest(path: pathlib.Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def verify_artifacts(root: pathlib.Path) -> dict:
    root = root.resolve()
    manifest = root / "authoring-artifacts-manifest.json"
    data = json.loads(manifest.read_text("utf8"))
    errors: list[str] = []

    if data.get("schema") != "rockmundo.avatar-v2-real-source-artifacts" or data.get("version") != 1:
        errors.append("Artifact manifest has an unknown schema or version.")
    if data.get("source") != "blender-human-base-meshes-v1.4.1":
        errors.append("Unknown/unpinned Blender Human Base Meshes authoring source.")
    if data.get("sourceLicense") != "CC0-1.0":
        errors.append("Authoring source must retain its CC0 provenance.")
    if data.get("assetStatus") != "authoring-reference-only" or data.get("releaseEligible") is not False:
        errors.append("Source references may never be labelled production-ready.")

    frames = data.get("frames")
    by_frame = {entry.get("frame"): entry for entry in frames} if isinstance(frames, list) else {}
    if len(frames) != len(by_frame) if isinstance(frames, list) else True:
        errors.append("Duplicate, missing or invalid frame metadata.")
    if set(by_frame) != EXPECTED_FRAMES:
        errors.append("Exactly one masculine and one feminine authoring pack are required.")

    expected_files = set()
    for frame, metadata in by_frame.items():
        if frame not in EXPECTED_FRAMES:
            continue
        for key in ("sourceBlend", "guideBlend", "fitHandlesBlend", "candidatePreview", "lookdevBlend", "lookdevPreview"):
            filename = metadata.get(key)
            if not isinstance(filename, str) or pathlib.PurePosixPath(filename).name != filename:
                errors.append(f"{frame} has unsafe or missing {key}.")
            else:
                expected_files.add(f"{frame}/{filename}")
        views = metadata.get("contactViews")
        if not isinstance(views, list) or {
            f"{frame}-{view}.png" for view in PREVIEW_VIEWS
        } != set(views):
            errors.append(f"{frame} is missing one of the four real source proof views.")
        else:
            expected_files.update(f"{frame}/{view}" for view in views)
        styled_views = metadata.get("lookdevViews")
        if not isinstance(styled_views, list) or {
            f"{frame}-lookdev-{view}.png" for view in PREVIEW_VIEWS
        } != set(styled_views):
            errors.append(f"{frame} is missing its four real improved eye/skin lookdev proof views.")
        else:
            expected_files.update(f"{frame}/{view}" for view in styled_views)
        lookdev = metadata.get("lookdevGeometry")
        if not isinstance(lookdev, dict):
            errors.append(f"{frame} is missing actual source eye/skin lookdev geometry metadata.")
        else:
            if (lookdev.get("previewOnly") is not True
                    or lookdev.get("sculptComplete") is not False
                    or lookdev.get("jointFitComplete") is not False):
                errors.append(f"{frame} source lookdev must never masquerade as a completed V2 model.")
            if (lookdev.get("originalBodyVertices", 0) < 1000
                    or lookdev.get("realEyesRecoloured") != 2
                    or lookdev.get("realCorneasAdded") != 2):
                errors.append(f"{frame} did not build genuine full-body eye/cornea lookdev geometry.")
            eyes = lookdev.get("eyeGeometry")
            if (not isinstance(eyes, list) or {eye.get("side") for eye in eyes} != {"L", "R"}
                    or any(eye.get("addedCorneaVertices", 0) < 100
                           or eye.get("existingEyeMaterialPolygons", {}).get("iris", 0) < 10
                           or eye.get("existingEyeMaterialPolygons", {}).get("pupil", 0) < 4
                           for eye in eyes)):
                errors.append(f"{frame} source eye material/real cornea surface data are incomplete.")
            grooms = lookdev.get("browLashGeometry")
            if (lookdev.get("realBrowAndLashMeshes") != 6
                    or not isinstance(grooms, list)
                    or len(grooms) != 2
                    or {entry.get("side") for entry in grooms} != {"L", "R"}
                    or any(
                        entry.get("browVertices", 0) < 50
                        or entry.get("groomFibres", 0) < 60
                        or entry.get("upperLashFibres", 0) < 20
                        or entry.get("newGeometryVertices", 0) < 1400
                        or entry.get("rootProjection") != "actual CC0 continuous frontal skin"
                        or entry.get("unweightedPreviewOnly") is not True
                        for entry in grooms
                    )):
                errors.append(f"{frame} is missing genuine bilateral, skin-projected eyebrow/upper-lash mesh detail.")
        if (metadata.get("productionValidated") is not False
                or metadata.get("requiresManualJointFit") is not True):
            errors.append(f"{frame} must retain its unfinished manual-rig gate.")
        for key, minimum in (("sourceVertices", 1000), ("guideBones", 40), ("fitMarkers", 40)):
            if not isinstance(metadata.get(key), int) or metadata[key] < minimum:
                errors.append(f"{frame} {key} does not show a complete geometry/rig source.")

    reported = data.get("files")
    if not isinstance(reported, list):
        errors.append("Authoring manifest has no per-file SHA-256 inventory.")
        reported = []
    actual_files = set()
    for entry in reported:
        name = entry.get("file")
        if not isinstance(name, str):
            errors.append("Authoring file inventory includes a non-string path.")
            continue
        candidate = (root / name).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            errors.append(f"Unsafe authoring file path: {name}.")
            continue
        if name in actual_files:
            errors.append(f"Duplicated authoring file inventory entry: {name}.")
        actual_files.add(name)
        if not candidate.is_file():
            errors.append(f"Missing authoring file: {name}.")
            continue
        blob = candidate.read_bytes()
        if len(blob) < 1024:
            errors.append(f"Empty or suspiciously tiny authoring file: {name}.")
        if len(blob) != entry.get("bytes") or digest(candidate) != entry.get("sha256"):
            errors.append(f"Unverified or modified authoring file: {name}.")
        expected_magic = {
            ".blend": b"BLENDER",
            ".glb": b"glTF",
            ".png": b"\x89PNG\r\n\x1a\n",
        }
        suffix = candidate.suffix.lower()
        if suffix not in expected_magic or not blob.startswith(expected_magic[suffix]):
            errors.append(f"Invalid artifact type or signature: {name}.")

    if isinstance(frames, list):
        by_path = {item.get("file"): item.get("sha256") for item in reported}
        for frame in EXPECTED_FRAMES & set(by_frame):
            baseline = by_frame[frame].get("candidatePreview")
            styled = by_frame[frame].get("lookdevPreview")
            raw_hash = by_path.get(f"{frame}/{baseline}")
            styled_hash = by_path.get(f"{frame}/{styled}")
            if raw_hash is not None and raw_hash == styled_hash:
                errors.append(f"{frame} styled geometry/material GLB is identical to the raw CC0 baseline.")

    if actual_files != expected_files:
        errors.append(
            f"Manifest inventory differs from the two full frame packs. "
            f"Missing: {sorted(expected_files - actual_files)}; "
            f"extra: {sorted(actual_files - expected_files)}"
        )

    if errors:
        raise ValueError("Avatar V2 authoring source verification failed:\n- " + "\n- ".join(errors))
    return {
        "passed": True,
        "frames": sorted(by_frame),
        "verifiedFiles": len(actual_files),
        "productionValidated": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=pathlib.Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify_artifacts(args.root), indent=2))


if __name__ == "__main__":
    main()
