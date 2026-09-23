// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { appearanceSchema, defaultAppearance, resolveAppearance, HAT_STYLES, GLASSES_STYLES, modelFile, STYLES, HAIR_STYLES } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';
import type { ClothingItem } from '@/hooks/useSkinStore';

const library: ModelLibrary = new Map();
beforeAll(async () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const style of STYLES) {
    const file = modelFile(frame, style), data = readFileSync(`public/gig-demo-3d/${file}`);
    library.set(file, (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, '')).scene);
  }
});
afterAll(() => library.forEach(disposeModel));

it.each(['masculine', 'feminine'] as const)('keeps detailed accessories attached during %s performances, including a translated stage', frame => {
  for (const hat of HAT_STYLES) for (const glasses of GLASSES_STYLES) {
    const a = defaultAppearance(); a.body.frame = frame;
    a.accessories = { ...a.accessories!, hat, glasses, lensTint: 'tinted', lensColor: '#bd3548' };
    const model = assemblePlayerModel(library, a);
    const actor = new Musician(model, 'guitar', [3, .9, -2], 0, undefined, a);
    disposeModel(model);
    const anchor = actor.root.getObjectByName('avatar-accessories');
    if (hat !== 'none' || glasses !== 'none') {
      expect(anchor?.parent).toBe(actor.bones.get('Head'));
      actor.update(.2, .8, false); actor.root.updateMatrixWorld(true);
      const local = anchor!.matrix.clone();
      actor.update(3, .8, false); actor.root.updateMatrixWorld(true);
      expect(anchor!.matrix.equals(local)).toBe(true);
      const box = new T.Box3().setFromObject(anchor!);
      expect(box.getCenter(new T.Vector3()).distanceTo(actor.bones.get('Head')!.getWorldPosition(new T.Vector3()))).toBeLessThan(.6);
    }
    if (glasses !== 'none') {
      const lens = actor.root.getObjectByName('glasses-lens-1') as T.Mesh;
      expect(lens).toBeTruthy();
      expect((lens.material as T.MeshPhysicalMaterial).color.getHexString()).toBe('bd3548');
      expect(actor.root.getObjectByName('glasses-arm-1')).toBeTruthy();
      expect(actor.root.getObjectByName('glasses-ear-hook-1')).toBeTruthy();
    }
    disposeModel(actor.root); if (actor.equipment) disposeModel(actor.equipment);
  }
});

it('restores the saved hairstyle after removing a hat and never alters source geometry', () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const hairStyle of HAIR_STYLES) {
    const a = defaultAppearance(); a.body.frame = frame; a.head.hairStyle = hairStyle;
    const original = assemblePlayerModel(library, a);
    a.accessories!.hat = 'baseball_cap';
    const hatted = assemblePlayerModel(library, a);
    a.accessories!.hat = 'none';
    const restored = assemblePlayerModel(library, a);
    const originalHair = original.getObjectByName('avatar-hairstyle') as T.Mesh | undefined;
    const restoredHair = restored.getObjectByName('avatar-hairstyle') as T.Mesh | undefined;
    if (originalHair) expect(Array.from(restoredHair!.geometry.attributes.position.array)).toEqual(Array.from(originalHair.geometry.attributes.position.array));
    expect(a.head.hairStyle).toBe(hairStyle);
    [original, hatted, restored].forEach(disposeModel);
  }
});

it('lets owned accessories replace starters without changing the saved choice or earrings', () => {
  const a = defaultAppearance(); a.accessories = { ...a.accessories!, hat: 'beanie', glasses: 'round', earrings: 'hoops' };
  const clothing = ['headwear', 'eyewear'].map(slot => ({ item: { id: slot, category: slot, wearable_slot: slot } as ClothingItem }));
  const assembled = assemblePlayerModel(library, a, [], clothing);
  expect(assembled.getObjectByName('avatar-hat-beanie')).toBeUndefined();
  expect(assembled.getObjectByName('avatar-glasses-round')).toBeUndefined();
  expect(assembled.getObjectByName('avatar-earring-left-hoops')).toBeTruthy();
  expect(assembled.getObjectByName('avatar-earring-right-hoops')).toBeTruthy();
  expect(a.accessories.hat).toBe('beanie');
  const actor = new Musician(assembled, 'other', [0, 0, 0], 0, undefined, a, undefined, undefined, clothing);
  expect(actor.bones.get('Head')!.children.some(child => child instanceof T.Mesh)).toBe(true);
  disposeModel(assembled); disposeModel(actor.root);
});

it('round-trips lens and independent earring controls and rejects malformed settings', () => {
  const a = defaultAppearance(); a.accessories = { ...a.accessories!, hat: 'cowboy', glasses: 'aviator', lensTint: 'clear', lensColor: '#338b8d', leftEarring: 'studs', rightEarring: 'drops' };
  expect(resolveAppearance(JSON.parse(JSON.stringify(a)))).toEqual(a);
  const assembled = assemblePlayerModel(library, a);
  expect(assembled.getObjectByName('avatar-earring-left-studs')).toBeTruthy();
  expect(assembled.getObjectByName('avatar-earring-right-drops')).toBeTruthy();
  disposeModel(assembled);
  for (const extra of [{ lensTint: 'opaque' }, { lensColor: 'red' }, { hat: 'paid-hat-id' }, { lensColor: null }, { leftEarring: 'chain' }, { rightEarring: null }, { unexpected: true }]) {
    expect(appearanceSchema.safeParse({ ...a, accessories: { ...a.accessories, ...extra } }).success).toBe(false);
  }
});



it.each(['masculine', 'feminine'] as const)('fits high-quality earrings to the %s head surface with physical metal', frame => {
  const a = defaultAppearance('ear-fit');
  a.body.frame = frame;
  a.accessories = { ...a.accessories!, leftEarring: 'studs', rightEarring: 'drops', earringColor: '#d8ad49' };
  const assembled = assemblePlayerModel(library, a, [], [], 'high');
  assembled.updateMatrixWorld(true);

  const left = assembled.getObjectByName('avatar-earring-left-studs')!;
  const right = assembled.getObjectByName('avatar-earring-right-drops')!;
  const leftStud = left.getObjectByName('earring-stud') as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;
  const rightStud = right.getObjectByName('earring-drop-stud') as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;

  expect(leftStud.material).toBeInstanceOf(T.MeshPhysicalMaterial);
  expect(rightStud.material).toBeInstanceOf(T.MeshPhysicalMaterial);
  expect(leftStud.material.clearcoat).toBeGreaterThan(.5);
  expect(rightStud.material.metalness).toBeGreaterThan(.9);

  const head = assembled.getObjectByName('Head') as T.Bone;
  const headPosition = head.getWorldPosition(new T.Vector3());
  const leftPosition = leftStud.getWorldPosition(new T.Vector3());
  const rightPosition = rightStud.getWorldPosition(new T.Vector3());
  expect(leftPosition.x).toBeLessThan(headPosition.x);
  expect(rightPosition.x).toBeGreaterThan(headPosition.x);
  expect(leftPosition.distanceTo(headPosition)).toBeLessThan(.5);
  expect(rightPosition.distanceTo(headPosition)).toBeLessThan(.5);

  disposeModel(assembled);
});

it('prints the Rockmundo wordmark on the default tee and hides it under a rich top', () => {
  const a = defaultAppearance('logo-test');
  expect(a.equipment.top.itemId).toBe('starter.top.casual');
  const assembled = assemblePlayerModel(library, a);
  expect(assembled.getObjectByName('avatar-rockmundo-logo')).toBeTruthy();
  disposeModel(assembled);
  const clothing = [{ item: { id: 'rich-top', category: 'top', wearable_slot: 'top' } as ClothingItem }];
  const covered = assemblePlayerModel(library, a, [], clothing);
  expect(covered.getObjectByName('avatar-rockmundo-logo')).toBeUndefined();
  disposeModel(covered);
});
