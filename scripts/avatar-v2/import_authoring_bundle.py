#!/usr/bin/env python3
"""Import the separately delivered Avatar V2 authoring bundle, never live assets."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
import zipfile

EXPECTED_PACKS = {"tee": 4, "denim": 3, "footwear": 4, "punk": 4}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="rockmundo_v2_authoring_import_bundle.zip")
    parser.add_argument("--apply", action="store_true", help="copy validated sources into art-source/avatar-v2")
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[2] / "art-source" / "avatar-v2"
    if destination.exists() and args.apply:
        sys.exit("Refusing to overwrite existing art-source/avatar-v2; reconcile manually.")
    with zipfile.ZipFile(args.bundle) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            sys.exit("Duplicate archive entries.")
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name:
                sys.exit(f"Unsafe archive entry: {name}")
        def read(name):
            return archive.read(name)
        checksums = json.loads(read("CHECKSUMS.json"))
        expected = {entry["path"]: entry["sha256"] for entry in checksums}
        if len(expected) != len(checksums):
            sys.exit("Duplicate checksum entries.")
        for name, digest in expected.items():
            if not name.startswith("assets/") or name not in names:
                sys.exit(f"Missing or unexpected file: {name}")
            if hashlib.sha256(read(name)).hexdigest() != digest:
                sys.exit(f"Checksum mismatch: {name}")
        source_files = {name for name in names if name.startswith("assets/") and not name.endswith("/")}
        if source_files != set(expected):
            sys.exit("Unlisted source files in archive.")
        for pack, count in EXPECTED_PACKS.items():
            glbs = [name for name in expected if name.startswith(f"assets/{pack}/") and name.endswith(".glb")]
            if len(glbs) != count:
                sys.exit(f"{pack}: expected {count} GLBs, found {len(glbs)}")
            for name in glbs:
                data = read(name)
                if len(data) < 12 or data[:4] != b"glTF" or int.from_bytes(data[4:8], "little") != 2 or int.from_bytes(data[8:12], "little") != len(data):
                    sys.exit(f"Invalid GLB header: {name}")
        print(f"Verified {len(expected)} files and 15 GLB headers.")
        if args.apply:
            destination.mkdir(parents=True)
            for name in expected:
                relative = PurePosixPath(name).relative_to("assets")
                target = destination.joinpath(*relative.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(read(name))
            print(f"Imported authoring-only files into {destination}")
        else:
            print("Dry run only. Use --apply to import; no live garment manifests are changed.")

if __name__ == "__main__":
    main()
