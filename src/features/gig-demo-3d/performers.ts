import { detailedCrowdArea, isTvStudioAudienceBlocked } from './venueAudience';
import { resolveTotpStudioStageGeometry } from './totpStudioGeometry';
import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { microphone } from './stage';
import { buildInstrument, type InstrumentRig } from './instruments';
import { stageAssignment, type InstrumentId, type VocalRole } from './instrumentCatalog';
import { crowdAppearances, crowdMaterial, crowdMotion, CROWD_LIMIT, CROWD_VARIANTS } from './crowdAnimation';
import { circlePitPosition, circlePitSlots, crowdEventPlan } from './crowdChoreography';
import { singerGesture, smoothMotion, vocalPhrase } from './performanceMotion';
import { createVocalMouth } from './vocalFace';
import { seededRandom } from './config';
import { visibleTattoosForClothing } from '@/features/player-model/tattoos';
import { assemblePlayerModel, disposeModel, loadModelLibrary, requiredModelFiles } from '@/features/player-model/model';
import type { ModelLibrary } from '@/features/player-model/model';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import { buildProceduralGarment, type GarmentRigAnchor } from '@/features/clothing-preview/proceduralGarmentRenderer';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { CrowdTuningOptions } from '@/features/gig-experience/viewer/engine/CrowdTuning';
import type { VenueProfile } from './venueProfile';
import type { ConcertPerformer, PerformanceSection, StageRole } from './liveTypes';
type Role = StageRole;
interface RestBone {
    bone: T.Bone;
    quaternion: T.Quaternion;
    position: T.Vector3;
}
const UP = new T.Vector3(0, 1, 0);
/** Aim in world space so the imported rig's unusual bind axes are preserved. */
function aim(bone: T.Bone, child: T.Bone, target: T.Vector3) {
    const start = bone.getWorldPosition(new T.Vector3());
    const current = child.getWorldPosition(new T.Vector3()).sub(start).normalize();
    const desired = target.clone().sub(start).normalize();
    const world = new T.Quaternion().setFromUnitVectors(current, desired).multiply(bone.getWorldQuaternion(new T.Quaternion()));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
    bone.updateWorldMatrix(false, true);
}
function reach(upper: T.Bone | undefined, lower: T.Bone | undefined, hand: T.Bone | undefined, target: T.Vector3, pole: T.Vector3) {
    if (!upper || !lower || !hand)
        return;
    const start = upper.getWorldPosition(new T.Vector3());
    const middle = lower.getWorldPosition(new T.Vector3()), end = hand.getWorldPosition(new T.Vector3());
    const a = start.distanceTo(middle), b = middle.distanceTo(end);
    const direction = target.clone().sub(start);
    const distance = T.MathUtils.clamp(direction.length(), Math.abs(a - b) + 0.001, a + b - 0.001);
    direction.normalize();
    const along = (a * a + distance * distance - b * b) / (2 * distance);
    const bend = pole.clone().sub(start);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    if (bend.lengthSq() < 0.01)
        bend.crossVectors(direction, UP).normalize();
    const elbow = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    aim(upper, lower, elbow);
    aim(lower, hand, target);
}
function aimAttachedTool(tool: T.Object3D, localAxis: T.Vector3, worldTarget: T.Vector3) {
    if (!tool.parent) return;
    const start = tool.getWorldPosition(new T.Vector3());
    const direction = worldTarget.clone().sub(start);
    if (direction.lengthSq() < 1e-6) return;
    direction.normalize();
    const worldRotation = new T.Quaternion().setFromUnitVectors(localAxis, direction);
    const parentWorld = tool.parent.getWorldQuaternion(new T.Quaternion());
    tool.quaternion.copy(parentWorld.invert().multiply(worldRotation));
    tool.updateWorldMatrix(false, true);
}
export class Musician {
    root = new T.Group();
    model: T.Object3D;
    bones = new Map<string, T.Bone>();
    private rest: RestBone[] = [];
    instrumentRig: InstrumentRig | null = null;
    equipment: T.Group | null = null;
    private equipmentStageAnchor: T.Vector3 | null = null;
    fanPose: 'idle' | 'raised' | 'clapOpen' | 'clapClosed' | 'danceLeft' | 'danceRight' | 'runLeft' | 'runRight' = 'idle';
    id = '';
    performing = true;
    walking = false;
    action: string | null = null;
    interactionTarget: T.Vector3 | null = null;
    interactionStrength = 0;
    performanceSection: PerformanceSection = 'idle';
    sectionProgress = 0;
    private scale: number;
    private bodyBuild = 1;
    private vocalRole: VocalRole = null;
    private mouth: T.Mesh | null = null;
    constructor(source: T.Object3D, public role: Role, position: [
        number,
        number,
        number
    ], public phase = 0, tint = '#728092', appearance?: PlayerAppearance, instrument?: InstrumentId | null, vocal?: VocalRole, richClothing: ResolvedEquippedClothing[] = []) {
        this.vocalRole = vocal ?? null;
        this.model = clone(source);
        this.root.add(this.model);
        this.root.position.set(...position);
        this.model.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(this.model), height = bounds.max.y - bounds.min.y;
        this.scale = 1.78 / Math.max(0.01, height);
        this.model.scale.multiplyScalar(this.scale);
        this.model.position.y -= bounds.min.y * this.scale;
        this.model.traverse(object => {
            if (object instanceof T.Bone) {
                this.bones.set(object.name.replace(/([a-z0-9])([LR])$/, '$1.$2').replace(/_/g, '.').replace(/^Wrist\./, 'Hand.'), object);
                this.rest.push({ bone: object, quaternion: object.quaternion.clone(), position: object.position.clone() });
            }
            if (object instanceof T.Mesh) {
                object.geometry = object.geometry.clone();
                object.castShadow = true;
                object.receiveShadow = true;
                object.frustumCulled = false;
                const configure = (sourceMat: T.Material) => {
                    const mat = sourceMat.clone() as T.MeshStandardMaterial;
                    if (mat.isMeshStandardMaterial) {
                        if (mat.map)
                            mat.map = mat.map.clone();
                        const skin = /skin|eye|hair/i.test(mat.name);
                        if (!appearance) {
                            mat.metalness = /earring/i.test(mat.name) ? 0.6 : 0;
                            mat.roughness = skin ? 0.69 : 0.82;
                        }
                        if (!appearance && /lightblue|blue|green|red_dark/i.test(mat.name))
                            mat.color.set(tint);
                        if (!appearance && /black/i.test(mat.name)) {
                            mat.color.set('#222630');
                            mat.roughness = 0.55;
                        }
                    }
                    return mat;
                };
                object.material = Array.isArray(object.material) ? object.material.map(configure) : configure(object.material);
            }
        });
        // Procedural garments are authored in the same normalized rest-space used by
        // the live fitting room. Attach their individual pieces to the performer
        // skeleton before applying non-uniform body scaling so sleeves, legs, shoes,
        // hats and torso pieces inherit the same animation as the character.
        if (richClothing.length) {
            this.root.updateMatrixWorld(true);
            for (const resolved of richClothing) {
                const garment = buildProceduralGarment(resolved.item, resolved.variant);
                this.root.add(garment);
                this.root.updateMatrixWorld(true);
                const pieces: T.Mesh[] = [];
                garment.traverse(object => {
                    if (object instanceof T.Mesh)
                        pieces.push(object);
                });
                for (const piece of pieces) {
                    piece.frustumCulled = false;
                    const anchorName = String(piece.userData.rigAnchor || 'Torso') as GarmentRigAnchor;
                    const anchor = this.bones.get(anchorName);
                    if (anchor)
                        anchor.attach(piece);
                    else
                        this.root.attach(piece);
                }
                garment.removeFromParent();
            }
        }
        if (this.hasVocals() && this.bones.has('Head')) {
            this.mouth = createVocalMouth(this.root, this.model, this.bones.get('Head')!);
        }
        if (appearance) {
            this.bodyBuild = appearance.body.build;
            this.root.scale.set(appearance.body.build, appearance.body.height, appearance.body.build);
        }
        const assignment = stageAssignment(instrument, role);
        if (assignment.instrument && role !== 'fan') {
            this.instrumentRig = buildInstrument(assignment.instrument, appearance?.equipment.instrument.color);
            if (this.instrumentRig.stationary) {
                this.equipment = new T.Group();
                this.equipment.add(this.instrumentRig.root);
            } else {
                // Handheld instruments need a little more chest clearance on wider
                // avatars. Move the whole rig forward so its grips and IK targets
                // remain coherent with the visual instrument.
                const family = this.instrumentRig.family;
                const forward = family === 'strum' || family === 'bow' || family === 'upright'
                    ? Math.max(0, this.bodyBuild - 1) * .16
                    : family === 'brass' || family === 'reed' || family === 'flute'
                        ? Math.max(0, this.bodyBuild - 1) * .08
                        : 0;
                this.instrumentRig.root.position.z += forward;
                this.root.add(this.instrumentRig.root);
            }
            if (vocal && assignment.instrument !== 'vocal_performance') {
                this.equipment ??= new T.Group();
                microphone(this.equipment, [.02, 0, .44], 1.50 * (appearance?.body.height ?? 1));
            }
            if (this.instrumentRig?.family === 'voice') {
                const handheld = this.instrumentRig.root.getObjectByName('playing-handheld-microphone');
                const hand = this.bones.get('Hand.R');
                if (handheld && hand) {
                    this.root.updateMatrixWorld(true);
                    hand.attach(handheld);
                    handheld.position.set(.015, -.015, -.06);
                    handheld.rotation.set(-.15, 0, .08);
                    handheld.userData.attachedToHand = true;
                }
            }
            if (this.instrumentRig?.family === 'kit') {
                const sticks = this.instrumentRig.tools.filter(tool => tool.name === 'playing-stick');
                (['L', 'R'] as const).forEach((side, index) => {
                    const hand = this.bones.get(`Hand.${side}`);
                    const stick = sticks[index];
                    if (!hand || !stick) return;
                    this.root.updateMatrixWorld(true);
                    hand.attach(stick);
                    stick.name = `playing-stick-${side.toLowerCase()}`;
                    // Keep the grip point outside the palm and bias the shaft
                    // toward camera/stage-front. This prevents the whole stick sitting
                    // inside the hand mesh on the shipped avatar rigs.
                    stick.position.set(side === 'L' ? .026 : -.026, -.008, .052);
                    stick.rotation.set(-.1, 0, side === 'L' ? -.065 : .065);
                    stick.visible = true;
                    stick.traverse(object => { object.frustumCulled = false; });
                    stick.userData.attachedToHand = true;
                });
            }
            if (this.equipment) {
                this.equipmentStageAnchor = new T.Vector3(...position);
                this.equipment.position.copy(this.equipmentStageAnchor);
                // Stage hardware is authored in world scale. Do not stretch drum
                // kits, keyboards or stand microphones to match avatar body size.
                this.equipment.scale.set(1, 1, 1);
                this.equipment.updateMatrixWorld(true);
            }
        }
        this.root.updateMatrixWorld(true);
        this.update(0, 0.7, false);
    }
    point(x: number, y: number, z: number) { return this.root.localToWorld(new T.Vector3(x, y, z)); }
    hasVocals() { return !!this.vocalRole || this.role === 'vocals' || this.instrumentRig?.family === 'voice'; }
    equipmentAnchor() { return this.equipmentStageAnchor?.clone() ?? null; }
    restoreEquipmentAnchor() {
        if (!this.equipment || !this.equipmentStageAnchor) return;
        this.equipment.position.copy(this.equipmentStageAnchor);
        this.equipment.rotation.set(0, 0, 0);
        this.equipment.scale.set(1, 1, 1);
        this.equipment.updateMatrixWorld(true);
    }
    private hand(side: 'L' | 'R', target: T.Vector3, pole: T.Vector3) {
        reach(this.bones.get(`UpperArm.${side}`), this.bones.get(`LowerArm.${side}`), this.bones.get(`Hand.${side}`), target, pole);
    }
    update(seconds: number, energy: number, reduced: boolean) {
        const t = reduced ? 0 : seconds, beat = t * Math.PI * 4;
        const performing = this.performing && !this.walking;
        const motionEnergy = reduced ? 0 : energy;
        const performanceScale = this.role === 'fan' ? 1 : this.role === 'drums' ? .7 : this.role === 'vocals' ? 1.5 : this.role === 'guitar' || this.role === 'bass' ? 1.2 : 1.1;
        const swayRate = this.role === 'vocals' ? 1.05 : this.role === 'drums' ? .92 : 1.35;
        const sway = (Math.sin(t * swayRate + this.phase) * .019 + Math.sin(t * .41 + this.phase * 1.7) * .009) * energy * performanceScale;
        this.rest.forEach(({ bone, quaternion, position }) => { bone.quaternion.copy(quaternion); bone.position.copy(position); });
        const vocalActive = this.hasVocals() && performing;
        const vocals = vocalPhrase(t, this.phase);
        const phrase = Math.sin(t * .54 + this.phase);
        const vocalAccent = vocalActive ? Math.max(0, Math.sin(t * 1.08 + this.phase)) : 0;
        const emphasis = performing && !reduced ? Math.pow(Math.max(0, Math.sin(t * .71 + this.phase)), 3) * energy : 0;
        const torso = this.bones.get('Torso');
        if (torso)
            torso.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(
                (Math.sin(beat / 2 + this.phase) * .022 + Math.sin(t * .63 + this.phase) * .012) * energy * performanceScale
                  + (this.vocalRole && this.instrumentRig?.family !== 'voice' ? -0.032 - vocalAccent * .016 : 0)
                  + (this.role === 'guitar' || this.role === 'bass' ? emphasis * .045 : 0),
                sway + (vocalActive ? phrase * .018 * energy : 0),
                (Math.sin(t * 1.35 + this.phase) * .012 + Math.sin(t * .48 + this.phase * .5) * .008) * energy * performanceScale,
            )));
        if (torso && performing && !reduced) {
            const section = this.performanceSection;
            const sectionProgress = T.MathUtils.clamp(this.sectionProgress, 0, 1);
            if (section === 'chorus') {
                torso.rotation.x -= .025 * motionEnergy;
                torso.rotation.y += Math.sin(t * .9 + this.phase) * .025 * motionEnergy;
            } else if (section === 'breakdown') {
                torso.rotation.x += (this.role === 'drums' ? .035 : .07) * motionEnergy;
                torso.rotation.z += Math.sin(t * .55 + this.phase) * .018 * motionEnergy;
            } else if (section === 'outro') {
                const finish = smoothMotion((sectionProgress - .72) / .28);
                torso.rotation.x -= finish * (this.role === 'vocals' ? .09 : .055) * motionEnergy;
                torso.rotation.z += Math.sin(this.phase + 1.1) * finish * .035 * motionEnergy;
            } else if (section === 'release') {
                const settle = 1 - smoothMotion(sectionProgress);
                if (this.role === 'vocals') {
                    torso.rotation.x -= .045 * settle;
                    torso.rotation.y += Math.sin(this.phase + .6) * .035 * settle;
                } else if (this.role === 'guitar' || this.role === 'bass') {
                    torso.rotation.x -= (this.role === 'bass' ? .025 : .035) * settle;
                    torso.rotation.z += Math.sin(this.phase + 1.1) * .02 * settle;
                } else if (this.role === 'drums') {
                    torso.rotation.x += .025 * settle;
                }
            }
            const flourishClock = ((t + this.phase * 1.7) % 13 + 13) % 13;
            const flourish = smoothMotion((flourishClock - 9.7) / .35) * (1 - smoothMotion((flourishClock - 11.15) / .45));
            if (this.interactionTarget && this.interactionStrength > 0) {
                const localTarget = this.root.worldToLocal(this.interactionTarget.clone());
                const interactionTurn = T.MathUtils.clamp(Math.atan2(localTarget.x, Math.max(.001, localTarget.z)), -.36, .36);
                torso.rotation.y += interactionTurn * this.interactionStrength * .42;
            }
            if (this.role === 'guitar' || this.role === 'bass') {
                torso.rotation.x += flourish * (this.role === 'bass' ? -.035 : -.055) * motionEnergy;
                torso.rotation.y += flourish * (this.role === 'bass' ? .035 : .055) * Math.sin(this.phase + 1.2);
            } else if (this.role === 'vocals') {
                torso.rotation.x -= flourish * .045 * motionEnergy;
                torso.rotation.y += flourish * .07 * Math.sin(this.phase * 1.3 + .4);
            } else if (this.role === 'drums') {
                torso.rotation.z += flourish * .028 * Math.sin(this.phase + .7);
            }
        }
        const head = this.bones.get('Head');
        if (head) {
            const singingLean = this.vocalRole && this.instrumentRig?.family !== 'voice' ? -0.075 : vocalActive ? -0.025 : 0;
            const phraseSlot = Math.floor((t + this.phase * .83) / 5.5);
            const phraseTime = ((t + this.phase * .83) % 5.5 + 5.5) % 5.5;
            const glanceWindow = !reduced && performing
                ? smoothMotion((phraseTime - 3.55) / .35) * (1 - smoothMotion((phraseTime - 4.75) / .35))
                : 0;
            const glanceSide = phraseSlot % 3 === 0 ? 1 : phraseSlot % 3 === 1 ? -1 : 0;
            const fretLook = (this.role === 'guitar' || this.role === 'bass') && phraseSlot % 4 === 2
                ? smoothMotion((phraseTime - 1.1) / .28) * (1 - smoothMotion((phraseTime - 2.35) / .3))
                : 0;
            const drummerNod = this.role === 'drums' && !reduced && performing
                ? Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 + this.phase)), 2) * .055 * motionEnergy
                : 0;
            const sectionLook = this.performanceSection === 'chorus' ? -.035 * motionEnergy
                : this.performanceSection === 'breakdown' ? .055 * motionEnergy
                : this.performanceSection === 'outro' ? -.06 * smoothMotion((this.sectionProgress - .7) / .3) * motionEnergy
                : this.performanceSection === 'release' ? -.035 * (1 - smoothMotion(this.sectionProgress))
                : 0;
            let interactionYaw = 0;
            let interactionPitch = 0;
            if (this.interactionTarget && this.interactionStrength > 0 && performing && !reduced) {
                const localTarget = this.root.worldToLocal(this.interactionTarget.clone());
                interactionYaw = T.MathUtils.clamp(Math.atan2(localTarget.x, Math.max(.001, localTarget.z)), -.48, .48) * this.interactionStrength;
                const horizontal = Math.max(.001, Math.hypot(localTarget.x, localTarget.z));
                interactionPitch = T.MathUtils.clamp(-Math.atan2(localTarget.y - 1.42, horizontal), -.14, .14) * this.interactionStrength;
            }
            head.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(
                Math.sin(beat + this.phase) * 0.035 * energy + singingLean - vocalAccent * .025 + emphasis * (vocalActive ? -.035 : .07) + fretLook * .12 + drummerNod + sectionLook + interactionPitch,
                Math.sin(t * 0.58 + this.phase) * (vocalActive ? .075 : .11) + glanceSide * glanceWindow * .18 + interactionYaw,
                (vocalActive ? Math.sin(t * .42 + this.phase) * .018 : 0) + glanceSide * glanceWindow * .025,
            )));
        }
        if (this.role === 'drums' && performing && !reduced) {
            const shoulderPulse = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4 + this.phase)), 1.4) * motionEnergy;
            const leftShoulder = this.bones.get('Shoulder.L') ?? this.bones.get('Clavicle.L');
            const rightShoulder = this.bones.get('Shoulder.R') ?? this.bones.get('Clavicle.R');
            leftShoulder?.rotateZ(.018 + shoulderPulse * .03);
            rightShoulder?.rotateZ(-.018 - shoulderPulse * .03);
        }
        const jaw = this.bones.get('Jaw') ?? this.bones.get('jaw') ?? this.bones.get('Mouth');
        if (jaw && vocalActive && !reduced) {
            jaw.rotation.x += vocals.opening * .13 * energy;
        }
        if (this.mouth) {
            const restScale = this.mouth.userData.restScale as T.Vector3;
            this.mouth.visible = vocalActive && !reduced && vocals.opening > .04;
            this.mouth.scale.copy(restScale);
            this.mouth.scale.y *= .35 + vocals.opening * 2.4;
            this.mouth.scale.x *= 1 - vocals.opening * .22;
        }
        const hips = this.bones.get('Hips');
        if (hips && this.role !== 'fan' && this.role !== 'drums' && !this.walking && !reduced) {
            const roleTwist = this.role === 'vocals' ? .055 : this.role === 'guitar' || this.role === 'bass' ? .035 : .018;
            hips.rotation.y += Math.sin(t * (this.role === 'vocals' ? .82 : 1.12) + this.phase) * roleTwist * energy;

            if (this.role === 'guitar' || this.role === 'bass') {
                const bass = this.role === 'bass';
                const weight = Math.sin(t * (bass ? .46 : .62) + this.phase);
                const settle = Math.sin(t * (bass ? .91 : 1.18) + this.phase * .7);
                hips.rotation.z += weight * (bass ? .024 : .034) * energy;
                hips.rotation.x += (Math.max(0, settle) * (bass ? .015 : .024) - .008) * energy;

                // Keep both shoes planted while the body shifts its weight between them.
                for (const side of ['L', 'R'] as const) {
                    const sign = side === 'L' ? 1 : -1;
                    const stance = bass ? .19 : .22;
                    const forward = sign * weight * (bass ? .018 : .028) + settle * .014;
                    reach(
                        this.bones.get(`UpperLeg.${side}`),
                        this.bones.get(`LowerLeg.${side}`),
                        this.bones.get(`Foot.${side}`),
                        this.point(sign * stance, .045, .035 + forward),
                        this.point(sign * (stance + .07), .48, .36),
                    );
                }
            }
        }
        this.root.updateMatrixWorld(true);
        const rig = this.instrumentRig;
        rig?.tools.forEach(tool => { tool.visible = this.root.visible && !this.walking; });
        if (rig && (!this.walking || !rig.stationary)) {
            const releaseHold = this.performanceSection === 'release' ? 1 - smoothMotion(this.sectionProgress) : 0;
            rig.animate(t + (reduced ? 0 : this.phase * .13), performing ? energy * (1 - releaseHold * .72) : 0, reduced || !performing);
            if (rig.family === 'strum' && releaseHold > .02) {
                // Hold the final fretted note/chord while the picking hand relaxes
                // instead of continuing to strum through the applause gap.
                rig.right.position.x *= 1 - releaseHold;
                rig.right.position.y *= 1 - releaseHold;
                rig.right.position.z = T.MathUtils.lerp(rig.right.position.z, .225, releaseHold);
            }
            if (rig.family === 'kit' && !reduced && performing) {
                const transitionSection = this.performanceSection === 'chorus' || this.performanceSection === 'outro';
                const transitionCrash = transitionSection
                    ? 1 - smoothMotion((this.sectionProgress - .02) / .12)
                    : 0;
                const releaseCrash = this.performanceSection === 'release'
                    ? 1 - smoothMotion(this.sectionProgress / .34)
                    : 0;
                const crash = Math.max(transitionCrash, releaseCrash);
                if (crash > .02) {
                    const sticks = rig.tools.filter(tool => tool.name.startsWith('playing-stick'));
                    const targets = [new T.Vector3(.7, 1.46, 1), new T.Vector3(-.75, 1.3, .65)];
                    [rig.left, rig.right].forEach((grip, index) => {
                        const target = targets[index];
                        grip.position.set(target.x * .72, target.y + .16 * crash, target.z - .37);
                        const stick = sticks[index];
                        if (stick) stick.userData.strikeTarget = target;
                    });
                }
            }
            if (rig.family === 'voice' && this.mouth) {
                const target = this.mouth.getWorldPosition(new T.Vector3());
                const offset = new T.Vector3(-.015, -.025 - (vocalActive ? vocals.breath * .08 * motionEnergy : .25), .14);
                offset.applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion()));
                rig.right.position.copy(rig.root.worldToLocal(target.add(offset)));
                rig.root.updateWorldMatrix(true, true);
            }
            if (rig.seated && !this.walking) {
                const hips = this.bones.get('Hips');
                if (hips) {
                    const point = hips.getWorldPosition(new T.Vector3());
                    point.y -= rig.root.userData.instrumentId === 'cajon' ? .43 : .33;
                    hips.position.copy(hips.parent!.worldToLocal(point));
                    hips.updateWorldMatrix(false, true);
                }
                for (const side of ['L', 'R'] as const) {
                    const sign = side === 'L' ? 1 : -1;
                    const kit = rig.family === 'kit';
                    const pedal = kit && !reduced && performing
                        ? Math.pow(Math.max(0, Math.sin(t * Math.PI * (side === 'R' ? 4 : 2) + (side === 'L' ? 1.1 : 0))), 2) * .055 * motionEnergy
                        : 0;
                    const footX = sign * (kit ? .24 : .22);
                    const footZ = kit ? (side === 'R' ? .42 : .34) : .34;
                    reach(
                        this.bones.get(`UpperLeg.${side}`),
                        this.bones.get(`LowerLeg.${side}`),
                        this.bones.get(`Foot.${side}`),
                        this.point(footX, .07 + pedal, footZ),
                        this.point(sign * .29, .55, kit ? .76 : .8),
                    );
                }
            }
            const poleSpread = .65 + Math.max(0, this.bodyBuild - 1) * .32;
            const poleDrift = reduced ? 0 : Math.sin(t * .72 + this.phase) * .035 * motionEnergy;
            const poleLift = reduced ? 0 : Math.sin(t * .51 + this.phase * 1.4) * .025 * motionEnergy;
            const poleForward = (rig.family === 'strum' ? .31 : rig.family === 'bow' || rig.family === 'upright' ? .22 : .15) + poleDrift;
            const leftTarget = rig.left.getWorldPosition(new T.Vector3());
            const rightTarget = rig.right.getWorldPosition(new T.Vector3());
            const leftPole = this.point(poleSpread, .96 + poleLift, poleForward);
            const rightPole = this.point(-poleSpread, .96 - poleLift * .6, poleForward - poleDrift * .45);
            if (rig.family === 'strum') {
                // Keep both wrists and elbows on the audience side of the instrument.
                // A second guarded IK solve catches poses where arm reach would otherwise
                // pull a hand back through a deep acoustic body or fretboard.
                const instrumentSurface = rig.left.parent ?? rig.root;
                const instrumentId = String(rig.root.userData.instrumentId ?? '');
                const acoustic = instrumentId !== 'electric_guitar' && instrumentId !== 'bass_guitar';
                const buildExtra = Math.max(0, this.bodyBuild - 1) * .02;
                const faceNormal = new T.Vector3(0, 0, 1)
                    .applyQuaternion(instrumentSurface.getWorldQuaternion(new T.Quaternion()))
                    .normalize();
                leftTarget.addScaledVector(faceNormal, .045 + buildExtra);
                rightTarget.addScaledVector(faceNormal, (acoustic ? .08 : .065) + buildExtra);

                const solveOutside = (side: 'L' | 'R', target: T.Vector3, pole: T.Vector3, minimumZ: number) => {
                    this.hand(side, target, pole);
                    const hand = this.bones.get(`Hand.${side}`);
                    if (!hand) return;
                    const localHand = instrumentSurface.worldToLocal(hand.getWorldPosition(new T.Vector3()));
                    if (localHand.z >= minimumZ) return;
                    localHand.z = minimumZ;
                    this.hand(side, instrumentSurface.localToWorld(localHand), pole);
                };
                solveOutside('L', leftTarget, leftPole, acoustic ? .18 : .16);
                solveOutside('R', rightTarget, rightPole, acoustic ? .27 : instrumentId === 'bass_guitar' ? .23 : .24);
            } else {
                this.hand('L', leftTarget, leftPole);
                this.hand('R', rightTarget, rightPole);
            }
            if (rig.family === 'voice' && !reduced && performing) {
                if (this.performanceSection === 'chorus') {
                    const sign = Math.sin(t * .7 + this.phase) >= 0 ? 1 : -1;
                    this.hand('L', this.point(.38 * sign, 1.62, .34), this.point(.66 * sign, 1.36, .24));
                } else if (this.performanceSection === 'outro' && this.sectionProgress > .74) {
                    const finish = smoothMotion((this.sectionProgress - .74) / .26);
                    this.hand('L', this.point(.34, 1.36 + finish * .52, .22), this.point(.68, 1.38, .18));
                } else if (this.performanceSection === 'release') {
                    const acknowledge = 1 - smoothMotion((this.sectionProgress - .58) / .42);
                    const height = 1.48 + acknowledge * .24;
                    this.hand('L', this.point(.34, height, .25), this.point(.67, 1.4, .18));
                } else {
                    this.hand('L', this.point(...singerGesture(t, this.phase)), this.point(.68, 1.18, .12));
                }
            }
        }
        else {
            for (const side of ['L', 'R'] as const) {
                const sign = side === 'L' ? 1 : -1;
                let target: [
                    number,
                    number,
                    number
                ] = [sign * .28, .84, .1];
                if (this.role === 'fan') {
                    if (this.fanPose === 'raised')
                        target = [sign * .25, 1.98, .15];
                    if (this.fanPose === 'clapOpen')
                        target = [sign * .26, 1.35, .4];
                    if (this.fanPose === 'clapClosed')
                        target = [sign * .035, 1.35, .44];
                    if (this.fanPose === 'danceLeft' || this.fanPose === 'danceRight') {
                        const d = this.fanPose === 'danceLeft' ? 1 : -1;
                        target = [sign * .27 + d * .12, 1.04 + sign * d * .13, .25];
                    }
                    if (this.fanPose === 'runLeft' || this.fanPose === 'runRight') {
                        const stride = this.fanPose === 'runLeft' ? 1 : -1;
                        target = [sign * .27, 1.14, .18 + sign * stride * .22];
                        reach(this.bones.get(`UpperLeg.${side}`), this.bones.get(`LowerLeg.${side}`), this.bones.get(`Foot.${side}`),
                            this.point(sign * .12, .06 + (sign * stride > 0 ? .14 : 0), sign * stride * .25), this.point(sign * .17, .52, .5));
                    }
                }
                this.hand(side, this.point(...target), this.point(sign * .55, this.fanPose === 'raised' ? 1.58 : 1.1, .1));
            }
        }
        if (this.walking && !reduced) {
            const hips = this.bones.get('Hips');
            if (hips) {
                const p = hips.getWorldPosition(new T.Vector3());
                p.y += Math.abs(Math.sin(t * 7)) * .025;
                hips.position.copy(hips.parent!.worldToLocal(p));
                hips.updateWorldMatrix(false, true);
            }
            for (const side of ['L', 'R'] as const) {
                const sign = side === 'L' ? 1 : -1;
                const stride = Math.sin(t * 6.2 + (sign > 0 ? 0 : Math.PI));
                const lift = Math.max(0, Math.sin(t * 6.2 + (sign > 0 ? 0 : Math.PI))) * .075;
                reach(
                    this.bones.get(`UpperLeg.${side}`),
                    this.bones.get(`LowerLeg.${side}`),
                    this.bones.get(`Foot.${side}`),
                    this.point(sign * .12, .045 + lift, stride * .22),
                    this.point(sign * .17, .52, .48),
                );
            }
        }
        if (this.walking && !reduced && (!this.instrumentRig || this.instrumentRig.family === 'voice')) {
            const armSwing = Math.sin(t * 6.2) * .14;
            this.hand('L', this.point(.28, .94, .12 + armSwing), this.point(.58, 1.12, .18));
            this.hand('R', this.point(-.28, .94, .12 - armSwing), this.point(-.58, 1.12, .18));
        }
        if (this.action && !reduced && (!rig || rig.family === 'voice') && /wave|singalong|crowd_interaction|storytelling|mic_trick/.test(this.action))
            this.hand('L', this.point(.3, 1.85, .2), this.point(.65, 1.4, .2));
        // Shape the hands by playing role rather than applying the same fist pose
        // to every performer. Small local rotations keep compatibility with the
        // imported rigs while making fret, pick and stick grips read differently.
        const strum = rig?.family === 'strum';
        const kit = rig?.family === 'kit';
        const bass = this.role === 'bass';
        const fretPulse = reduced ? 0 : Math.max(0, Math.sin(t * (bass ? 4.2 : 6.8) + this.phase)) * motionEnergy;
        for (const [name, bone] of this.bones) {
            const finger = /^(Index|Middle|Ring|Pinky)([1234])\.([LR])$/.exec(name);
            if (finger) {
                const [, digit, joint, side] = finger;
                let curl = this.role === 'fan' ? .2 : rig?.family === 'keys' ? .22 : .5;
                if (strum) {
                    if (side === 'L') {
                        // Fretting hand: index/middle do more work, ring/pinky relax
                        // between chord changes instead of forming one solid fist.
                        const weight = digit === 'Index' ? .92 : digit === 'Middle' ? .82 : digit === 'Ring' ? .68 : .58;
                        curl = (.42 + weight * .28 + fretPulse * .08) * (Number(joint) >= 3 ? 1 : .72);
                    } else {
                        // Picking hand stays much more open; bass fingers curl farther
                        // for alternating finger plucks than a guitar pick grip.
                        const pickWeight = bass
                            ? (digit === 'Index' || digit === 'Middle' ? .64 : .32)
                            : (digit === 'Index' ? .38 : digit === 'Middle' ? .32 : .2);
                        curl = pickWeight + fretPulse * (bass ? .07 : .035);
                    }
                } else if (kit) {
                    // Stick grip: first two fingers secure the fulcrum while the
                    // remaining fingers wrap more loosely around the shaft.
                    curl = digit === 'Index' ? .62 : digit === 'Middle' ? .68 : digit === 'Ring' ? .56 : .48;
                } else if (rig?.family === 'keys') {
                    curl = .18 + Math.max(0, Math.sin(t * 11 + name.charCodeAt(0))) * .2 * motionEnergy;
                } else if (rig?.family === 'voice') {
                    curl = side === 'R' ? .64 : .34;
                }
                bone.rotateX(curl);
            }

            const thumb = /^Thumb([1234])\.([LR])$/.exec(name);
            if (thumb) {
                const [, joint, side] = thumb;
                let thumbCurl = .18;
                if (strum)
                    thumbCurl = side === 'L' ? .36 : bass ? .3 : .42;
                else if (kit)
                    thumbCurl = .48;
                else if (rig?.family === 'voice' && side === 'R')
                    thumbCurl = .5;
                bone.rotateX(thumbCurl * (Number(joint) >= 2 ? 1 : .65));
            }
        }

        if (strum && !this.walking) {
            const leftHand = this.bones.get('Hand.L');
            const rightHand = this.bones.get('Hand.R');
            if (leftHand) {
                leftHand.rotateZ((bass ? -.08 : -.11) + Math.sin(t * .7 + this.phase) * .018 * motionEnergy);
                leftHand.rotateY(.035);
            }
            if (rightHand) {
                const stroke = Math.sin(t * Math.PI * (bass ? 4 : 8) + this.phase);
                rightHand.rotateZ((bass ? .055 : .075) + stroke * (bass ? .025 : .045) * motionEnergy);
                rightHand.rotateX(bass ? -.035 : -.018);
            }
        } else if (kit && !this.walking) {
            for (const side of ['L', 'R'] as const) {
                const hand = this.bones.get(`Hand.${side}`);
                if (!hand) continue;
                const sign = side === 'L' ? 1 : -1;
                const rebound = Math.max(0, Math.sin(t * Math.PI * 4 + (side === 'L' ? 0 : Math.PI)));
                hand.rotateZ(sign * (.06 + rebound * .035 * motionEnergy));
                hand.rotateX(-.025 + rebound * .025 * motionEnergy);
            }
        }
        this.root.updateMatrixWorld(true);
        // Imported wrist axes differ between avatars. Keep the grille pointing
        // towards the face instead of inheriting an arbitrary wrist orientation.
        const mic = rig?.family === 'voice' ? this.bones.get('Hand.R')?.getObjectByName('playing-handheld-microphone') : null;
        if (mic?.parent) {
            mic.position.set(0, 0, 0);
            mic.quaternion.copy(mic.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(this.root.getWorldQuaternion(new T.Quaternion())));
            mic.updateWorldMatrix(false, true);
        }
        if (rig?.family === 'kit' && !this.walking) {
            for (const stick of rig.tools.filter(tool => tool.name.startsWith('playing-stick'))) {
                stick.visible = true;
                const target = stick.userData.strikeTarget as T.Vector3 | undefined;
                if (!target || !stick.parent) continue;
                const shaftAxis = (stick.userData.shaftAxis as T.Vector3 | undefined)
                    ?? new T.Vector3(0, -.238, .36).normalize();
                aimAttachedTool(stick, shaftAxis, rig.root.localToWorld(target.clone()));
            }
        }
    }
}
/** Bake a posed rig once; the audience then uses inexpensive GPU instances. */
function crowdGeometry(actor: Musician) {
    const geometries: T.BufferGeometry[] = [];
    actor.root.updateMatrixWorld(true);
    actor.model.traverse(object => {
        if (!(object instanceof T.Mesh))
            return;
        if (object instanceof T.SkinnedMesh)
            object.skeleton.update();
        const src = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        const positions = src.attributes.position, output = new Float32Array(positions.count * 3), colors = new Float32Array(positions.count * 3);
        const materials = (Array.isArray(object.material) ? object.material : [object.material]) as T.MeshStandardMaterial[];
        const point = new T.Vector3(), colour = new T.Color();
        for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i);
            if (object instanceof T.SkinnedMesh)
                object.applyBoneTransform(object.geometry.index ? object.geometry.index.getX(i) : i, point);
            point.applyMatrix4(object.matrixWorld);
            output.set(point.toArray(), i * 3);
            const group = src.groups.find(g => i >= g.start && i < g.start + g.count), material = materials[group?.materialIndex ?? 0] ?? materials[0];
            colour.copy(material.color);
            const map = material.map, uv = src.attributes.uv;
            if (map instanceof T.DataTexture && uv && map.image.data instanceof Uint8Array) {
                const x = Math.floor(T.MathUtils.euclideanModulo(uv.getX(i), 1) * map.image.width), y = Math.floor(T.MathUtils.euclideanModulo(uv.getY(i), 1) * map.image.height), index = (y * map.image.width + x) * 4, data = map.image.data;
                const texel = new T.Color().setRGB(data[index] / 255, data[index + 1] / 255, data[index + 2] / 255, map.colorSpace === T.SRGBColorSpace ? T.SRGBColorSpace : T.LinearSRGBColorSpace);
                colour.multiply(texel);
            }
            colors.set(colour.toArray(), i * 3);
        }
        const result = new T.BufferGeometry();
        result.setAttribute('position', new T.BufferAttribute(output, 3));
        result.setAttribute('color', new T.BufferAttribute(colors, 3));
        result.computeVertexNormals();
        geometries.push(result);
        src.dispose();
    });
    const merged = mergeGeometries(geometries, false)!;
    geometries.forEach(g => g.dispose());
    return merged;
}
const randomnessForFan = (fan: { phase: number; rank: number }) => (Math.sin(fan.phase * 19.19 + fan.rank * 1.73) * .5 + .5);
interface Fan {
    x: number;
    z: number;
    scale: number;
    phase: number;
    yaw: number;
    personality: number;
    pace: number;
    rank: number;
}
export class DemoCrowd {
    private batches: {
        mesh: T.InstancedMesh;
        motion: T.InstancedBufferAttribute;
        fans: Fan[];
        phone: T.Vector3;
    }[] = [];
    private transform = new T.Object3D();
    private allFans: Fan[] = [];
    private phones: T.InstancedMesh;
    private time = { value: 0 };
    private televisionStage: 'main_stage' | 'stage_b' | 'rock_stage' | 'studio_floor' = 'main_stage';
    setTelevisionStage(stage: 'main_stage' | 'stage_b' | 'rock_stage' | 'studio_floor') { this.televisionStage = stage; }
    constructor(sources: T.Object3D[], scene: T.Scene, seed = 85043, private venue?: VenueProfile, library?: ModelLibrary) {
        const random = seededRandom(seed), material = crowdMaterial(this.time), appearances = crowdAppearances(seed);
        this.transform.rotation.order = 'YXZ';
        this.phones = new T.InstancedMesh(new T.BoxGeometry(.075, .13, .012), new T.MeshBasicMaterial({ color: '#b5e6ff', toneMapped: false }), CROWD_LIMIT);
        this.phones.name = 'crowd-phone-screens';
        this.phones.count = 0;
        this.phones.frustumCulled = false;
        scene.add(this.phones);
        const places = Array.from({ length: CROWD_LIMIT }, (_, i) => i);
        for (let i = places.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [places[i], places[j]] = [places[j], places[i]];
        }
        for (let kind = 0; kind < CROWD_VARIANTS; kind++) {
            const appearance = appearances[kind], assembled = library ? assemblePlayerModel(library, appearance) : null;
            const actor = new Musician(assembled ?? sources[kind % sources.length], 'fan', [0, 0, 0], 0, undefined, assembled ? appearance : undefined);
            if (assembled)
                disposeModel(assembled);
            actor.update(0, 0, true);
            const geometry = crowdGeometry(actor);
            let phone = new T.Vector3();
            for (const [pose, attribute] of [['raised', 'poseRaised'], ['clapOpen', 'poseClapOpen'], ['clapClosed', 'poseClapClosed'], ['danceLeft', 'poseDanceLeft'], ['danceRight', 'poseDanceRight'], ['runLeft', 'poseRunLeft'], ['runRight', 'poseRunRight']] as const) {
                actor.fanPose = pose;
                actor.update(0, 0, true);
                const posed = crowdGeometry(actor);
                geometry.setAttribute(attribute, posed.attributes.position.clone());
                posed.dispose();
                if (pose === 'raised')
                    phone = actor.bones.get('Hand.L')!.getWorldPosition(new T.Vector3());
            }
            disposeModel(actor.root);
            const count = CROWD_LIMIT / CROWD_VARIANTS, motion = new T.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(T.DynamicDrawUsage);
            geometry.setAttribute('crowdMotion', motion);
            const mesh = new T.InstancedMesh(geometry, material, count);
            mesh.name = `crowd-variant-${kind}`;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
            mesh.userData.appearance = appearance;
            const fans: Fan[] = [];
            for (let i = 0; i < count; i++) {
                const rank = i * CROWD_VARIANTS + kind, spot = places[rank];
                fans.push({ rank, x: ((spot % 16) - 7.5) * .82 + (random() - .5) * .18, z: 2.15 + Math.floor(spot / 16) * 1.3 + random() * .35, scale: .92 + random() * .14, phase: random() * Math.PI * 2, yaw: Math.PI + (random() - .5) * .3, personality: random(), pace: .82 + random() * .4 });
            }
            scene.add(mesh);
            this.allFans.push(...fans);
            this.batches.push({ mesh, motion, fans, phone });
        }
        this.update(0, .8, .7, false);
    }
    update(seconds: number, density: number, energy: number, reduced: boolean, tuning: Partial<CrowdTuningOptions> = {}, reaction = 'bounce', cueProgress?: number) {
        const t = reduced ? 0 : seconds, target = Math.round(CROWD_LIMIT * T.MathUtils.clamp(density, 0, 1));
        this.time.value = t;
        let phoneCount = 0;
        const area = detailedCrowdArea(this.venue), width = area.width / 13, depth = area.depth / 13;
        const eventArea = { ...area, width: area.width * Math.min(1.1, tuning.lateralSpread ?? 1), depth: area.depth * Math.min(1.1, tuning.depthSpread ?? 1) * (1 - (tuning.stagePull ?? 0) * .3) };
        const event = crowdEventPlan(t, density, energy, reaction, reduced, eventArea, this.venue?.kind === 'tv_studio', cueProgress);
        const basePosition = (fan: Fan) => ({
            rank: fan.rank,
            x: T.MathUtils.clamp(fan.x * Math.min(1.1, tuning.lateralSpread ?? 1) + Math.sin(fan.phase) * (tuning.randomness ?? 0) * .2, -7.5, 7.5) * width,
            z: area.front + (fan.z - area.front) * eventArea.depth / 13,
        });
        const pitSlots = event.pit > 0 ? circlePitSlots(this.allFans.filter(fan => fan.rank < target).map(basePosition), event) : undefined;
        const surfer = this.allFans.find(fan => fan.rank === event.surferRank);
        const surfBaseX = surfer ? T.MathUtils.clamp(surfer.x * Math.min(1.1, tuning.lateralSpread ?? 1) + Math.sin(surfer.phase) * (tuning.randomness ?? 0) * .2, -7.5, 7.5) * width : 0;
        const surfBaseZ = surfer ? 2.15 + (surfer.z - 2.15) * eventArea.depth / 13 : 0;
        const surfX = surfBaseX + (eventArea.width * .25 - surfBaseX) * event.surf;
        const surfZ = surfBaseZ + (area.front + 1.2 + (1 - event.surfProgress) * eventArea.depth * .42 - surfBaseZ) * event.surf;
        const pivot = new T.Vector3();
        for (const { mesh, motion, fans, phone } of this.batches) {
            mesh.count = 0;
            for (const fan of fans) {
                if (fan.rank >= target)
                    continue;
                let mode: number = crowdMotion(reaction, energy, fan.personality, t);
                const phase = t * fan.pace + fan.phase, active = !reduced && mode !== 0;
                const bounce = active ? Math.max(0, Math.sin(phase * (mode === 6 ? 5.4 : 6.28))) * energy * (mode === 6 ? .15 : mode === 2 ? .035 : .012) : 0;
                if (this.venue?.kind === 'tv_studio') {
                    const stage = resolveTotpStudioStageGeometry(this.televisionStage, this.venue);
                    const row = Math.floor(fan.rank / 24) % 5;
                    const slot = fan.rank % 24;
                    const lane = fan.rank % 5;
                    if (lane < 3) {
                        const columns = 15;
                        const column = slot % columns;
                        const spread = Math.min(stage.deckWidth + 2.2, this.venue.crowdWidth * .72);
                        this.transform.position.set(
                            stage.centerX + (column / (columns - 1) - .5) * spread,
                            bounce,
                            stage.centerZ + stage.deckDepth / 2 + .72 + row * .58,
                        );
                    } else {
                        const side = lane === 3 ? -1 : 1;
                        const sideRow = Math.floor(slot / 6) % 4;
                        const sideSlot = slot % 6;
                        this.transform.position.set(
                            stage.centerX + side * (stage.deckWidth / 2 + .72 + sideRow * .5),
                            bounce,
                            stage.centerZ - stage.deckDepth * .22 + sideSlot * Math.min(.62, stage.deckDepth / 6),
                        );
                    }
                    this.transform.position.x += (randomnessForFan(fan) - .5) * .10;
                    this.transform.position.z += (Math.sin(fan.phase * 2.1) * .08);
                    this.transform.position.x = T.MathUtils.clamp(this.transform.position.x, -this.venue.crowdWidth / 2 + .45, this.venue.crowdWidth / 2 - .45);
                    if (isTvStudioAudienceBlocked(this.transform.position.x, this.transform.position.z, this.venue)) {
                        this.transform.position.z = stage.centerZ + stage.deckDepth / 2 + 1.0 + row * .62;
                    }
                } else {
                    this.transform.position.set(T.MathUtils.clamp(fan.x * Math.min(1.1, tuning.lateralSpread ?? 1) + Math.sin(fan.phase) * (tuning.randomness ?? 0) * .2, -7.5, 7.5) * width, bounce, 2.15 + (fan.z - 2.15) * depth * Math.min(1.1, tuning.depthSpread ?? 1) * (1 - (tuning.stagePull ?? 0) * .3));
                    if(area.runway && this.transform.position.z < 10) this.transform.position.x += this.transform.position.x < 0 ? -3.8 : 3.8;
                }
                this.transform.rotation.set(active && mode === 7 ? Math.max(0, Math.sin(phase * 4)) * .1 : 0, fan.yaw + (active ? Math.sin(phase * 1.4) * .04 : 0), active ? Math.sin(phase * 1.7) * (mode === 1 ? .055 : .016) * energy : 0);
                this.transform.scale.setScalar(fan.scale * Math.min(1.15, tuning.fanScale ?? 1));
                let amount = Math.max(.3, energy);
                const pit = circlePitPosition(this.transform.position.x, this.transform.position.z, fan.personality, event, pitSlots?.get(fan.rank));
                this.transform.position.x = pit.x;
                this.transform.position.z = pit.z;
                if (pit.running > 0) {
                    const turn = Math.atan2(Math.sin(pit.yaw - fan.yaw), Math.cos(pit.yaw - fan.yaw));
                    this.transform.rotation.y = fan.yaw + turn * pit.running;
                    this.transform.rotation.x = -.08 * pit.running;
                    this.transform.position.y = Math.abs(Math.sin(phase * 7.2)) * .055 * pit.running;
                    mode = 8;
                    amount = pit.running;
                }
                if (event.surf > 0 && fan.rank === event.surferRank) {
                    this.transform.position.set(surfX, .9 * this.transform.scale.y + event.surf * (1.23 + Math.sin(phase * 2) * .035), surfZ);
                    this.transform.rotation.set(-Math.PI / 2 * event.surf, fan.yaw, Math.sin(phase * 1.5) * .04 * event.surf);
                    // Tilt around the torso, not the feet, as nearby hands lift it.
                    pivot.set(0, .9 * this.transform.scale.y, 0).applyEuler(this.transform.rotation);
                    this.transform.position.sub(pivot);
                    mode = 9;
                    amount = event.surf;
                } else if (event.surf > .1 && Math.hypot(this.transform.position.x - surfX, this.transform.position.z - surfZ) < 1.5 && !pit.running) {
                    mode = 2;
                }
                this.transform.updateMatrix();
                mesh.setMatrixAt(mesh.count, this.transform.matrix);
                motion.setXYZW(mesh.count, mode, fan.phase, fan.pace, amount);
                mesh.count++;
                if (mode === 5) {
                    const screen = phone.clone().add(new T.Vector3(0, .045, .015)).applyMatrix4(this.transform.matrix);
                    this.transform.position.copy(screen);
                    this.transform.updateMatrix();
                    this.phones.setMatrixAt(phoneCount++, this.transform.matrix);
                }
            }
            mesh.instanceMatrix.needsUpdate = true;
            motion.needsUpdate = true;
        }
        this.phones.count = phoneCount;
        this.phones.instanceMatrix.needsUpdate = true;
    }
    // Geometry/material ownership remains with the scene disposer (including shader pose attributes).
    dispose() { this.batches = []; this.allFans = []; }
}
export async function loadBand(scene: T.Scene, manager: T.LoadingManager, lineup?: ConcertPerformer[], seed?: number, venue?: VenueProfile) {
    const library = await loadModelLibrary(['casual.glb', 'punk.glb', 'suit.glb', ...requiredModelFiles([...(lineup?.map(p => p.appearance) ?? []), ...crowdAppearances(seed ?? 85043)])], manager);
    const casual = library.get('casual.glb')!, punk = library.get('punk.glb')!, suit = library.get('suit.glb')!;
    const cymbals: T.Object3D[] = [];
    try {
        const actors = lineup ? lineup.map(p => {
            const assembled = assemblePlayerModel(library, p.appearance, visibleTattoosForClothing(p.tattoos ?? [], p.richClothing ?? []));
            const actor = new Musician(assembled, p.role, p.position, p.phase, undefined, p.appearance, p.instrument, p.vocal, p.richClothing);
            disposeModel(assembled);
            actor.id = p.id;
            actor.root.name = p.displayName;
            actor.root.visible = false;
            return actor;
        }) : [new Musician(punk, 'vocals', [0, .9, -.97], 0, '#5f354a'), new Musician(casual, 'guitar', [-2.65, .9, -1.35], 1.2, '#577386'), new Musician(suit, 'bass', [2.7, .9, -1.65], 2.6, '#254c47'), new Musician(casual, 'drums', [.8, 1.16, -3.58], .8, '#874a47')];
        actors.forEach(actor => { scene.add(actor.root); if (actor.equipment)
            scene.add(actor.equipment); });
        const crowd = new DemoCrowd([casual, library.get('female-casual.glb') ?? suit, punk], scene, seed, venue, library);
        return { actors, crowd, cymbals };
    }
    finally {
        library.forEach(disposeModel);
    }
}
