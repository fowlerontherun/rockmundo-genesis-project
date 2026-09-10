import { detailedCrowdArea } from './venueAudience';
import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { microphone } from './stage';
import { buildInstrument, type InstrumentRig } from './instruments';
import { stageAssignment, type InstrumentId, type VocalRole } from './instrumentCatalog';
import { crowdAppearances, crowdMaterial, crowdMotion, CROWD_LIMIT, CROWD_VARIANTS } from './crowdAnimation';
import { seededRandom } from './config';
import { assemblePlayerModel, disposeModel, loadModelLibrary, requiredModelFiles } from '@/features/player-model/model';
import type { ModelLibrary } from '@/features/player-model/model';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import { buildProceduralGarment, type GarmentRigAnchor } from '@/features/clothing-preview/proceduralGarmentRenderer';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { CrowdTuningOptions } from '@/features/gig-experience/viewer/engine/CrowdTuning';
import type { VenueProfile } from './venueProfile';
import type { ConcertPerformer, StageRole } from './liveTypes';
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
export class Musician {
    root = new T.Group();
    model: T.Object3D;
    bones = new Map<string, T.Bone>();
    private rest: RestBone[] = [];
    instrumentRig: InstrumentRig | null = null;
    equipment: T.Group | null = null;
    fanPose: 'idle' | 'raised' | 'clapOpen' | 'clapClosed' | 'danceLeft' | 'danceRight' = 'idle';
    id = '';
    walking = false;
    action: string | null = null;
    private scale: number;
    constructor(source: T.Object3D, public role: Role, position: [
        number,
        number,
        number
    ], public phase = 0, tint = '#728092', appearance?: PlayerAppearance, instrument?: InstrumentId | null, vocal?: VocalRole, richClothing: ResolvedEquippedClothing[] = []) {
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
        if (appearance)
            this.root.scale.set(appearance.body.build, appearance.body.height, appearance.body.build);
        const assignment = stageAssignment(instrument, role);
        if (assignment.instrument && role !== 'fan') {
            this.instrumentRig = buildInstrument(assignment.instrument, appearance?.equipment.instrument.color);
            if (this.instrumentRig.stationary) {
                this.equipment = new T.Group();
                this.equipment.add(this.instrumentRig.root);
            }
            else
                this.root.add(this.instrumentRig.root);
            if (vocal && assignment.instrument !== 'vocal_performance') {
                this.equipment ??= new T.Group();
                microphone(this.equipment, [.1, 0, .65]);
            }
            if (this.equipment) {
                this.equipment.position.set(...position);
                this.equipment.scale.copy(this.root.scale);
                this.equipment.updateMatrixWorld(true);
            }
        }
        this.root.updateMatrixWorld(true);
        this.update(0, 0.7, false);
    }
    point(x: number, y: number, z: number) { return this.root.localToWorld(new T.Vector3(x, y, z)); }
    private hand(side: 'L' | 'R', target: T.Vector3, pole: T.Vector3) {
        reach(this.bones.get(`UpperArm.${side}`), this.bones.get(`LowerArm.${side}`), this.bones.get(`Hand.${side}`), target, pole);
    }
    update(seconds: number, energy: number, reduced: boolean) {
        const t = reduced ? 0 : seconds, beat = t * Math.PI * 4, sway = Math.sin(t * 1.6 + this.phase) * 0.018 * energy;
        this.rest.forEach(({ bone, quaternion, position }) => { bone.quaternion.copy(quaternion); bone.position.copy(position); });
        const torso = this.bones.get('Torso');
        if (torso)
            torso.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.sin(beat / 2 + this.phase) * 0.02 * energy, sway, sway)));
        const head = this.bones.get('Head');
        if (head)
            head.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.sin(beat + this.phase) * 0.035 * energy, Math.sin(t * 0.65 + this.phase) * 0.09, 0)));
        this.root.updateMatrixWorld(true);
        const rig = this.instrumentRig;
        rig?.tools.forEach(tool => { tool.visible = this.root.visible && !this.walking; });
        if (rig && (!this.walking || !rig.stationary)) {
            rig.animate(t, energy, reduced);
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
                    reach(this.bones.get(`UpperLeg.${side}`), this.bones.get(`LowerLeg.${side}`), this.bones.get(`Foot.${side}`), this.point(sign * .22, .09, .34), this.point(sign * .27, .55, .8));
                }
            }
            this.hand('L', rig.left.getWorldPosition(new T.Vector3()), this.point(.65, .93, .15));
            this.hand('R', rig.right.getWorldPosition(new T.Vector3()), this.point(-.65, .93, .15));
            if (rig.family === 'voice' && !reduced)
                this.hand('L', this.point(.35, 1.0 + Math.sin(t * .8) * .16, .26), this.point(.65, 1.05, .1));
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
                const sign = side === 'L' ? 1 : -1, stride = Math.sin(t * 7 + (sign > 0 ? 0 : Math.PI));
                reach(this.bones.get(`UpperLeg.${side}`), this.bones.get(`LowerLeg.${side}`), this.bones.get(`Foot.${side}`), this.point(sign * .12, .06 + Math.max(0, stride) * .09, stride * .18), this.point(sign * .15, .5, .6));
            }
        }
        if (this.action && /wave|singalong|crowd_interaction|storytelling|mic_trick/.test(this.action))
            this.hand('L', this.point(.3, 1.85, .2), this.point(.65, 1.4, .2));
        // Gently curl fingers around instrument necks, sticks and the microphone.
        for (const [name, bone] of this.bones)
            if (/^(Index|Middle|Ring|Pinky)[34]\./.test(name))
                bone.rotateX(this.role === 'fan' ? 0.2 : 0.58);
        this.root.updateMatrixWorld(true);
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
    private phones: T.InstancedMesh;
    private time = { value: 0 };
    constructor(sources: T.Object3D[], scene: T.Scene, seed = 85043, private venue?: VenueProfile, library?: ModelLibrary) {
        const random = seededRandom(seed), material = crowdMaterial(this.time), appearances = crowdAppearances(seed);
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
            for (const [pose, attribute] of [['raised', 'poseRaised'], ['clapOpen', 'poseClapOpen'], ['clapClosed', 'poseClapClosed'], ['danceLeft', 'poseDanceLeft'], ['danceRight', 'poseDanceRight']] as const) {
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
            this.batches.push({ mesh, motion, fans, phone });
        }
        this.update(0, .8, .7, false);
    }
    update(seconds: number, density: number, energy: number, reduced: boolean, tuning: Partial<CrowdTuningOptions> = {}, reaction = 'bounce') {
        const t = reduced ? 0 : seconds, target = Math.round(CROWD_LIMIT * T.MathUtils.clamp(density, 0, 1));
        this.time.value = t;
        let phoneCount = 0;
        const area = detailedCrowdArea(this.venue), width = area.width / 13, depth = area.depth / 13;
        for (const { mesh, motion, fans, phone } of this.batches) {
            mesh.count = 0;
            for (const fan of fans) {
                if (fan.rank >= target)
                    continue;
                const mode = crowdMotion(reaction, energy, fan.personality, t), phase = t * fan.pace + fan.phase, active = !reduced && mode !== 0;
                const bounce = active ? Math.max(0, Math.sin(phase * (mode === 6 ? 5.4 : 6.28))) * energy * (mode === 6 ? .15 : mode === 2 ? .035 : .012) : 0;
                this.transform.position.set(T.MathUtils.clamp(fan.x * Math.min(1.1, tuning.lateralSpread ?? 1) + Math.sin(fan.phase) * (tuning.randomness ?? 0) * .2, -7.5, 7.5) * width, bounce, 2.15 + (fan.z - 2.15) * depth * Math.min(1.1, tuning.depthSpread ?? 1) * (1 - (tuning.stagePull ?? 0) * .3));
                if(area.runway && this.transform.position.z < 10) this.transform.position.x += this.transform.position.x < 0 ? -3.8 : 3.8;
                this.transform.rotation.set(active && mode === 7 ? Math.max(0, Math.sin(phase * 4)) * .1 : 0, fan.yaw + (active ? Math.sin(phase * 1.4) * .04 : 0), active ? Math.sin(phase * 1.7) * (mode === 1 ? .055 : .016) * energy : 0);
                this.transform.scale.setScalar(fan.scale * Math.min(1.15, tuning.fanScale ?? 1));
                this.transform.updateMatrix();
                mesh.setMatrixAt(mesh.count, this.transform.matrix);
                motion.setXYZW(mesh.count, mode, fan.phase, fan.pace, Math.max(.3, energy));
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
    dispose() { this.batches = []; }
}
export async function loadBand(scene: T.Scene, manager: T.LoadingManager, lineup?: ConcertPerformer[], seed?: number, venue?: VenueProfile) {
    const library = await loadModelLibrary(['casual.glb', 'punk.glb', 'suit.glb', ...requiredModelFiles([...(lineup?.map(p => p.appearance) ?? []), ...crowdAppearances(seed ?? 85043)])], manager);
    const casual = library.get('casual.glb')!, punk = library.get('punk.glb')!, suit = library.get('suit.glb')!;
    const cymbals: T.Object3D[] = [];
    try {
        const actors = lineup ? lineup.map(p => {
            const assembled = assemblePlayerModel(library, p.appearance);
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
