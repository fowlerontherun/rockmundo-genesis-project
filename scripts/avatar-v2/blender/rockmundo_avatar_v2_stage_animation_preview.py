"""Generate 60 UNAPPROVED Blender Action previews from the draft stage clip catalogue.

Run in a Blender scene with an RMV2_Armature. Saves editable Action datablocks
but never marks them artist-approved or exports production gameplay animation.
"""
from __future__ import annotations
import argparse
import json
import pathlib
import sys
import bpy
from math import radians
from mathutils import Euler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from stage_performance_catalogue import build_catalogue, validate_catalogue

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--armature", default="RMV2_Armature")
    parser.add_argument("--bpm", type=int, default=120)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    rig = bpy.data.objects.get(args.armature)
    if not rig or rig.type != "ARMATURE":
        raise SystemExit("A real named Avatar V2 armature is required.")
    if not 12 <= args.fps <= 120:
        raise SystemExit("Preview FPS must be between 12 and 120.")
    clips = build_catalogue(args.bpm)
    validate_catalogue(clips, set(rig.pose.bones.keys()))
    scene = bpy.context.scene
    scene.render.fps = args.fps
    if rig.animation_data is None:
        rig.animation_data_create()
    # Check all target Action names before creating any datablocks. A second
    # run must never leave half a catalogue alongside existing artist edits.
    conflicts = ["RMV2_DRAFT_" + clip.name for clip in clips
                 if bpy.data.actions.get("RMV2_DRAFT_" + clip.name)]
    if conflicts:
        raise SystemExit("Existing Actions would be overwritten: " + ", ".join(conflicts[:10]))
    report = []
    for clip in clips:
        name = "RMV2_DRAFT_" + clip.name
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        touched = {bone for _, bone, _ in clip.keys}
        # Explicit rest keys on every animated bone avoid inheriting another
        # clip's pose during Action switching or NLA preview.
        for bone_name in touched:
            bone = rig.pose.bones[bone_name]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = Euler((0., 0., 0.))
        for beat, bone_name, degrees in sorted(clip.keys):
            bone = rig.pose.bones[bone_name]
            bone.rotation_euler = Euler(tuple(radians(angle) for angle in degrees))
            frame = 1 + round(beat * 60 / clip.bpm * args.fps)
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)
        action["rockmundoAvatarV2DraftOnly"] = True
        action["rockmundoAvatarV2ArtistApproved"] = False
        action["rockmundoAvatarV2Role"] = clip.role
        action["rockmundoAvatarV2Bpm"] = clip.bpm
        action["rockmundoAvatarV2LoopBeats"] = clip.beats
        report.append({"name": name, "role": clip.role, "beats": clip.beats})
        rig.animation_data.action = None
    # These Actions key rotation_euler, so the target bones MUST remain in
    # Euler mode for playback. Resetting them to quaternion silently makes
    # all 60 clips appear motionless despite valid Action F-curves.
    animated = {bone_name for clip in clips for _, bone_name, _ in clip.keys}
    for bone in rig.pose.bones:
        if bone.name in animated:
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = Euler((0., 0., 0.))
    scene.frame_set(1)
    rig["rockmundoAvatarV2PerformanceClipsDraftOnly"] = True
    output = pathlib.Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(json.dumps({"draftClips": len(report), "output": str(output), "clips": report}, indent=2))

if __name__ == "__main__":
    main()
