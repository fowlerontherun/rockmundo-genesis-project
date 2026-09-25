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
        for key in ("sourceBlend", "guideBlend", "fitHandlesBlend", "candidatePreview"):
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
