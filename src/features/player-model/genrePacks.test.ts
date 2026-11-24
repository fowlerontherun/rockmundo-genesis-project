// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GENRE_PACKS, genrePackItems } from '@/features/clothing-preview/genrePacks';
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { defaultAppearance, modelFile, STYLES } from './appearance';
import { Musician } from '@/features/gig-demo-3d/performers';
const library: ModelLibrary = new Map();
beforeAll(async () => {
  for (const frame of ['masculine', 'feminine'] as const) for (const style of STYLES) {
    const file = modelFile(frame, style), data = readFileSync(`public/gig-demo-3d/${file}`);
    library.set(file, (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, '')).scene);
  }
});
describe('genre pack stage compatibility', () => {
  it.each(GENRE_PACKS)('$name has a wearable top, full-length bottom and footwear', pack => {
    expect(genrePackItems(pack).map(item => item.wearable_slot)).toEqual(['top', 'bottom', 'footwear']);
  });
  it.each(['masculine', 'feminine'] as const)('keeps all packs rigged and finite in %s performance poses', frame => {
    for (const pack of GENRE_PACKS) {
      const appearance = defaultAppearance(); appearance.body.frame = frame;
      const clothing = genrePackItems(pack).map(item => ({ item }));
      for (const role of ['vocals', 'guitar', 'bass', 'drums'] as const) {
        const model = assemblePlayerModel(library, appearance, [], clothing);
        const actor = new Musician(model, role, [0, 0, 0], 0, undefined, appearance);
        for (const time of [0, 9, 25]) {
          actor.update(time, .7, false); actor.root.updateMatrixWorld(true);
          let vertices = 0;
          actor.root.traverse(node => {
            if (!(node instanceof T.SkinnedMesh)) return;
            node.skeleton.update();
            for (let i = 0; i < node.geometry.attributes.position.count; i += 37) {
              const vertex = node.getVertexPosition(i, new T.Vector3()).applyMatrix4(node.matrixWorld);
              expect(vertex.toArray().every(Number.isFinite)).toBe(true);
              expect(vertex.length()).toBeLessThan(4); vertices++;
            }
          });
          expect(vertices).toBeGreaterThan(20);
        }
        disposeModel(model); disposeModel(actor.root);
      }
    }
  });
});