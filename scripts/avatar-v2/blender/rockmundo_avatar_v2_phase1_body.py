"""Prepare and objectively test BOTH real, manually fitted Avatar V2 body rigs.

Blender 4.3+ authoring-only pipeline. The *source* .blend is never overwritten.
prepare: automatic *initial* heat binding, twist distribution, eight genuine
skin-material/occlusion regions and independently skinned measured eyeballs.
assess: strict full-body weight + authored corrective audits, deterministic
performance-pose evaluation, real Blender contact sheets and binary GLB proof.

Never writes public/avatar-v2 or declares a candidate production validated.
Manual repainting, sculpted corrective shapes and independent artist sign-off
remain required after initial preparation. Run this independently per frame.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import sys

import bpy
from mathutils import Quaternion, Vector

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))
from phase1_body_contract import (  # noqa: E402
    ATTACHMENT_BONES, CORRECTIVES, DEFORM_BONES, POSES, REGIONS,
    DIGITS, CORRECTIVE_DRIVERS, normalise_four, pose_corrective_weights,
    propose_missing_finger_weights, region_from_weights, report_errors,
)
from verify_glb_binary import verify_skin_binary  # noqa: E402

ARMATURE = "RMV2_Armature"
TWIST_PAIRS = (
    ("UpperArm", "UpperArmTwist", .12),
    ("LowerArm", "ForearmTwist", .105),
    ("UpperLeg", "ThighTwist", .17),
)
SENTINELS = {
    "reach": ("UpperArm.L", "UpperArm.R"),
    "arm-fold": ("LowerArm.L", "LowerArm.R"),
    "wrist-roll": ("Hand.L", "Hand.R"),
    "crouch": ("UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"),
    "seated-drums": ("UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R"),
    "ankle-flex": ("Foot.L", "Foot.R", "Toe.L", "Toe.R"),
    "instrument-grip": tuple(f"{digit}{joint}.{side}"
                             for side in ("L", "R") for digit in DIGITS
                             for joint in (1, 2, 3)),
    "torso-twist": ("Spine2",),
}


def args_from_cli() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", required=True, choices=("prepare", "assess"))
    p.add_argument("--frame", required=True, choices=("masculine", "feminine"))
    p.add_argument("--body", required=True, help="Unique continuous real-source body object")
    p.add_argument("--output-root", type=pathlib.Path, required=True,
                   help="Authoring-only destination OUTSIDE public/avatar-v2")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return p.parse_args(argv)


def preflight(args):
    scene = bpy.context.scene
    if scene.get("rockmundoAvatarV2SourceFrame") != args.frame:
        raise RuntimeError("Source scene frame does not match requested fitted body")
    if "CC0" not in str(scene.get("rockmundoAvatarV2SourceLicense", "")).upper():
        raise RuntimeError("Source must be the pinned verified CC0 body")
    if any(part == "public" for part in args.output_root.resolve().parts):
        raise RuntimeError("Phase 1 work is quarantined from the public runtime asset tree")
    rig = bpy.data.objects.get(ARMATURE)
    body = bpy.data.objects.get(args.body)
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("Missing semantic RMV2_Armature")
    if body is None or body.type != "MESH" or len(body.data.vertices) < 1000:
        raise RuntimeError("Specify the actual continuous CC0 body, not a preview blockout")
    if rig.get("rockmundoAvatarV2ExperimentalHeadMotion") or body.get("rockmundoAvatarV2ExperimentalHeadWeightOnly"):
        raise RuntimeError("Do not promote the unapproved head-rig experiment")
    if rig.get("rockmundoAvatarV2Frame") != args.frame:
        raise RuntimeError("Rig frame differs from source body")
    try:
        fit = json.loads(str(rig.get("rockmundoAvatarV2ArtistFitReport", "")))
    except ValueError as exc:
        raise RuntimeError("Apply artist-fitted joint handles before binding") from exc
    if fit.get("action") != "artist-markers-applied" or fit.get("reviewed") is not True:
        raise RuntimeError("Missing reviewed anatomical joint-handle report")
    if fit.get("movedFromGuide", 0) < 8 or fit.get("jointCount", 0) < len(DEFORM_BONES):
        raise RuntimeError("Fitting is incomplete, or the rig is missing full articulation")
    required = set(DEFORM_BONES) | set(ATTACHMENT_BONES)
    available = set(rig.data.bones.keys())
    if required - available:
        raise RuntimeError("Missing production skeleton bones: " + ", ".join(sorted(required - available)))
    for side in ("L", "R"):
        for name in (f"Eye.{side}", f"EarAnchor.{side}"):
            bone = rig.data.bones[name]
            if bone.parent != rig.data.bones["Head"]:
                raise RuntimeError(f"{name} must attach directly to Head")
        if rig.data.bones[f"EarAnchor.{side}"].use_deform:
            raise RuntimeError("Earring anchors are attachment bones, not skin deformers")
    return rig, body, fit


def selected_parent_bind(body, rig):
    if any(m.type == "ARMATURE" for m in body.modifiers):
        raise RuntimeError("Body already has an Armature modifier; don't destroy artist-painted weights")
    if any(g.name in DEFORM_BONES for g in body.vertex_groups):
        raise RuntimeError("Body already has semantic skinning groups; do not overwrite authored weights")
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    body.hide_set(False)
    rig.hide_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    # Blender's bone-heat binding is an INITIAL PASS ONLY; failed/zero finger
    # weights must be painted by an artist, never filled with nearest-bone fakes.
    bpy.ops.object.parent_set(type="ARMATURE_AUTO", keep_transform=True)
    if not any(m.type == "ARMATURE" and m.object == rig for m in body.modifiers):
        raise RuntimeError("Blender heat binding did not bind the body to the reviewed rig")


def vertex_weights(obj, vertex, allowed):
    return {obj.vertex_groups[m.group].name: float(m.weight)
            for m in vertex.groups if m.group < len(obj.vertex_groups)
            and obj.vertex_groups[m.group].name in allowed and m.weight > .0001}


def twist_seed_and_normalise(body, rig):
    groups = {name: body.vertex_groups.get(name) for name in DEFORM_BONES}
    for name in DEFORM_BONES:
        if not groups[name]:
            groups[name] = body.vertex_groups.new(name=name)
    segments = []
    for side in ("L", "R"):
        for base, helper, radius in TWIST_PAIRS:
            a = rig.matrix_world @ rig.data.bones[f"{base}.{side}"].head_local
            b = rig.matrix_world @ rig.data.bones[f"{base}.{side}"].tail_local
            segments.append((f"{base}.{side}", f"{helper}.{side}", a, b - a, radius))
    # Real eyeballs have their OWN eye-bone skin. Bone-heat can otherwise
    # incorrectly attach nearby face vertices to Eye.L/R; reject that bleed
    # rather than exporting extra hidden influences into a four-weight body.
    for eye_name in ("Eye.L", "Eye.R"):
        leaked = body.vertex_groups.get(eye_name)
        if leaked:
            body.vertex_groups.remove(leaked)
    for v in body.data.vertices:
        weights = vertex_weights(body, v, set(DEFORM_BONES))
        position = body.matrix_world @ v.co
        for parent, helper, a, direction, radius in segments:
            if weights.get(parent, 0) < .08:
                continue
            scale = direction.length_squared
            if scale < 1e-6:
                raise RuntimeError(f"Degenerate fitted twist segment {parent}")
            t = (position - a).dot(direction) / scale
            nearest = a + direction * min(max(t, 0), 1)
            if .3 <= t <= .93 and (position - nearest).length < radius:
                # Transfer, never invent weight: helper and parent remain
                # anatomically associated. An artist must refine roll gradients.
                share = weights[parent] * (.12 + .27 * (t - .3) / .63)
                weights[parent] -= share
                weights[helper] = weights.get(helper, 0) + share
        # If heat left a vertex completely weightless, retain it for the
        # fail-closed audit instead of silently binding to the hips.
        if not weights:
            continue
        kept = normalise_four(weights)
        for membership in list(v.groups):
            if membership.group < len(body.vertex_groups):
                group = body.vertex_groups[membership.group]
                if group.name in DEFORM_BONES and group.name not in kept:
                    group.remove([v.index])
        for name, weight in kept.items():
            groups[name].add([v.index], weight, "REPLACE")


def seed_unapproved_finger_paint(body, rig):
    """Optional INITIAL STARTING PAINT on fitted real fingers; not certification.

    Never runs on the unfitted diagnostics probe or replaces hand-painted
    finger joints. If the fitted hand has no trustworthy base hand weights,
    emit actionable blockers rather than transfer weight from random arms.
    """
    required = {
        f"{digit}{joint}.{side}": (
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].head_local),
            tuple(rig.matrix_world @ rig.data.bones[f"{digit}{joint}.{side}"].tail_local),
        )
        for side in ("L", "R") for digit in DIGITS for joint in (1, 2, 3)
    }
    original = [vertex_weights(body, vertex, set(DEFORM_BONES))
                for vertex in body.data.vertices]
    locations = [tuple(body.matrix_world @ vertex.co) for vertex in body.data.vertices]
    proposals, report = propose_missing_finger_weights(locations, original, required)
    for index, weights in proposals.items():
        for name in original[index]:
            if name not in weights:
                body.vertex_groups[name].remove([index])
        for name, weight in weights.items():
            group = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
            group.add([index], weight, "REPLACE")
    report["sourceFrame"] = rig.get("rockmundoAvatarV2Frame")
    return report


def assign_eight_skin_regions(body):
    """Partition the existing continuous CC0 polygons by true weighted bones.

    Material copies preserve original authored PBR nodes and UVs. No duplicate
    planar fake meshes; separate region tags survive the GLB export on materials.
    """
    original = list(body.data.materials)
    if not original or any(m is None for m in original):
        raise RuntimeError("Continuous body must already carry real source skin material")
    originals = [poly.material_index for poly in body.data.polygons]
    materials = {}
    counts = {region: 0 for region in REGIONS}
    allowed = set(DEFORM_BONES)
    for poly, original_index in zip(body.data.polygons, originals):
        vertices = [vertex_weights(body, body.data.vertices[i], allowed) for i in poly.vertices]
        region = region_from_weights(vertices)
        counts[region] += 1
        key = (original_index, region)
        if key not in materials:
            source = original[original_index]
            material = source.copy()
            material.name = f"RMV2_Skin_{region}_{original_index}"
            material["rockmundoBodyRegion"] = region
            materials[key] = len(body.data.materials)
            body.data.materials.append(material)
        poly.material_index = materials[key]
    if not all(counts.values()):
        raise RuntimeError("Missing body occlusion polygons: " +
                           ", ".join(r for r, count in counts.items() if not count))
    return counts


def bind_original_eyes(rig, frame):
    """True independent source eyeballs rotate around fitted Eye.L/Eye.R."""
    eyes = {}
    for side in ("L", "R"):
        matches = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"
                   and obj.name.lower().endswith(f".eye.{side.lower()}")
                   and obj.get("rockmundoAvatarV2Frame") in (None, frame)]
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one real source eye mesh Eye.{side}")
        eye = matches[0]
        if any(m.type == "ARMATURE" for m in eye.modifiers):
            raise RuntimeError("Original eyeball is already rigged; preserve the authored weights")
        group = eye.vertex_groups.get(f"Eye.{side}") or eye.vertex_groups.new(name=f"Eye.{side}")
        group.add(list(range(len(eye.data.vertices))), 1, "REPLACE")
        modifier = eye.modifiers.new("RMV2_eye_skin", "ARMATURE")
        modifier.object = rig
        eye["rockmundoBoneBinding"] = f"Eye.{side}"
        eye["rockmundoAvatarV2Phase1Candidate"] = True
        eyes[side] = eye
    return eyes


def audit_weights(body, rig):
    names = set(DEFORM_BONES)
    counts = {name: 0 for name in DEFORM_BONES}
    empty = too_many = unnormalised = invalid = 0
    # Source sculpt/provenance landmark groups must survive the authoring pass.
    # They cannot silently deform the rig: only non-contract BONE weights fail.
    unrelated = sorted(g.name for g in body.vertex_groups
                       if g.name not in names and g.name not in rig.data.bones
                       and not g.name.startswith("RMV2_"))
    illicit_bones = set()
    for v in body.data.vertices:
        for membership in v.groups:
            if membership.group >= len(body.vertex_groups):
                invalid += 1
                continue
            name = body.vertex_groups[membership.group].name
            if not math.isfinite(membership.weight) or membership.weight < 0:
                invalid += 1
            if name in rig.data.bones and name not in names and membership.weight > .0001:
                illicit_bones.add(name)
        skin = vertex_weights(body, v, names)
        if not skin:
            empty += 1
        if len(skin) > 4:
            too_many += 1
        if abs(sum(skin.values()) - 1) > .02:
            unnormalised += 1
        for name in skin:
            counts[name] += 1
    missing = sorted(name for name in DEFORM_BONES if not counts[name])
    # A token vertex cannot certify entire finger or axial twist deformation.
    insufficient = {name: {"weighted": count, "minimum": 4 if name.startswith(DIGITS) else 12}
                    for name, count in counts.items()
                    if count and count < (4 if name.startswith(DIGITS) else 12)}
    errors = []
    if not any(m.type == "ARMATURE" and m.object == rig for m in body.modifiers):
        errors.append("Body Armature modifier is missing or targets another rig")
    if illicit_bones:
        errors.append("Body has non-body bone influences: " + ", ".join(sorted(illicit_bones)))
    if invalid or empty or too_many or unnormalised or missing or insufficient:
        errors.append(f"Skin audit: invalid={invalid}, empty={empty}, >4={too_many}, "
                      f"nonunit={unnormalised}, missing={missing}, insufficient={insufficient}")
    return {"vertices": len(body.data.vertices),
            "unweightedVertices": empty, "overInfluencedVertices": too_many,
            "unnormalisedVertices": unnormalised, "invalidWeights": invalid,
            "missingDeformBones": missing, "insufficientDeformBones": insufficient,
            "nonBodyBoneInfluences": sorted(illicit_bones),
            "ignoredSourceLandmarkGroups": unrelated,
            "weightedBoneVertexCounts": counts, "errors": errors}


def corrective_audit(body):
    """Do not accept a named empty key, one moved spike or an unrelated joint."""
    keys = body.data.shape_keys
    if keys is None or keys.key_blocks.get("Basis") is None:
        return []
    basis = keys.key_blocks["Basis"]
    approved = []
    region_bones = {
        "Shoulder": ("Shoulder", "UpperArm"),
        "Elbow": ("UpperArm", "LowerArm"),
        "Hip": ("Hips", "UpperLeg", "ThighTwist"),
        "Knee": ("UpperLeg", "LowerLeg"),
    }
    for name in CORRECTIVES:
        target = keys.key_blocks.get(name)
        if not target or len(target.data) != len(basis.data):
            continue
        side = "L" if name.endswith("Left") else "R"
        joint = next(j for j in region_bones if name.startswith(f"pose{j}"))
        bone_names = {f"{part}.{side}" if part != "Hips" else "Hips"
                      for part in region_bones[joint]}
        moved = 0
        for vertex in body.data.vertices:
            if sum(vertex_weights(body, vertex, bone_names).values()) < .15:
                continue
            if (target.data[vertex.index].co - basis.data[vertex.index].co).length >= .0005:
                moved += 1
                if moved >= 12:
                    approved.append(name)
                    break
    return approved


def mesh_world_positions(body):
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        if len(mesh.vertices) != len(body.data.vertices):
            raise RuntimeError("A modifier changed body topology; pose proof cannot use matching vertices")
        return [evaluated.matrix_world @ v.co for v in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()


def set_pose(rig, spec):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion.identity()
    for name, (x, y, z, degrees) in spec.items():
        bone = rig.data.bones[name]
        pb = rig.pose.bones[name]
        rest_world = rig.matrix_world.to_3x3() @ bone.matrix_local.to_3x3()
        local_axis = (rest_world.inverted() @ Vector((x, y, z))).normalized()
        pb.rotation_quaternion = Quaternion(local_axis, math.radians(degrees))
    bpy.context.view_layer.update()


def drive_correctives(body, spec):
    """Drive the same angle-based sculpt keys as the real 3D gig controller."""
    weights = pose_corrective_weights(spec)
    if body.data.shape_keys:
        for name, value in weights.items():
            key = body.data.shape_keys.key_blocks.get(name)
            if key:
                key.value = value
    bpy.context.view_layer.update()
    return weights


def assess_poses(body, rig):
    set_pose(rig, {})
    drive_correctives(body, {})
    before = mesh_world_positions(body)
    vertex_samples = {}
    for name in {bone for names in SENTINELS.values() for bone in names}:
        vertex_samples[name] = [
            v.index for v in body.data.vertices
            if vertex_weights(body, v, {name}).get(name, 0) > .22
        ]
    results = {}
    try:
        for pose, spec in POSES.items():
            set_pose(rig, spec)
            drive_correctives(body, {})
            uncorrected = mesh_world_positions(body)
            weights = drive_correctives(body, spec)
            after = mesh_world_positions(body)
            if any(not all(math.isfinite(coordinate) for coordinate in position)
                   for position in after):
                raise RuntimeError(f"Non-finite deformed geometry in {pose}")
            if len(before) != len(after):
                raise RuntimeError(f"Unexpected topology change in {pose}")
            active = {name: round(value, 4) for name, value in weights.items() if value > .01}
            corrected_mm = max(((a - b).length for a, b in zip(after, uncorrected)),
                               default=0) * 1000
            max_displacement = max(((a - b).length for a, b in zip(after, before)),
                                   default=0)
            morph_pass = (not active or corrected_mm >= .5)
            per_bone = {}
            for bone in SENTINELS[pose]:
                sample = vertex_samples[bone]
                if len(sample) < 3:
                    per_bone[bone] = {"sampled": len(sample), "pass": False,
                                      "error": "No meaningful deform surface"}
                    continue
                distances = [(after[i] - before[i]).length for i in sample]
                mean = sum(distances) / len(distances)
                minimum = .001 if bone.startswith(
                    ("Hand", "Thumb", "Index", "Middle", "Ring", "Pinky", "Toe")
                ) else .003
                per_bone[bone] = {
                    "sampled": len(sample),
                    "meanDisplacementMm": round(mean * 1000, 3),
                    "pass": minimum <= mean <= .85,
                }
            results[pose] = {
                "bones": per_bone,
                "activeCorrectives": active,
                "measuredCorrectiveDisplacementMm": round(corrected_mm, 3),
                "maxBodyDisplacementMm": round(max_displacement * 1000, 3),
                "correctivePass": morph_pass,
                "pass": bool(per_bone) and all(item.get("pass") for item in per_bone.values())
                        and morph_pass and max_displacement <= 1.25,
            }
    finally:
        drive_correctives(body, {})
        set_pose(rig, {})
    return results


def render_contact_sheet(body, rig, root, frame, *, only=None):
    """Real evaluated geometry with live-equivalent pose corrective weights."""
    scene = bpy.context.scene
    camera = bpy.data.objects.new("RMV2_Phase1ProofCamera",
                                  bpy.data.cameras.new("RMV2_Phase1ProofCamera"))
    scene.collection.objects.link(camera)
    old = (scene.camera, scene.render.engine, scene.render.filepath,
           scene.render.resolution_x, scene.render.resolution_y)
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    camera.data.type = "ORTHO"
    shots = []
    try:
        configurations = [
            ("front", {}, (0, -3.2, 1.0), (0, 0, .9), 2.25),
            ("side", {}, (3.2, 0, 1.0), (0, 0, .9), 2.25),
            ("back", {}, (0, 3.2, 1.0), (0, 0, .9), 2.25),
            ("reach", POSES["reach"], (0, -3.2, 1.0), (0, 0, .9), 2.25),
            ("arm-fold", POSES["arm-fold"], (0, -3.2, 1.0), (0, 0, .9), 2.25),
            ("wrist-roll", POSES["wrist-roll"], (0, -3.2, 1.0), (0, 0, .9), 2.25),
            ("crouch", POSES["crouch"], (3.2, -2.5, .9), (0, 0, .9), 2.25),
            ("seated-drums", POSES["seated-drums"], (3.2, -2.5, .9), (0, 0, .9), 2.25),
            ("ankle-flex", POSES["ankle-flex"], (3.2, -2.7, 1), (0, 0, .9), 2.25),
            ("instrument-grip", POSES["instrument-grip"], (0, -2.7, 1.25), (0, 0, .9), 2.25),
            ("torso-twist", POSES["torso-twist"], (0, -3.2, 1), (0, 0, .9), 2.25),
            ("instrument-grip-close", POSES["instrument-grip"], (.8, -1.3, 1.1),
             (.55, 0, 1.05), .65),
        ]
        for label, pose, location, target, scale in configurations:
            if only is not None and label not in only:
                continue
            set_pose(rig, pose)
            drive_correctives(body, pose)
            camera.location = location
            camera.data.ortho_scale = scale
            camera.rotation_euler = (Vector(target) - camera.location).to_track_quat(
                "-Z", "Y"
            ).to_euler()
            path = root / f"{frame}-phase1-{label}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            if not path.exists() or path.stat().st_size < 1024:
                raise RuntimeError(f"Missing actual Blender pose capture {path.name}")
            shots.append(path.name)
    finally:
        drive_correctives(body, {})
        set_pose(rig, {})
        scene.camera, scene.render.engine, scene.render.filepath, scene.render.resolution_x, scene.render.resolution_y = old
        bpy.data.objects.remove(camera, do_unlink=True)
    return shots


def candidate_export(frame, root, rig, body, eyes):
    file = root / f"{frame}-PHASE1-BODY-CANDIDATE-not-validated.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (rig, body, *eyes.values()):
        obj.select_set(True)
        obj["rockmundoAvatarV2PreviewOnly"] = True
        obj["rockmundoAvatarV2ProductionValidated"] = False
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(file), export_format="GLB", use_selection=True,
            export_skins=True, export_animations=False, export_extras=True,
            export_yup=True, export_cameras=False, export_lights=False,
            export_materials="EXPORT", export_all_influences=False,
        )
    finally:
        for obj in (rig, body, *eyes.values()):
            obj.pop("rockmundoAvatarV2PreviewOnly", None)
    evidence = verify_skin_binary(file.read_bytes())
    return {"file": file.name, "bytes": file.stat().st_size,
            "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            "binarySkin": evidence}


def main():
    args = args_from_cli()
    rig, body, fit = preflight(args)
    root = args.output_root.resolve() / args.frame
    root.mkdir(parents=True, exist_ok=True)
    if args.mode == "prepare":
        selected_parent_bind(body, rig)
        twist_seed_and_normalise(body, rig)
        finger_seed = seed_unapproved_finger_paint(body, rig)
        regions = assign_eight_skin_regions(body)
        eyes = bind_original_eyes(rig, args.frame)
        body["rockmundoAvatarV2Phase1Candidate"] = True
        rig["rockmundoAvatarV2SkinWeightsAuthored"] = False
        rig["rockmundoAvatarV2ProductionValidated"] = False
        scene = root / f"{args.frame}-phase1-INITIAL-BIND-needs-repaint.blend"
        bpy.ops.wm.save_as_mainfile(filepath=str(scene))
        audit = audit_weights(body, rig)
        report = {"schema": "rockmundo.avatar-v2-phase1-initial-bind", "version": 1,
                  "frame": args.frame, "candidateOnly": True, "jointFit": fit,
                  "body": body.name, "skin": audit, "fingerStartingPaint": finger_seed,
                  "regions": regions,
                  "eyeMeshes": [obj.name for obj in eyes.values()],
                  "sourceScene": scene.name,
                  "mustRepaintAndAuthorCorrectives": True,
                  "productionValidated": False}
        (root / f"{args.frame}-phase1-initial-bind-report.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8")
        print(json.dumps(report, indent=2))
        return

    # Reopen the artist-cleaned file, not the unmodified initial binding.
    if not body.get("rockmundoAvatarV2Phase1Candidate"):
        raise RuntimeError("Assess only a prepared, subsequently artist-cleaned body")
    eyes = {}
    for side in ("L", "R"):
        matches = [o for o in bpy.context.scene.objects
                   if o.type == "MESH" and o.get("rockmundoBoneBinding") == f"Eye.{side}"]
        if len(matches) != 1:
            raise RuntimeError(f"Missing independent real eye binding Eye.{side}")
        eyes[side] = matches[0]
    region_names = set()
    for material in body.data.materials:
        if material and material.get("rockmundoBodyRegion") in REGIONS:
            if any(material == body.data.materials[p.material_index] for p in body.data.polygons):
                region_names.add(material["rockmundoBodyRegion"])
    audited = audit_weights(body, rig)
    correctives = corrective_audit(body)
    poses = assess_poses(body, rig)
    report = {
        "schema": "rockmundo.avatar-v2-phase1-body-assessment",
        "version": 1, "frame": args.frame, "jointFit": fit, "body": body.name,
        **audited, "bodyRegions": sorted(region_names),
        "correctives": sorted(correctives), "poseResults": poses,
        "previewOnly": True, "productionValidated": False,
        "independentArtistReview": "pending",
    }
    report["errors"] = audited["errors"] + report_errors(report)
    path = root / f"{args.frame}-phase1-assessment.json"
    if report["errors"]:
        path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8")
        raise RuntimeError("Phase 1 candidate blocked; see " + str(path) +
                           ": " + "; ".join(report["errors"]))
    report["contactViews"] = render_contact_sheet(body, rig, root, args.frame)
    report["candidateGLB"] = candidate_export(args.frame, root, rig, body, eyes)
    bpy.ops.wm.save_as_mainfile(filepath=str(root / f"{args.frame}-phase1-ASSESSMENT-CANDIDATE.blend"))
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
