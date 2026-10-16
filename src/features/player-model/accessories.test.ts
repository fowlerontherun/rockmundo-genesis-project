// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { appearanceSchema, defaultAppearance, resolveAppearance, HAT_STYLES, GLASSES_STYLES, modelFile, STYLES, HAIR_STYLES } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { mergeEquippedAvatarV1Accessories } from '@/features/clothing-preview/equippedClothing';

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
  const a = defaultAppearance(); a.accessories = { ...a.accessories!, hat: 'beanie', glasses: 'round', earrings: 'hoops', leftEarring: 'hoops', rightEarring: 'hoops' };
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

it.each(['masculine', 'feminine'] as const)('shows the gifted Pumpkin Hat on %s wardrobe avatars and animated gig performers', frame => {
  const appearance = defaultAppearance();
  appearance.body.frame = frame;
  appearance.accessories = { ...appearance.accessories!, hat: 'beanie' };
  const clothing = [{
    item: {
      id: 'halloween-pumpkin-2026',
      name: 'Haunted Pumpkin Hat 2026',
      category: 'hat',
      wearable_slot: 'headwear',
      curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
      render_config: { headwearStyle: 'pumpkin' },
      material_config: { primaryColor: '#ee781c' },
    } as unknown as ClothingItem,
  }];
  const model = assemblePlayerModel(library, appearance, [], clothing);
  expect(model.getObjectByName('avatar-hat-beanie')).toBeUndefined();
  const hat = model.getObjectByName('avatar-owned-hat-pumpkin-2026');
  expect(hat).toBeTruthy();
  expect(hat!.getObjectByName('pumpkin-crown')).toBeTruthy();
  expect(hat!.getObjectByName('pumpkin-eye')).toBeTruthy();
  expect(hat!.getObjectByName('pumpkin-mouth')).toBeTruthy();
  expect(hat!.getObjectByName('pumpkin-stalk')).toBeTruthy();
  expect(hat!.parent).toBe(model.getObjectByName('avatar-accessories'));
  const actor = new Musician(model, 'guitar', [2, 0, -1], 0, undefined, appearance, undefined, undefined, clothing);
  actor.update(1.5, .9, false);
  const stageHat = actor.root.getObjectByName('avatar-owned-hat-pumpkin-2026');
  expect(stageHat).toBeTruthy();
  expect(stageHat!.parent?.parent).toBe(actor.bones.get('Head'));
  actor.update(5, .9, false);
  expect(actor.root.getObjectByName('pumpkin-mouth')).toBeTruthy();
  disposeModel(model);
  disposeModel(actor.root);
});

it.each(['masculine', 'feminine'] as const)(
  'attaches a real Pumpkin Hat to the %s headbone from saved inventory even when stage query returned zero garments',
  frame => {
    const item = {
      id: 'pumpkin-2026',
      name: 'Haunted Pumpkin Hat 2026',
      category: 'hat',
      wearable_slot: 'headwear',
      curated_asset_status: 'asset_ready',
      curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
      render_config: { renderFamily: 'avatar-v1-accessory', headwearStyle: 'pumpkin' },
      color_variants: ['#ee781c'],
      material_config: { primaryColor: '#ee781c' },
    } as unknown as ClothingItem;
    const clothes = mergeEquippedAvatarV1Accessories([], [{
      item_id: item.id, item_type: 'clothing', is_equipped: true,
      selected_variant_key: null, customization_config: {},
    }], [item]);
    expect(clothes).toHaveLength(1);
    const appearance = defaultAppearance(); appearance.body.frame = frame;
    const model = assemblePlayerModel(library, appearance, [], clothes);
    const pumpkin = model.getObjectByName('avatar-owned-hat-pumpkin-2026');
    expect(pumpkin).toBeTruthy();
    expect(pumpkin!.getObjectByName('pumpkin-mouth')).toBeTruthy();
    expect(pumpkin!.parent?.parent).toBe(model.getObjectByName('Head'));
    disposeModel(model);
  },
);

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

it.each(['masculine', 'feminine'] as const)('preserves a %s Pumpkin Hat in an archived gig snapshot after the wardrobe is changed', frame => {
  const appearance = defaultAppearance();
  appearance.body.frame = frame;
  const snapshotClothing = [{
    item: {
      id: 'event-pumpkin-hat',
      name: 'Haunted Pumpkin Hat 2026',
      category: 'hat',
      wearable_slot: 'headwear',
      curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
      render_config: { headwearStyle: 'pumpkin' },
    } as unknown as ClothingItem,
  }];

  // Replay must use the frozen snapshot, not what the player currently owns.
  const historical = assemblePlayerModel(library, appearance, [], snapshotClothing);
  const historicalActor = new Musician(historical, 'drums', [4, 0, -2], 0, undefined, appearance, undefined, undefined, snapshotClothing);
  const stageHat = historicalActor.root.getObjectByName('avatar-owned-hat-pumpkin-2026')!;
  expect(stageHat).toBeTruthy();
  expect(stageHat.parent?.parent).toBe(historicalActor.bones.get('Head'));
  historicalActor.update(0.2, .6, false);
  const firstWorld = stageHat.getWorldPosition(new T.Vector3());
  historicalActor.update(7.5, .6, false);
  const secondWorld = stageHat.getWorldPosition(new T.Vector3());
  expect(firstWorld.distanceTo(secondWorld)).toBeLessThan(1);

  const nowUnequipped = assemblePlayerModel(library, appearance, [], []);
  expect(nowUnequipped.getObjectByName('avatar-owned-hat-pumpkin-2026')).toBeUndefined();
  expect(historicalActor.root.getObjectByName('avatar-owned-hat-pumpkin-2026')).toBeTruthy();

  disposeModel(nowUnequipped);
  disposeModel(historical);
  disposeModel(historicalActor.root);
});
