"""Deterministic, beat-aligned stage animation sequencing for draft V2 clips.

Produces a reusable performance plan, not a runtime animation implementation.
Never assumes instrument grips, drumsticks or foot contact have passed QA.
"""
from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
from stage_performance_catalogue import build_catalogue, ROLES

@dataclass(frozen=True)
class StageSegment:
    clip: str
    role: str
    start_beat: int
    end_beat: int
    transition_beats: int

# Intensity is an explicit song-section input; the planner avoids repeating
# the same clip back-to-back and is reproducible for saved gig replays.
SECTION_TAGS = {
    "intro": ("idle", "anticipation", "cue", "nod", "sway", "breath"),
    "verse": ("verse", "groove", "comp", "picking", "hihat", "backbeat", "sway"),
    "chorus": ("chorus", "drive", "power", "crash", "hype", "lift", "lock"),
    "bridge": ("ballad", "quiet", "swell", "break", "half-time", "solo"),
    "solo": ("solo", "fill", "arpeggio", "trill", "juggle", "lead"),
    "outro": ("outro", "final", "ring", "sustain", "finale", "celebration"),
}

def plan_performance(
    role: str, sections: tuple[tuple[str, int], ...], *,
    seed: str, bpm: int = 120, transition_beats: int = 1,
) -> tuple[StageSegment, ...]:
    if (role not in ROLES or not isinstance(seed, str) or not seed
            or not isinstance(transition_beats, int) or not 0 <= transition_beats <= 2):
        raise ValueError("Invalid role, replay seed or transition duration.")
    catalogue = [clip for clip in build_catalogue(bpm) if clip.role == role]
    if not sections or any(name not in SECTION_TAGS or type(beats) is not int or beats <= 0 for name, beats in sections):
        raise ValueError("Sections need valid names and positive integer beat counts.")
    result: list[StageSegment] = []
    cursor = 0
    previous = None
    for section_index, (section, length) in enumerate(sections):
        tags = SECTION_TAGS[section]
        preferred = [clip for clip in catalogue if any(tag in clip.name for tag in tags)]
        candidates = preferred or catalogue
        remaining = length
        phrase = 0
        while remaining:
            # A section can end mid-clip; the next section starts on its exact
            # beat rather than accumulating rounding error across the gig.
            available = [clip for clip in candidates if clip.name != previous and clip.beats <= remaining]
            if not available:
                available = [clip for clip in catalogue if clip.name != previous and clip.beats <= remaining]
            if not available:
                # Hold the first beat of a longer phrase for a short remainder.
                available = [clip for clip in candidates if clip.name != previous] or candidates
            digest = sha256(f"{seed}|{role}|{section_index}|{phrase}".encode()).digest()
            clip = available[int.from_bytes(digest[:8], "big") % len(available)]
            duration = min(clip.beats, remaining)
            transition = min(transition_beats, duration // 2,
                             (result[-1].end_beat - result[-1].start_beat) // 2 if result else 0)
            result.append(StageSegment(clip.name, role, cursor, cursor + duration, transition))
            cursor += duration
            remaining -= duration
            previous = clip.name
            phrase += 1
    return tuple(result)
