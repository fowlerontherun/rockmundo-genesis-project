"""Fetch and safely extract the pinned CC0 Blender Human Base Meshes bundle.

This is an authoring convenience only. Nothing downloaded by this script belongs
in the runtime public/avatar-v2 directory.

Usage:
  python3 scripts/avatar-v2/fetch_human_base_meshes.py

Optional:
  python3 scripts/avatar-v2/fetch_human_base_meshes.py --output-dir /path/to/work
"""

from __future__ import annotations

import argparse
import pathlib
import shutil
import sys
import urllib.request
import zipfile

SOURCE_URL = (
    "https://download.blender.org/demo/asset-bundles/human-base-meshes/"
    "human-base-meshes-bundle-v1.4.1.zip"
)
ARCHIVE_NAME = "human-base-meshes-bundle-v1.4.1.zip"
EXPECTED_BYTES = 50_643_039
DEFAULT_ROOT = pathlib.Path("work/avatar-v2-source")


def cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=str(DEFAULT_ROOT))
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--no-extract", action="store_true")
    return parser.parse_args()


def archive_valid(path: pathlib.Path) -> bool:
    if not path.exists() or path.stat().st_size != EXPECTED_BYTES:
        return False
    try:
        with path.open("rb") as handle:
            return handle.read(4) == b"PK\x03\x04"
    except OSError:
        return False


def download(destination: pathlib.Path) -> None:
    partial = destination.with_suffix(destination.suffix + ".partial")
    partial.unlink(missing_ok=True)

    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "RockMundo-Avatar-V2-Authoring/1.0"},
    )
    print(f"[avatar-v2-source] Downloading {SOURCE_URL}")
    received = 0
    try:
        with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
                received += len(chunk)
                print(
                    f"\r[avatar-v2-source] {received / 1024 / 1024:.1f} MiB",
                    end="",
                    flush=True,
                )
        print()
    except Exception:
        partial.unlink(missing_ok=True)
        raise

    if received != EXPECTED_BYTES:
        partial.unlink(missing_ok=True)
        raise SystemExit(
            f"Downloaded {received:,} bytes; pinned bundle expects {EXPECTED_BYTES:,}. "
            "Refusing to use an unexpected upstream file."
        )
    if not archive_valid(partial):
        partial.unlink(missing_ok=True)
        raise SystemExit("Downloaded file does not look like the pinned ZIP bundle.")

    partial.replace(destination)


def safe_member_path(root: pathlib.Path, name: str) -> pathlib.Path:
    candidate = (root / name).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise SystemExit(f"Unsafe archive path refused: {name}") from error
    return candidate


def extract(archive: pathlib.Path, destination: pathlib.Path) -> list[pathlib.Path]:
    destination.mkdir(parents=True, exist_ok=True)
    blend_files: list[pathlib.Path] = []

    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            target = safe_member_path(destination, member.filename)
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            if target.suffix.lower() == ".blend":
                blend_files.append(target)

    return sorted(blend_files)


def main() -> None:
    args = cli_args()
    root = pathlib.Path(args.output_dir).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)

    archive = root / ARCHIVE_NAME
    if args.force_download or not archive_valid(archive):
        archive.unlink(missing_ok=True)
        download(archive)
    else:
        print(f"[avatar-v2-source] Reusing verified-size archive: {archive}")

    print(
        f"[avatar-v2-source] Pinned archive ready: {archive} "
        f"({archive.stat().st_size:,} bytes)."
    )

    if args.no_extract:
        return

    extracted_root = root / "extracted"
    blend_files = extract(archive, extracted_root)
    if not blend_files:
        raise SystemExit("The pinned bundle contained no .blend authoring files.")

    print("[avatar-v2-source] Extracted Blender files:")
    for file in blend_files:
        print(f"  {file}")

    print(
        "\nNext: run rockmundo_avatar_v2_seed.py --list against the relevant .blend "
        "file, or use its stylized preset once the file containing the official "
        "Body Male/Female - Stylized collections is identified."
    )


if __name__ == "__main__":
    main()
