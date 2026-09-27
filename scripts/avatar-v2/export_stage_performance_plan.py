"""Export reproducible draft Avatar V2 stage plans for review and gig integration.

Example:
 python scripts/avatar-v2/export_stage_performance_plan.py \\
   --seed gig-42 --bpm 120 --sections intro:8,verse:16,chorus:16,outro:8 \\
   --output work/avatar-v2-stage-plan.json

The result is a review manifest, not an approved runtime animation asset.
"""
from __future__ import annotations
import argparse
import json
import pathlib
from dataclasses import asdict
from stage_performance_catalogue import ROLES
from stage_performance_sequence import SECTION_TAGS, plan_performance

def parse_sections(raw: str) -> tuple[tuple[str, int], ...]:
    result = []
    for item in raw.split(","):
        name, sep, length = item.strip().partition(":")
        if not sep or name not in SECTION_TAGS:
            raise ValueError(f"Invalid song section: {item}")
        try:
            beats = int(length)
        except ValueError as exc:
            raise ValueError(f"Invalid beat count: {item}") from exc
        if beats <= 0:
            raise ValueError(f"Section must have positive beats: {item}")
        result.append((name, beats))
    if not result:
        raise ValueError("At least one song section is required.")
    return tuple(result)

def build_manifest(seed: str, bpm: int, sections: tuple[tuple[str, int], ...]) -> dict:
    plans = {role: [asdict(item) for item in plan_performance(
        role, sections, seed=seed, bpm=bpm,
    )] for role in ROLES}
    return {
        "schema": "rockmundo.avatar-v2-draft-stage-plan",
        "version": 1,
        "seed": seed,
        "bpm": bpm,
        "sections": [{"name": name, "beats": beats} for name, beats in sections],
        "durationBeats": sum(beats for _, beats in sections),
        "draftOnly": True,
        "artistApproved": False,
        "instrumentContactValidated": False,
        "runtimeIntegrated": False,
        "roles": plans,
    }

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", required=True)
    parser.add_argument("--bpm", type=int, default=120)
    parser.add_argument("--sections", required=True)
    parser.add_argument("--output", required=True, type=pathlib.Path)
    args = parser.parse_args()
    manifest = build_manifest(args.seed, args.bpm, parse_sections(args.sections))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
