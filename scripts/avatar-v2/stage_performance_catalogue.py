"""Draft, loopable Avatar V2 stage-performance choreography catalogue.

Angles are degrees about each pose bone's local X/Y/Z axes. This is authoring
data, not approved animation or a substitute for instrument/contact QA.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

@dataclass(frozen=True)
class StageClip:
    name: str
    role: str
    bpm: int
    beats: int
    # Beat, bone, local Euler XYZ degrees. Keys are intentionally sparse;
    # Blender interpolates between keys and loops back to beat zero.
    keys: tuple[tuple[float, str, tuple[float, float, float]], ...]

ROLES = ("singer", "guitar", "bass", "drums", "keys", "dj")
# Movement amplitudes are deliberately restrained until real weighted meshes
# and guitar, microphone, drumstick and keyboard contact are reviewed.
MOTIONS = {
    "singer": (
        ("idle-breath", 2, {"Spine2": (2, 0, 0), "Head": (-2, 0, 0)}),
        ("verse-sway", 4, {"Spine2": (0, 0, 5), "Head": (0, 0, -3), "Shoulder.L": (0, 0, 3)}),
        ("chorus-lift", 4, {"Spine2": (-4, 0, 0), "Head": (4, 0, 0), "Shoulder.L": (0, 0, 8)}),
        ("mic-lean", 2, {"Spine2": (5, 0, 0), "Head": (-3, 0, 0)}),
        ("crowd-call", 4, {"Spine2": (-3, 0, 0), "Shoulder.L": (0, 0, 12)}),
        ("ballad-hold", 8, {"Spine2": (0, 0, 3), "Head": (3, 0, 0)}),
    ),
    "guitar": (
        ("rhythm-eighths", 2, {"LowerArm.R": (0, 0, 9), "Hand.R": (0, 0, -5)}),
        ("rhythm-sixteenths", 2, {"LowerArm.R": (0, 0, 12), "Hand.R": (0, 0, -7)}),
        ("power-chord", 4, {"Spine2": (0, 0, 5), "LowerArm.R": (0, 0, 10)}),
        ("lead-solo", 4, {"Spine2": (-3, 0, 0), "Head": (3, 0, 0), "LowerArm.R": (0, 0, 7)}),
        ("riff-headbang", 4, {"Head": (10, 0, 0), "Neck": (3, 0, 0)}),
        ("outro-ring", 8, {"Spine2": (-3, 0, 0), "Head": (-4, 0, 0)}),
    ),
    "bass": (
        ("fingerstyle-groove", 2, {"Hand.R": (0, 0, 6), "LowerArm.R": (0, 0, 4)}),
        ("pick-groove", 2, {"Hand.R": (0, 0, 9), "LowerArm.R": (0, 0, 5)}),
        ("half-time-sway", 4, {"Spine2": (0, 0, 5), "Head": (0, 0, -4)}),
        ("walking-line", 4, {"Spine2": (0, 0, 3), "Shoulder.R": (0, 0, 4)}),
        ("bass-break", 4, {"Head": (7, 0, 0), "Spine2": (0, 0, 4)}),
        ("final-note", 8, {"Head": (-3, 0, 0), "Spine2": (-2, 0, 0)}),
    ),
    "drums": (
        ("closed-hihat", 2, {"LowerArm.R": (0, 0, 7), "Hand.R": (0, 0, 7)}),
        ("backbeat", 2, {"LowerArm.L": (0, 0, 10), "Hand.L": (0, 0, 8)}),
        ("ride-pattern", 4, {"LowerArm.R": (0, 0, 8), "Hand.R": (0, 0, 5)}),
        ("tom-fill", 4, {"LowerArm.L": (0, 0, 12), "LowerArm.R": (0, 0, 11)}),
        ("crash-accent", 4, {"Shoulder.R": (0, 0, 9), "LowerArm.R": (0, 0, 12)}),
        ("double-kick-drive", 2, {"Spine2": (2, 0, 0), "Head": (-2, 0, 0)}),
    ),
    "keys": (
        ("two-hand-comp", 4, {"Hand.L": (0, 0, 5), "Hand.R": (0, 0, -5)}),
        ("arpeggio", 4, {"Hand.R": (0, 0, 7), "LowerArm.R": (0, 0, 4)}),
        ("piano-ballad", 8, {"Spine2": (3, 0, 0), "Head": (-2, 0, 0)}),
        ("synth-stab", 2, {"Hand.L": (0, 0, 8), "Hand.R": (0, 0, 8)}),
        ("organ-swell", 8, {"Spine2": (0, 0, 4), "Head": (0, 0, -3)}),
        ("keyboard-solo", 4, {"Hand.R": (0, 0, 9), "Head": (3, 0, 0)}),
    ),
    "dj": (
        ("deck-cue", 4, {"Hand.R": (0, 0, 6), "Head": (0, 0, 4)}),
        ("crossfader", 4, {"Hand.L": (0, 0, 8), "Spine2": (0, 0, 3)}),
        ("knob-sweep", 4, {"Hand.R": (0, 0, 7), "Head": (3, 0, 0)}),
        ("drop-build", 8, {"Spine2": (-4, 0, 0), "Shoulder.L": (0, 0, 8)}),
        ("crowd-hype", 4, {"Shoulder.L": (0, 0, 12), "Head": (-3, 0, 0)}),
        ("head-nod", 2, {"Head": (8, 0, 0), "Neck": (2, 0, 0)}),
    ),
}

# Additional performance phrases broaden song-section variety without assuming
# authored instrument grips or solved IK. Contact-dependent phrases remain QA-only.
ADDITIONAL_MOTIONS = {
    "singer": (
        ("intro-anticipation", 4, {"Head": (0, 0, 6), "Spine2": (0, 0, -3)}),
        ("verse-step-pulse", 4, {"Hips": (0, 0, 4), "Spine2": (0, 0, -4)}),
        ("big-note-reach", 8, {"Head": (-5, 0, 0), "Shoulder.L": (0, 0, 14)}),
        ("quiet-bridge", 8, {"Head": (5, 0, 0), "Spine2": (3, 0, 0)}),
    ),
    "guitar": (
        ("palm-muted-drive", 2, {"Hand.R": (0, 0, 5), "LowerArm.R": (0, 0, 6)}),
        ("alternate-picking", 2, {"Hand.R": (0, 0, 10), "LowerArm.R": (0, 0, 4)}),
        ("solo-bend-emphasis", 4, {"Hand.L": (0, 0, 4), "Head": (-5, 0, 0)}),
        ("breakdown-stomp", 4, {"Hips": (0, 0, 5), "Head": (7, 0, 0)}),
    ),
    "bass": (
        ("syncopated-pluck", 2, {"Hand.R": (0, 0, 8), "Head": (0, 0, 4)}),
        ("octave-jump", 4, {"Hand.L": (0, 0, 5), "LowerArm.L": (0, 0, 3)}),
        ("chorus-lock-in", 4, {"Spine2": (0, 0, 6), "Head": (4, 0, 0)}),
        ("low-note-sustain", 8, {"Head": (-4, 0, 0), "Spine2": (-2, 0, 0)}),
    ),
    "drums": (
        ("ghost-note", 2, {"Hand.L": (0, 0, 4), "LowerArm.L": (0, 0, 3)}),
        ("open-hihat-accent", 4, {"Hand.R": (0, 0, 10), "LowerArm.R": (0, 0, 8)}),
        ("floor-tom-run", 4, {"LowerArm.R": (0, 0, 12), "Spine2": (0, 0, 4)}),
        ("both-crash-finale", 8, {"Shoulder.L": (0, 0, 12), "Shoulder.R": (0, 0, 12)}),
    ),
    "keys": (
        ("left-hand-bass", 4, {"Hand.L": (0, 0, 7), "Head": (0, 0, -3)}),
        ("right-hand-trill", 2, {"Hand.R": (0, 0, 8), "LowerArm.R": (0, 0, 3)}),
        ("pad-build", 8, {"Spine2": (-3, 0, 0), "Head": (0, 0, 4)}),
        ("final-chord", 8, {"Hand.L": (0, 0, 6), "Hand.R": (0, 0, 6)}),
    ),
    "dj": (
        ("two-deck-mix", 4, {"Hand.L": (0, 0, 6), "Hand.R": (0, 0, -6)}),
        ("filter-build", 8, {"Hand.R": (0, 0, 8), "Spine2": (0, 0, 4)}),
        ("beat-juggle", 4, {"Hand.L": (0, 0, 9), "Hand.R": (0, 0, 9)}),
        ("drop-celebration", 8, {"Shoulder.L": (0, 0, 15), "Head": (-5, 0, 0)}),
    ),
}
for _role, _entries in ADDITIONAL_MOTIONS.items():
    MOTIONS[_role] += _entries

def build_catalogue(bpm: int = 120) -> tuple[StageClip, ...]:
    if not 50 <= bpm <= 220:
        raise ValueError("Stage BPM must be between 50 and 220.")
    clips = []
    for role, entries in MOTIONS.items():
        for name, beats, amplitudes in entries:
            keys = []
            for bone, angles in amplitudes.items():
                keys.extend(((0., bone, (0., 0., 0.)),
                             (beats / 2, bone, angles),
                             (float(beats), bone, (0., 0., 0.))))
            clips.append(StageClip(f"{role}-{name}", role, bpm, beats, tuple(keys)))
    return tuple(clips)

def validate_catalogue(clips: tuple[StageClip, ...], bones: set[str]) -> None:
    names = set()
    for clip in clips:
        if clip.name in names or clip.role not in ROLES or clip.beats <= 0:
            raise ValueError(f"Invalid or duplicate stage clip: {clip.name}")
        names.add(clip.name)
        for beat, bone, angles in clip.keys:
            if bone not in bones or not 0 <= beat <= clip.beats or len(angles) != 3 or not all(isfinite(a) and abs(a) <= 25 for a in angles):
                raise ValueError(f"Invalid key in {clip.name}: {bone}")
