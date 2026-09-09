// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { appearanceSchema, defaultAppearance, resolveAppearance, STYLES, modelFile } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';

const library: ModelLibrary = new Map();
beforeAll(async () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const style of STYLES) {
    const file = modelFile(frame, style), data = readFileSync(`public/gig-demo-3d/${file}`);
    library.set(file, (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, '')).scene);
  }
});

describe('shipped modular stage models', () => {
  it.each(['masculine', 'feminine'] as const)('assembles every %s starter outfit with correctly bound and scaled parts', frame => {
    for (const head of STYLES) for (const top of STYLES) for (const bottom of STYLES) for (const footwear of STYLES) {
      const appearance = defaultAppearance(); appearance.body.frame = frame; appearance.head.style = head;
      appearance.equipment.top.itemId = `starter.top.${top}`; appearance.equipment.bottom.itemId = `starter.bottom.${bottom}`; appearance.equipment.footwear.itemId = `starter.footwear.${footwear}`;
      const model = assemblePlayerModel(library, appearance);
      const boneNames: string[] = []; model.traverse(node => { if (node instanceof T.Bone) boneNames.push(node.name); });
      expect(new Set(boneNames).size).toBe(boneNames.length);
      const parts = new Set<string>(); let skinVertices = 0;
      model.traverse(node => {
        if (!(node instanceof T.SkinnedMesh)) return;
        let parent: T.Object3D | null = node; while (parent && !/_(Body|Head|Legs|Feet)/i.test(parent.name)) parent = parent.parent;
        expect(parent).not.toBeNull(); parts.add(parent!.name.match(/_(Body|Head|Legs|Feet)/i)![1].toLowerCase());
        node.skeleton.update();
        for (let i = 0; i < node.geometry.attributes.position.count; i += 61) {
          const vertex = node.getVertexPosition(i, new T.Vector3()).applyMatrix4(node.matrixWorld);
          expect(vertex.toArray().every(Number.isFinite)).toBe(true);
          expect(vertex.length()).toBeLessThan(3); skinVertices++;
        }
      });
      expect([...parts].sort()).toEqual(['body', 'feet', 'head', 'legs']); expect(skinVertices).toBeGreaterThan(20);
      const bounds = new T.Box3().setFromObject(model);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1.5); expect(bounds.max.y - bounds.min.y).toBeLessThan(2.2);
      disposeModel(model);
    }
  });
  it.each(['masculine', 'feminine'] as const)('keeps %s hands on the guitar after customisation, walking and seeking backwards', frame => {
    const appearance = defaultAppearance(); appearance.body = { ...appearance.body, frame, height: 1.1, build: .85 }; appearance.head.style = 'punk'; appearance.equipment.top.itemId = 'starter.top.suit';
    const source = assemblePlayerModel(library, appearance), actor = new Musician(source, 'guitar', [0, 0, 0], 0, undefined, appearance); disposeModel(source);
    const instrument = actor.root.getObjectByName('instrument')!;
    for (const time of [0, 12, 37, 4, 20]) {
      actor.walking = time === 12; actor.update(time, .8, false);
      const hand = actor.bones.get('Hand.L')!.getWorldPosition(new T.Vector3());
      const localHand = instrument.worldToLocal(hand);
      expect(Math.abs(localHand.x)).toBeLessThan(.1); expect(localHand.y).toBeGreaterThan(.5); expect(localHand.y).toBeLessThan(.9);
      const bounds = new T.Box3().setFromObject(actor.root); expect(bounds.max.y).toBeLessThan(2.8); expect(bounds.min.y).toBeGreaterThan(-.25);
    }
    actor.walking = false; actor.update(4, .8, false); const first = actor.bones.get('Head')!.matrixWorld.toArray(); actor.update(90, .8, false); actor.update(4, .8, false); expect(actor.bones.get('Head')!.matrixWorld.toArray()).toEqual(first);
    disposeModel(actor.root);
  });
  it('dyes the feminine casual shirt and keeps skin and eyes independent', () => {
    const appearance = defaultAppearance(); appearance.body.frame = 'feminine'; appearance.equipment.top = { itemId: 'starter.top.casual', color: '#00ff00' }; appearance.body.skin = '#8d5524';
    const model = assemblePlayerModel(library, appearance); const found = new Map<string, string>();
    model.traverse(node => { if (node instanceof T.Mesh && /Body/.test(node.name + node.parent?.name)) for (const material of Array.isArray(node.material) ? node.material : [node.material]) found.set(material.name, (material as T.MeshStandardMaterial).color.getHexString()); });
    expect(found.get('White')).toBe('00ff00'); expect(found.get('Skin')).toBe('8d5524'); disposeModel(model);
  });
  it.each(['masculine', 'feminine'] as const)('moves the visible %s clothing with the IK bones, not an unbound duplicate rig', frame => {
    const appearance = defaultAppearance(); appearance.body.frame = frame; appearance.equipment.top.itemId = 'starter.top.suit';
    const source = assemblePlayerModel(library, appearance), actor = new Musician(source, 'drums', [0, 0, 0], 0, undefined, appearance); disposeModel(source);
    const meshes: T.SkinnedMesh[] = []; actor.model.traverse(node => { if (node instanceof T.SkinnedMesh) meshes.push(node); });
    for (const mesh of meshes) for (const bone of mesh.skeleton.bones) {
      const key = bone.name.replace(/([a-z0-9])([LR])$/, '$1.$2').replace(/_/g, '.').replace(/^Wrist\./, 'Hand.');
      expect(actor.bones.get(key)).toBe(bone);
    }
    const body = meshes.find(mesh => /Body/.test(mesh.name + mesh.parent?.name))!;
    const points = () => { body.skeleton.update(); return Array.from({ length: body.geometry.attributes.position.count }, (_, i) => body.getVertexPosition(i, new T.Vector3()).applyMatrix4(body.matrixWorld)); };
    actor.update(.1, 1, false); const before = points(); actor.update(.32, 1, false); const after = points();
    expect(Math.max(...before.map((point, i) => point.distanceTo(after[i])))).toBeGreaterThan(.02);
    disposeModel(actor.root);
  });
});
describe('appearance boundaries', () => {
  it('rejects unknown items, URLs, non-finite dimensions, invalid colours and extra keys', () => {
    for (const edit of [
      (a: ReturnType<typeof defaultAppearance>) => { a.equipment.top.itemId = 'paid.exclusive'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.equipment.top.itemId = 'https://example.com/model.glb'; },
      (a: ReturnType<typeof defaultAppearance>) => { a.body.height = Infinity; },
      (a: ReturnType<typeof defaultAppearance>) => { a.head.hair = 'red'; },
    ]) { const value = defaultAppearance(); edit(value); expect(appearanceSchema.safeParse(value).success).toBe(false); expect(resolveAppearance(value, 'safe')).toEqual(defaultAppearance('safe')); }
    expect(appearanceSchema.safeParse({ ...defaultAppearance(), bonus: 100 }).success).toBe(false);
  });
});
