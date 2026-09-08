import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGuitar, rod, matte } from './stage';
import { seededRandom } from './config';
import { demoAssetUrl } from './assets';

type Role = 'vocals' | 'guitar' | 'bass' | 'drums' | 'fan';
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
  private scale: number;
  constructor(source: T.Object3D, public role: Role, position: [number, number, number], public phase = 0, tint = '#728092') {
    this.model = clone(source); this.root.add(this.model); this.root.position.set(...position);
    this.model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(this.model), height = bounds.max.y - bounds.min.y;
    this.scale = 1.78 / Math.max(0.01, height);
    this.model.scale.multiplyScalar(this.scale); this.model.position.y -= bounds.min.y * this.scale;
    this.model.traverse(object => {
      if (object instanceof T.Bone) { this.bones.set(object.name.replace(/([a-z0-9])([LR])$/, '$1.$2').replace(/_/g, '.'), object); this.rest.push({ bone: object, quaternion: object.quaternion.clone(), position: object.position.clone() }); }
      if (object instanceof T.Mesh) {
        object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
        const configure = (sourceMat: T.Material) => {
          const mat = sourceMat.clone() as T.MeshStandardMaterial;
          if (mat.isMeshStandardMaterial) {
            const skin = /skin|eye|hair/i.test(mat.name); mat.metalness = /earring/i.test(mat.name) ? 0.6 : 0; mat.roughness = skin ? 0.69 : 0.82;
            if (/lightblue|blue|green|red_dark/i.test(mat.name)) mat.color.set(tint);
            if (/black/i.test(mat.name)) { mat.color.set('#222630'); mat.roughness = 0.55; }
          }
          return mat;
        };
        object.material = Array.isArray(object.material) ? object.material.map(configure) : configure(object.material);
      }
    });
    if (role === 'guitar' || role === 'bass') { this.guitar = buildGuitar(role === 'bass'); this.root.add(this.guitar); }
    if (role === 'drums') for (let i = 0; i < 2; i++) this.sticks.push(rod(this.root, [0, 0, 0], [0, 0, 0.42], 0.007, matte('#d2ad71', 0.55)));
    this.root.updateMatrixWorld(true); this.update(0, 0.7, false);
  }
  point(x: number, y: number, z: number) { return this.root.localToWorld(new T.Vector3(x, y, z)); }
  private hand(side: 'L' | 'R', target: T.Vector3, pole: T.Vector3) {
    reach(this.bones.get(`UpperArm.${side}`), this.bones.get(`LowerArm.${side}`), this.bones.get(`Hand.${side}`), target, pole);
  }
  update(seconds: number, energy: number, reduced: boolean) {
    const t = reduced ? 0 : seconds, beat = t * Math.PI * 4, sway = Math.sin(t * 1.6 + this.phase) * 0.018 * energy;
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
    } else if (this.role === 'drums') {
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
    } else {
      for (const side of ['L', 'R'] as const) {
        const sign = side === 'L' ? 1 : -1, raised = energy > 0.6 && (this.phase + (side === 'L' ? 1 : 0)) % 3 < 1.4;
        this.hand(side, this.point(sign * (raised ? 0.25 : 0.28), raised ? 1.98 : 0.84, raised ? 0.15 : 0.1), this.point(sign * 0.55, raised ? 1.58 : 1.05, 0));
      }
    }
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
  actor.model.traverse(object => { if (object instanceof T.Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => mat.dispose()); });
  return merged;
}

export class DemoCrowd {
  private batches: { mesh: T.InstancedMesh; fans: { x: number; z: number; scale: number; phase: number; yaw: number }[]; raised: boolean }[] = [];
  private transform = new T.Object3D();
  constructor(sources: T.Object3D[], scene: T.Scene) {
    const random = seededRandom(85043), material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const places = Array.from({ length: 160 }, (_, i) => i);
    for (let i = places.length - 1; i > 0; i--) { const other = Math.floor(random() * (i + 1)); [places[i], places[other]] = [places[other], places[i]]; }
    let place = 0;
    for (let kind = 0; kind < 3; kind++) {
      const actor = new Musician(sources[kind % sources.length], 'fan', [0, 0, 0], kind, ['#536077', '#8b4542', '#7f6c55'][kind]); actor.update(0, kind === 0 ? 0.2 : 0.9, true);
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
      scene.add(mesh); this.batches.push({ mesh, fans, raised: kind > 0 });
    }
    this.update(0, 0.8, 0.7, false);
  }
  update(seconds: number, density: number, energy: number, reduced: boolean) {
    for (const { mesh, fans, raised } of this.batches) {
      mesh.count = Math.round(fans.length * density);
      for (let i = 0; i < mesh.count; i++) {
        const fan = fans[i];
        const t = reduced ? 0 : seconds, bounce = reduced ? 0 : Math.max(0, Math.sin(t * 6.28 + fan.phase)) * energy * (raised ? 0.07 : 0.026);
        this.transform.position.set(fan.x, bounce, fan.z); this.transform.rotation.set(0, fan.yaw + Math.sin(t * 1.4 + fan.phase) * (reduced ? 0 : 0.035), Math.sin(t * 2 + fan.phase) * (reduced ? 0 : 0.02 * energy)); this.transform.scale.setScalar(fan.scale); this.transform.updateMatrix(); mesh.setMatrixAt(i, this.transform.matrix);
      } mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export async function loadBand(scene: T.Scene, manager: T.LoadingManager) {
  const loader = new GLTFLoader(manager);
  const [casual, punk, suit] = await Promise.all(['casual.glb', 'punk.glb', 'suit.glb'].map(file => loader.loadAsync(demoAssetUrl(file))));
  const actors = [new Musician(punk.scene, 'vocals', [0, 0.9, -0.97], 0, '#5f354a'), new Musician(casual.scene, 'guitar', [-2.65, 0.9, -1.35], 1.2, '#577386'), new Musician(suit.scene, 'bass', [2.7, 0.9, -1.65], 2.6, '#254c47'), new Musician(casual.scene, 'drums', [0.8, 1.16, -3.58], 0.8, '#874a47')];
  actors.forEach(actor => scene.add(actor.root));
  const crowd = new DemoCrowd([casual.scene, suit.scene, punk.scene], scene);
  return { actors, crowd };
}
