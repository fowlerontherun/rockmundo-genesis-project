import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGuitar, buildDrummerKit, buildKeyboard, buildHandInstrument, rod, matte } from './stage';
import { seededRandom } from './config';
import { assemblePlayerModel, disposeModel, loadModelLibrary, requiredModelFiles } from '@/features/player-model/model';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import type { CrowdTuningOptions } from '@/features/gig-experience/viewer/engine/CrowdTuning';
import type { ConcertPerformer, StageRole } from './liveTypes';

type Role = StageRole;
interface RestBone { bone: T.Bone; quaternion: T.Quaternion; position: T.Vector3 }
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
  if (!upper || !lower || !hand) return;
  const start = upper.getWorldPosition(new T.Vector3());
  const middle = lower.getWorldPosition(new T.Vector3()), end = hand.getWorldPosition(new T.Vector3());
  const a = start.distanceTo(middle), b = middle.distanceTo(end);
  const direction = target.clone().sub(start); const distance = T.MathUtils.clamp(direction.length(), Math.abs(a - b) + 0.001, a + b - 0.001); direction.normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const bend = pole.clone().sub(start); bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  if (bend.lengthSq() < 0.01) bend.crossVectors(direction, UP).normalize();
  const elbow = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  aim(upper, lower, elbow); aim(lower, hand, target);
}

export class Musician {
  root = new T.Group();
  model: T.Object3D;
  bones = new Map<string, T.Bone>();
  private rest: RestBone[] = [];
  private guitar: T.Group | null = null;
  private sticks: T.Object3D[] = [];
  private handheld: T.Object3D | null = null;
  id = '';
  walking = false;
  action: string | null = null;
  private scale: number;
  constructor(source: T.Object3D, public role: Role, position: [number, number, number], public phase = 0, tint = '#728092', appearance?: PlayerAppearance) {
    this.model = clone(source); this.root.add(this.model); this.root.position.set(...position);
    this.model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(this.model), height = bounds.max.y - bounds.min.y;
    this.scale = 1.78 / Math.max(0.01, height);
    this.model.scale.multiplyScalar(this.scale); this.model.position.y -= bounds.min.y * this.scale;
    this.model.traverse(object => {
      if (object instanceof T.Bone) { this.bones.set(object.name.replace(/([a-z0-9])([LR])$/, '$1.$2').replace(/_/g, '.').replace(/^Wrist\./, 'Hand.'), object); this.rest.push({ bone: object, quaternion: object.quaternion.clone(), position: object.position.clone() }); }
      if (object instanceof T.Mesh) {
        object.geometry = object.geometry.clone(); object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
        const configure = (sourceMat: T.Material) => {
          const mat = sourceMat.clone() as T.MeshStandardMaterial;
          if (mat.isMeshStandardMaterial) {
            const skin = /skin|eye|hair/i.test(mat.name); mat.metalness = /earring/i.test(mat.name) ? 0.6 : 0; mat.roughness = skin ? 0.69 : 0.82;
            if (!appearance && /lightblue|blue|green|red_dark/i.test(mat.name)) mat.color.set(tint);
            if (!appearance && /black/i.test(mat.name)) { mat.color.set('#222630'); mat.roughness = 0.55; }
          }
          return mat;
        };
        object.material = Array.isArray(object.material) ? object.material.map(configure) : configure(object.material);
      }
    });
    if (role === 'guitar' || role === 'bass') { this.guitar = buildGuitar(role === 'bass'); this.root.add(this.guitar); if (appearance) { const body = this.guitar.getObjectByName('instrument-body') as T.Mesh | undefined; if (body) (body.material as T.MeshStandardMaterial).color.set(appearance.equipment.instrument.color); } }
    if (role === 'drums') for (let i = 0; i < 2; i++) this.sticks.push(rod(this.root, [0, 0, 0], [0, 0, 0.42], 0.007, matte('#d2ad71', 0.55)));
    if (role === 'strings' || role === 'brass' || role === 'percussion') { this.handheld = buildHandInstrument(role, appearance?.equipment.instrument.color); this.root.add(this.handheld); }
    if (role === 'vocals' && appearance) { this.handheld = buildHandInstrument('vocals'); this.root.add(this.handheld); }
    if (appearance) this.root.scale.set(appearance.body.build, appearance.body.height, appearance.body.build);
    this.root.updateMatrixWorld(true); this.update(0, 0.7, false);
  }
  point(x: number, y: number, z: number) { return this.root.localToWorld(new T.Vector3(x, y, z)); }
  private hand(side: 'L' | 'R', target: T.Vector3, pole: T.Vector3) {
    reach(this.bones.get(`UpperArm.${side}`), this.bones.get(`LowerArm.${side}`), this.bones.get(`Hand.${side}`), target, pole);
  }
  update(seconds: number, energy: number, reduced: boolean) {
    const t = reduced ? 0 : seconds, beat = t * Math.PI * 4, sway = Math.sin(t * 1.6 + this.phase) * 0.018 * energy;
    this.sticks.forEach(stick => { stick.visible = !this.walking; });
    this.rest.forEach(({ bone, quaternion, position }) => { bone.quaternion.copy(quaternion); bone.position.copy(position); });
    const torso = this.bones.get('Torso'); if (torso) torso.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.sin(beat / 2 + this.phase) * 0.02 * energy, sway, sway)));
    const head = this.bones.get('Head'); if (head) head.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.sin(beat + this.phase) * 0.035 * energy, Math.sin(t * 0.65 + this.phase) * 0.09, 0)));
    this.root.updateMatrixWorld(true);
    if (this.guitar) {
      this.guitar.position.set(-0.07, 1.03 + sway, 0.16); this.guitar.rotation.set(0.04, -0.06, -1.03 + sway);
      this.guitar.updateWorldMatrix(true, true);
      const left = this.guitar.localToWorld(new T.Vector3(0.015, 0.71 + Math.sin(t * 1.9 + this.phase) * 0.065, 0.12));
      const right = this.guitar.localToWorld(new T.Vector3(Math.sin(beat * 2) * (reduced ? 0 : 0.075), 0.03, 0.22));
      this.hand('L', left, this.point(0.8, 0.7, 0.3)); this.hand('R', right, this.point(-0.65, 0.9, 0.35));
    } else if (this.role === 'vocals') {
      this.hand('R', this.point(-0.025, 1.48, 0.27), this.point(-0.5, 1.15, 0.5));
      const gesture = !reduced && Math.sin(t * 0.35) > 0.3;
      this.hand('L', gesture ? this.point(0.47, 1.15 + Math.sin(t * 0.8) * 0.12, 0.38) : this.point(0.27, 0.86, 0.12), this.point(0.65, 1.1, 0.1));
      if (this.handheld) this.handheld.position.set(-.025, 1.48, .27);
    } else if (this.role === 'drums' && !this.walking) {
      const hips = this.bones.get('Hips');
      if (hips) { const point = hips.getWorldPosition(new T.Vector3()); point.y -= 0.33; hips.position.copy(hips.parent!.worldToLocal(point)); hips.updateWorldMatrix(false, true); }
      for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? 1 : -1;
        reach(this.bones.get(`UpperLeg.${side}`), this.bones.get(`LowerLeg.${side}`), this.bones.get(`Foot.${side}`), this.point(sign * 0.25, 0.12, 0.54), this.point(sign * 0.3, 0.55, 0.9));
        const strike = reduced ? 0.1 : (Math.sin(beat * (side === 'L' ? 1 : 2) + (side === 'L' ? 0 : Math.PI / 2)) + 1) * 0.1;
        const target = this.point(sign * 0.38, 0.98 + strike, 0.45);
        this.hand(side, target, this.point(sign * 0.7, 0.85, 0.1));
        const stick = this.sticks[side === 'L' ? 0 : 1];
        const grip = this.root.worldToLocal(this.bones.get(`Hand.${side}`)!.getWorldPosition(new T.Vector3()));
        const hit = side === 'L' ? new T.Vector3(0.27, 1.39, 0.97) : new T.Vector3(-0.65, 0.99, 0.41);
        const direction = hit.sub(grip).normalize();
        stick.position.copy(grip).addScaledVector(direction, 0.126); stick.quaternion.setFromUnitVectors(UP, direction);
      }
    } else if (this.role === 'keyboard' || this.role === 'dj') {
      this.hand('L', this.point(.25 + Math.sin(beat) * .04, .99, .43), this.point(.6, .95, .15));
      this.hand('R', this.point(-.25 + Math.cos(beat) * .04, .99, .43), this.point(-.6, .95, .15));
    } else if (this.handheld) {
      const brass = this.role === 'brass';
      this.handheld.position.set(brass ? 0 : .18, brass ? 1.42 : 1.22, .32);
      this.hand('L', this.point(.23, brass ? 1.3 : 1.23, .39), this.point(.65, 1.0, .25));
      this.hand('R', this.point(-.15 + Math.sin(beat) * (reduced ? 0 : .06), brass ? 1.3 : 1.14, .38), this.point(-.65, 1.0, .25));
    } else {
      for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? 1 : -1, raised = this.role === 'fan' && energy > 0.6 && (this.phase + (side === 'L' ? 1 : 0)) % 3 < 1.4;
        this.hand(side, this.point(sign * (raised ? 0.25 : 0.28), raised ? 1.98 : 0.84, raised ? 0.15 : 0.1), this.point(sign * 0.55, raised ? 1.58 : 1.05, 0));
      }
    }
    if (this.walking && !reduced) {
      const hips = this.bones.get('Hips'); if (hips) { const p = hips.getWorldPosition(new T.Vector3()); p.y += Math.abs(Math.sin(t * 7)) * .025; hips.position.copy(hips.parent!.worldToLocal(p)); hips.updateWorldMatrix(false, true); }
      for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? 1 : -1, stride = Math.sin(t * 7 + (sign > 0 ? 0 : Math.PI));
        reach(this.bones.get(`UpperLeg.${side}`), this.bones.get(`LowerLeg.${side}`), this.bones.get(`Foot.${side}`), this.point(sign * .12, .06 + Math.max(0, stride) * .09, stride * .18), this.point(sign * .15, .5, .6));
      }
    }
    if (this.action && /wave|singalong|crowd_interaction|storytelling|mic_trick/.test(this.action)) this.hand('L', this.point(.3, 1.85, .2), this.point(.65, 1.4, .2));
    // Gently curl fingers around instrument necks, sticks and the microphone.
    for (const [name, bone] of this.bones) if (/^(Index|Middle|Ring|Pinky)[34]\./.test(name)) bone.rotateX(this.role === 'fan' ? 0.2 : 0.58);
    this.root.updateMatrixWorld(true);
  }
}

/** Bake a posed rig once; the audience then uses inexpensive GPU instances. */
function crowdGeometry(actor: Musician) {
  const geometries: T.BufferGeometry[] = [];
  actor.root.updateMatrixWorld(true);
  actor.model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (object instanceof T.SkinnedMesh) object.skeleton.update();
    const src = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    const positions = src.attributes.position, output = new Float32Array(positions.count * 3), colors = new Float32Array(positions.count * 3);
    const material = (Array.isArray(object.material) ? object.material[0] : object.material) as T.MeshStandardMaterial;
    for (let i = 0; i < positions.count; i++) {
      const point = new T.Vector3().fromBufferAttribute(positions, i);
      if (object instanceof T.SkinnedMesh) object.applyBoneTransform(object.geometry.index ? object.geometry.index.getX(i) : i, point);
      point.applyMatrix4(object.matrixWorld); output.set(point.toArray(), i * 3); colors.set(material.color.toArray(), i * 3);
    }
    const result = new T.BufferGeometry(); result.setAttribute('position', new T.BufferAttribute(output, 3)); result.setAttribute('color', new T.BufferAttribute(colors, 3)); result.computeVertexNormals(); geometries.push(result); src.dispose();
  });
  const merged = mergeGeometries(geometries, false)!; geometries.forEach(g => g.dispose());
  disposeModel(actor.model);
  return merged;
}

export class DemoCrowd {
  private batches: { mesh: T.InstancedMesh; calm: T.BufferGeometry; fans: { x: number; z: number; scale: number; phase: number; yaw: number }[]; raised: boolean }[] = [];
  private transform = new T.Object3D();
  private phones: T.InstancedMesh;
  constructor(sources: T.Object3D[], scene: T.Scene, seed = 85043) {
    const random = seededRandom(seed), material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.phones = new T.InstancedMesh(new T.BoxGeometry(.075, .13, .012), new T.MeshBasicMaterial({ color: '#b5e6ff', toneMapped: false }), 160); this.phones.name = 'crowd-phone-screens'; this.phones.count = 0; this.phones.frustumCulled = false; scene.add(this.phones);
    const places = Array.from({ length: 160 }, (_, i) => i);
    for (let i = places.length - 1; i > 0; i--) { const other = Math.floor(random() * (i + 1)); [places[i], places[other]] = [places[other], places[i]]; }
    let place = 0;
    for (let kind = 0; kind < 3; kind++) {
      const actor = new Musician(sources[kind % sources.length], 'fan', [0, 0, 0], kind, ['#536077', '#8b4542', '#7f6c55'][kind]); actor.update(0, kind === 0 ? 0.2 : 0.9, true);
      const calmActor = new Musician(sources[kind % sources.length], 'fan', [0, 0, 0], kind, ['#536077', '#8b4542', '#7f6c55'][kind]); calmActor.update(0, .2, true); const calm = crowdGeometry(calmActor);
      const geometry = crowdGeometry(actor), fans: { x: number; z: number; scale: number; phase: number; yaw: number }[] = [];
      const count = kind === 0 ? 80 : 40;
      const mesh = new T.InstancedMesh(geometry, material, count); mesh.frustumCulled = false; mesh.receiveShadow = false;
      for (let i = 0; i < count; i++) {
        // Jittered places preserve personal space while keeping a natural uneven audience.
        const spot = places[place++], x = ((spot % 16) - 7.5) * 0.82 + (random() - 0.5) * 0.18;
        const z = 2.15 + Math.floor(spot / 16) * 1.3 + random() * 0.35;
        fans.push({ x, z, scale: 0.85 + random() * 0.2, phase: random() * Math.PI * 2, yaw: Math.PI + (random() - 0.5) * 0.3 });
        mesh.setColorAt(i, new T.Color().setHSL(random(), 0.12 + random() * 0.18, 0.66 + random() * 0.23));
      }
      scene.add(mesh); mesh.userData.raisedGeometry = geometry; mesh.userData.phoneSide = kind === 1 ? -1 : 1; this.batches.push({ mesh, fans, calm, raised: kind > 0 });
    }
    this.update(0, 0.8, 0.7, false);
  }
  update(seconds: number, density: number, energy: number, reduced: boolean, tuning: Partial<CrowdTuningOptions> = {}, reaction = 'bounce') {
    let phoneCount = 0;
    for (const { mesh, fans, calm, raised } of this.batches) {
      mesh.geometry = energy > .6 || reaction === 'wave' || reaction === 'phone_lights' ? mesh.userData.raisedGeometry : calm;
      mesh.count = Math.round(fans.length * T.MathUtils.clamp(density, 0, 1));
      for (let i = 0; i < mesh.count; i++) {
        const fan = fans[i];
        const t = reduced ? 0 : seconds, bounce = reduced || reaction === 'still' ? 0 : Math.max(0, Math.sin(t * 6.28 + fan.phase)) * energy * (reaction === 'jump' ? .18 : raised ? .07 : .026);
        this.transform.position.set(T.MathUtils.clamp(fan.x * (tuning.lateralSpread ?? 1) + Math.sin(fan.phase) * (tuning.randomness ?? 0) * .2, -7.5, 7.5), bounce, 2.15 + (fan.z - 2.15) * (tuning.depthSpread ?? 1) * (1 - (tuning.stagePull ?? 0) * .3)); this.transform.rotation.set(0, fan.yaw + Math.sin(t * 1.4 + fan.phase) * (reduced ? 0 : 0.035), Math.sin(t * 2 + fan.phase) * (reduced ? 0 : 0.02 * energy)); this.transform.scale.setScalar(fan.scale * Math.min(1.15, tuning.fanScale ?? 1)); this.transform.updateMatrix(); mesh.setMatrixAt(i, this.transform.matrix);
        if (reaction === 'phone_lights' && raised) { const scale = this.transform.scale.x; this.transform.position.x -= mesh.userData.phoneSide * .25 * scale; this.transform.position.y += 1.92 * scale; this.transform.position.z -= .15 * scale; this.transform.rotation.z = 0; this.transform.updateMatrix(); this.phones.setMatrixAt(phoneCount++, this.transform.matrix); }
      } mesh.instanceMatrix.needsUpdate = true;
    }
    this.phones.count = phoneCount; this.phones.instanceMatrix.needsUpdate = true;
  }
  dispose() { for (const { mesh, calm } of this.batches) { calm.dispose(); (mesh.userData.raisedGeometry as T.BufferGeometry).dispose(); } }
}

export async function loadBand(scene: T.Scene, manager: T.LoadingManager, lineup?: ConcertPerformer[], seed?: number) {
  const library = await loadModelLibrary(['casual.glb', 'punk.glb', 'suit.glb', ...requiredModelFiles(lineup?.map(p => p.appearance) ?? [])], manager);
  const casual = library.get('casual.glb')!, punk = library.get('punk.glb')!, suit = library.get('suit.glb')!;
  const cymbals: T.Object3D[] = [];
  try {
    const actors = lineup ? lineup.map(p => {
      const assembled = assemblePlayerModel(library, p.appearance);
      const actor = new Musician(assembled, p.role, p.position, p.phase, undefined, p.appearance); disposeModel(assembled);
      actor.id = p.id; actor.root.name = p.displayName; actor.root.visible = false;
      if (p.role === 'drums') {
        const kit = new T.Group(); kit.position.set(...p.position); kit.scale.copy(actor.root.scale); scene.add(kit); cymbals.push(...buildDrummerKit(kit));
      }
      if (p.role === 'keyboard' || p.role === 'dj') { const keys = buildKeyboard(p.role === 'dj'); keys.position.set(p.position[0], p.position[1], p.position[2]); keys.scale.copy(actor.root.scale); scene.add(keys); }
      return actor;
    }) : [new Musician(punk, 'vocals', [0, .9, -.97], 0, '#5f354a'), new Musician(casual, 'guitar', [-2.65, .9, -1.35], 1.2, '#577386'), new Musician(suit, 'bass', [2.7, .9, -1.65], 2.6, '#254c47'), new Musician(casual, 'drums', [.8, 1.16, -3.58], .8, '#874a47')];
    actors.forEach(actor => scene.add(actor.root));
    const crowd = new DemoCrowd([casual, library.get('female-casual.glb') ?? suit, punk], scene, seed);
    return { actors, crowd, cymbals };
  } finally { library.forEach(disposeModel); }
}
