"""Publish only real, verified masculine/feminine CC0 reference views for Admin.

Reads the full Blender build proof and copies PNG/GLB previews into a
standalone branch. Never copies working .blend files, touches the production
public/avatar-v2 manifest or sets a live rollout flag.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import shutil

from verify_source_artifacts import verify_artifacts

FRAMES = ("masculine", "feminine")
VIEWS = ("front", "quarter", "side", "face")


def preview_names(frame: str) -> dict:
    return {
        "frame": frame,
        "source": f"{frame}/{frame}-SOURCE-ONLY-not-validated.glb",
        "lookdev": f"{frame}/{frame}-LOOKDEV-ONLY-not-validated.glb",
        "sourceViews": {view: f"{frame}/{frame}-{view}.png" for view in VIEWS},
        "lookdevViews": {view: f"{frame}/{frame}-lookdev-{view}.png" for view in VIEWS},
    }


def publish_references(source_root: pathlib.Path, output_root: pathlib.Path) -> dict:
    source_root = source_root.resolve()
    output_root = output_root.resolve()
    if source_root == output_root or source_root in output_root.parents or output_root in source_root.parents:
        raise ValueError("The public preview target must be separate from the full authoring pack.")
    # The verifier inspects the genuine full pack, hashes every artifact,
    # checks model geometry and explicitly rejects any production-ready claim.
    verify_artifacts(source_root)
    source_manifest = json.loads(
        (source_root / "authoring-artifacts-manifest.json").read_text(encoding="utf-8")
    )
    if source_manifest.get("releaseEligible") is not False:
        raise ValueError("Source previews cannot be released as production models.")
    if output_root.exists() and any(output_root.iterdir()):
        raise ValueError("Refusing to overwrite an existing reference gallery.")
    output_root.mkdir(parents=True, exist_ok=True)

    frames = [preview_names(frame) for frame in FRAMES]
    inventory = []
    for entry in frames:
        names = [
            entry["source"],
            entry["lookdev"],
            *entry["sourceViews"].values(),
            *entry["lookdevViews"].values(),
        ]
        for name in names:
            original = source_root / name
            destination = output_root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, destination)
            digest = hashlib.file_digest(destination.open("rb"), "sha256").hexdigest()
            inventory.append({
                "file": name,
                "bytes": destination.stat().st_size,
                "sha256": digest,
            })

    manifest = {
        "schema": "rockmundo.avatar-v2-reference-previews",
        "version": 1,
        "source": "blender-human-base-meshes-v1.4.1",
        "sourceArchiveSha256": source_manifest["sourceArchiveSha256"],
        "previewOnly": True,
        "productionValidated": False,
        "frames": frames,
        "files": inventory,
    }
    (output_root / "preview-manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8",
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = publish_references(args.root, args.output)
    print(f"Published {len(result['files'])} source-only proof files for both frames; "
          "production validation remains false.")


if __name__ == "__main__":
    main()
