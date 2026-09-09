// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { DemoCrowd, Musician } from './performers';

const models: T.Object3D[] = [];
beforeAll(async () => {
  for (const name of ['casual', 'punk', 'suit']) {
    const file = readFileSync(resolve(`public/gig-demo-3d/${name}.glb`));
    const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, '');
    models.push(gltf.scene);
  }
});

describe('performance poses using the shipped rigs', () => {
  it.each(['vocals', 'guitar', 'bass', 'drums'] as const)('%s keeps finite, articulated bones throughout the set', role => {
    const musician = new Musician(models[role === 'vocals' ? 1 : role === 'bass' ? 2 : 0], role, [0, 0.9, -1]);
    for (const name of ['Head', 'UpperArm.L', 'LowerArm.L', 'Hand.L', 'UpperArm.R', 'LowerArm.R', 'Hand.R']) expect(musician.bones.has(name)).toBe(true);
    for (const seconds of [0, 0.0625, 8, 21, 48, 77, 95]) {
      musician.update(seconds, 1, false);
      for (const bone of musician.bones.values()) {
        expect(bone.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        expect(bone.quaternion.length()).toBeCloseTo(1, 5);
      }
      const head = musician.bones.get('Head')!.getWorldPosition(new T.Vector3());
      expect(head.y).toBeGreaterThan(2); expect(head.y).toBeLessThan(2.7);
    }
  });

  it.each(['guitar', 'bass'] as const)('%s keeps the fretting hand on the neck and picking hand at the body', role => {
    const musician = new Musician(models[role === 'bass' ? 2 : 0], role, [0, 0, 0]);
    const instrument = musician.root.getObjectByName('instrument')!;
    const neck = instrument.getObjectByName('fretboard')!;
    for (const seconds of [0, 0.0625, 8, 21, 48, 77, 95]) {
      musician.update(seconds, 1, false);
      const left = musician.bones.get('Hand.L')!.getWorldPosition(new T.Vector3());
      const right = musician.bones.get('Hand.R')!.getWorldPosition(new T.Vector3());
      expect(new T.Box3().setFromObject(neck).distanceToPoint(left)).toBeLessThan(0.08);
      const localRight = instrument.worldToLocal(right);
      expect(Math.abs(localRight.x)).toBeLessThan(0.2);
      expect(Math.abs(localRight.y)).toBeLessThan(0.2);
      expect(localRight.z).toBeGreaterThan(0.1);
      expect(localRight.z).toBeLessThan(0.32);
    }
  });

  it('reduced motion holds a fixed pose, and animating a clone does not move another musician', () => {
    const a = new Musician(models[0], 'guitar', [0, 0, 0]), b = new Musician(models[0], 'guitar', [0, 0, 0]);
    const matrices = (actor: Musician) => [...actor.bones.values()].flatMap(bone => bone.matrixWorld.toArray());
    const untouched = matrices(b);
    a.update(10, 0.8, true); const reduced = matrices(a);
    a.update(40, 0.8, true); expect(matrices(a)).toEqual(reduced);
    a.update(18.0625, 0.8, false); expect(matrices(a)).not.toEqual(reduced);
    expect(matrices(b)).toEqual(untouched);
  });

  it('bakes correctly sized humans into three crowd batches and changes density independently of energy', () => {
    const scene = new T.Scene(), crowd = new DemoCrowd(models, scene);
    const meshes = scene.children.filter((object): object is T.InstancedMesh => object instanceof T.InstancedMesh && object.name !== 'crowd-phone-screens');
    expect(meshes).toHaveLength(3);
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox(); const size = mesh.geometry.boundingBox!.getSize(new T.Vector3());
      expect(size.y).toBeGreaterThan(1.6); expect(size.y).toBeLessThan(2.3);
      expect(size.x).toBeLessThan(1.4);
    }
    crowd.update(10, 1, 0.1, false); expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(160);
    crowd.update(10, 0, 1, false); expect(meshes.every(mesh => mesh.count === 0)).toBe(true);
    crowd.update(10, 0.5, 1, true); expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(80);
    const still = meshes.map(mesh => Array.from(mesh.instanceMatrix.array));
    crowd.update(50, 0.5, 1, true); expect(meshes.map(mesh => Array.from(mesh.instanceMatrix.array))).toEqual(still);
  });
});
