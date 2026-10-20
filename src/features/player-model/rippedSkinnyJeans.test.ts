// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { assemblePlayerModel, disposeModel, type ModelLibrary } from './model';
import { defaultAppearance, modelFile, resolveAppearance, starterItemsForWardrobe, STYLES } from './appearance';
import { RIPPED_SKINNY_JEANS } from './rippedSkinnyJeans';

describe('standard ripped skinny jeans', () => {
  it.each(['masculine', 'feminine'] as const)('fits and persists on the %s rig with skin-matched knee details', async frame => {
    const library: ModelLibrary = new Map();
    for (const style of STYLES) {
      const file = modelFile(frame, style), data = readFileSync(`public/gig-demo-3d/${file}`);
      library.set(file, (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')).scene);
    }
    expect(starterItemsForWardrobe('bottom').some(item => item.id === RIPPED_SKINNY_JEANS)).toBe(true);
    for (const build of [.85, 1.15]) {
      const appearance = defaultAppearance();
      appearance.body.frame = frame;
      appearance.body.build = build;
      appearance.body.skin = '#79523c';
      appearance.equipment.bottom = { itemId: RIPPED_SKINNY_JEANS, color: '#17181b' };
      const restored = resolveAppearance(JSON.parse(JSON.stringify(appearance)));
      expect(restored.equipment.bottom).toEqual(appearance.equipment.bottom);
      const model = assemblePlayerModel(library, restored);
      let fitted = 0;
      model.traverse(node => {
        if (!(node instanceof T.SkinnedMesh) || !node.userData.avatarV1RippedSkinnyJeans) return;
        fitted++;
        const coords = node.geometry.getAttribute('rippedDenimPosition');
        expect(Array.from(coords.array).every(Number.isFinite)).toBe(true);
        expect(coords.count).toBe(node.geometry.getAttribute('skinWeight').count);
        // Both front knees have surface vertices near the opening; no back holes.
        let front = 0;
        for (let i = 0; i < coords.count; i++) if (Math.abs(coords.getY(i)) < .1 && coords.getZ(i) > .025) front++;
        expect(front).toBeGreaterThan(0);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (/skin|earring|metal/i.test(material.name)) continue;
          expect(material.userData.rippedDenimSkin).toBe('#79523c');
          const shader = { uniforms: {}, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader };
          material.onBeforeCompile(shader as never, {} as never);
          expect(shader.fragmentShader).toContain('rippedDenimSkin * .82');
          expect(shader.vertexShader).toContain('vRippedDenim = rippedDenimPosition');
        }
      });
      expect(fitted).toBeGreaterThan(0);
      const bounds = new T.Box3().setFromObject(model);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1.5);
      expect(bounds.max.y - bounds.min.y).toBeLessThan(2.3);
      disposeModel(model);
    }
    library.forEach(disposeModel);
  });
});
