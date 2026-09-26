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
STARTER_STYLES = {
    "logo-tee": "clothing.starter.logo-tee",
    "plain-black-tee": "clothing.starter.plain-black-tee",
    "plain-white-tee": "clothing.starter.plain-white-tee",
    "vintage-charcoal-tee": "clothing.starter.vintage-charcoal-tee",
}


def preview_names(frame: str) -> dict:
    return {
        "frame": frame,
        "source": f"{frame}/{frame}-SOURCE-ONLY-not-validated.glb",
        "lookdev": f"{frame}/{frame}-LOOKDEV-ONLY-not-validated.glb",
        "headMotion": f"{frame}/{frame}-HEAD-RIG-EXPERIMENT-not-validated.glb",
        "headMotionViews": {
            view: f"{frame}/{frame}-head-rig-experiment-{view}.png" for view in VIEWS
        },
        "starterTees": [{
            "style": style,
            "catalogueKey": key,
            "preview": f"{frame}/{frame}-starter-{style}-LOOKDEV-ONLY-not-validated.glb",
            "views": {
                view: f"{frame}/{frame}-starter-{style}-{view}.png"
                for view in ("front", "quarter")
            },
        } for style, key in STARTER_STYLES.items()],
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
    source_frames = {item.get("frame"): item for item in source_manifest.get("frames", [])}
    if set(source_frames) != set(FRAMES):
        raise ValueError("Missing real masculine/feminine source anatomy proof.")
    for entry in frames:
        evidence = source_frames[entry["frame"]].get("sourceJointSuggestions")
        if (not isinstance(evidence, dict)
                or evidence.get("frame") != entry["frame"]
                or evidence.get("artistReviewed") is not False
                or evidence.get("rigFitted") is not False
                or evidence.get("skinWeightsAuthored") is not False):
            raise ValueError("Verified source pack has no safe, unreviewed anatomical guide.")
        entry["sourceJointSuggestions"] = evidence
        motion = source_frames[entry["frame"]].get("headMotionExperiment")
        if (not isinstance(motion, dict)
                or motion.get("schema") != "rockmundo.avatar-v2-head-rig-experiment"
                or motion.get("preview") != pathlib.PurePosixPath(entry["headMotion"]).name
                or motion.get("views") != [
                    pathlib.PurePosixPath(entry["headMotionViews"][view]).name for view in VIEWS
                ]
                or motion.get("actualSkinBuffers") is not True
                or motion.get("draftWeightsOnly") is not True
                or motion.get("guideHeadPivotStillUnfitted") is not True
                or motion.get("artistReviewed") is not False
                or motion.get("productionValidated") is not False):
            raise ValueError("Unapproved experimental head rig is not verified on both genuine source frames.")
        # The source pack's full independent integrity and motion evidence
        # audit has already passed. Include measured QA data for the UI.
        entry["headMotionEvidence"] = {
            key: motion[key] for key in (
                "schema", "version", "frame", "headTurnDegrees", "eyeCounterTurnDegrees",
                "headMeanDisplacementMm", "torsoMeanDisplacementMm",
                "eyeMeanDisplacementMm", "gltfJointCount", "gltfSkinnedPrimitives",
                "actualSkinBuffers", "draftWeightsOnly",
                "guideHeadPivotStillUnfitted", "artistReviewed",
                "fullBodySkinned", "faceMorphsAuthored", "productionValidated",
            )
        }
        tee_pack = source_frames[entry["frame"]].get("starterTeePrototypes")
        if (not isinstance(tee_pack, dict)
                or tee_pack.get("schema") != "rockmundo.avatar-v2-starter-tee-authoring-proofs"
                or tee_pack.get("frame") != entry["frame"]
                or tee_pack.get("noDatabaseItemsCreated") is not True
                or tee_pack.get("oldCatalogueKeysUnchanged") is not True
                or tee_pack.get("artistApproved") is not False
                or tee_pack.get("productionValidated") is not False
                or not isinstance(tee_pack.get("variants"), list)
                or len(tee_pack["variants"]) != 4):
            raise ValueError("Incomplete original catalogue Starter Wardrobe authoring evidence.")
        variants = {item["style"]: item for item in tee_pack["variants"]}
        if set(variants) != set(STARTER_STYLES):
            raise ValueError("The physical Starter Wardrobe proof must preserve all four already sold styles.")
        for target in entry["starterTees"]:
            detail = variants[target["style"]]
            surface = detail.get("sourceSurface") or {}
            brand = detail.get("brand")
            if (detail.get("catalogueKey") != target["catalogueKey"]
                    or detail.get("preview") != pathlib.PurePosixPath(target["preview"]).name
                    or detail.get("views") != {
                        key: pathlib.PurePosixPath(value).name
                        for key, value in target["views"].items()
                    }
                    or detail.get("gltfSourceMappedShirt") is not True
                    or detail.get("gltfRealSurfaceHems") is not True
                    or detail.get("gltfHasSkinning") is not False
                    or detail.get("gltfHasAnimations") is not False
                    or detail.get("productionValidated") is not False
                    or detail.get("realGarmentArtistApproved") is not False
                    or surface.get("originalSurfaceConforming") is not True
                    or surface.get("productionValidated") is not False
                    or (target["style"] == "logo-tee") != bool(
                        brand and brand.get("usesExistingBrandArtwork") is True
                        and detail.get("gltfConformingOriginalLogo") is True
                    )):
                raise ValueError("A Starter clothing proof is unverified, incorrectly branded or falsely certified.")
            target["evidence"] = {
                "sourceSurfaceVertices": surface["sourceSurfaceVertices"],
                "sourceSelectedFaces": surface["sourceSelectedFaces"],
                "averageOffsetMm": surface["averageOffsetMm"],
                "actualOriginalCC0SourceSurface": True,
                "gltfConformingOriginalLogo": detail["gltfConformingOriginalLogo"],
                "gltfRealSurfaceHems": True,
                "realGarmentArtistApproved": False,
                "requiresManualFullBodyRigAndGarmentWeighting": True,
                "productionValidated": False,
            }
    inventory = []
    for entry in frames:
        names = [
            entry["source"],
            entry["lookdev"],
            entry["headMotion"],
            *entry["headMotionViews"].values(),
            *(asset for item in entry["starterTees"]
              for asset in (item["preview"], *item["views"].values())),
            *entry["sourceViews"].values(),
            *entry["lookdevViews"].values(),
        ]
        for name in names:
            original = source_root / name
            destination = output_root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, destination)
            with destination.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
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
    print(f"Published {len(result['files'])} source, head motion and real existing Starter tee proof files for both frames; "
          "production validation remains false.")


if __name__ == "__main__":
    main()
