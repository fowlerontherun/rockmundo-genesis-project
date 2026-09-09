// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { appearanceSchema, STARTER_ITEMS } from '@/features/player-model/appearance';
import { disposeModel, requiredModelFiles, type ModelLibrary } from '@/features/player-model/model';
import { crowdAppearances, crowdMotion } from './crowdAnimation';
import { DemoCrowd } from './performers';
describe('individual crowd identity and motion', () => {
    it('covers both frames, varied skin/hair/build and all free outfits with reproducible identities', () => {
        const appearances = crowdAppearances(872);
        expect(appearances).toEqual(crowdAppearances(872));
        expect(appearances).not.toEqual(crowdAppearances(100));
        for (const a of appearances)
            expect(appearanceSchema.safeParse(a).success).toBe(true);
        expect(new Set(appearances.map(a => a.body.frame)).size).toBe(2);
        expect(new Set(appearances.map(a => a.body.skin)).size).toBe(8);
        expect(new Set(appearances.map(a => a.head.hairStyle)).size).toBe(10);
        for (const slot of ['top', 'bottom', 'footwear'] as const)
            expect(new Set(appearances.map(a => a.equipment[slot].itemId))).toEqual(new Set(STARTER_ITEMS[slot].map(i => i.id)));
        expect(new Set(Array.from({ length: 100 }, (_, i) => crowdMotion('bounce', .9, i / 100, 10))).size).toBeGreaterThanOrEqual(5);
    });
    it('bakes articulated poses, preserves exact attendance and reconstructs phone lights and motion on seek', async () => {
        const library: ModelLibrary = new Map();
        for (const file of requiredModelFiles(crowdAppearances(42))) {
            const b = readFileSync(`public/gig-demo-3d/${file}`);
            library.set(file, (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '')).scene);
        }
        const scene = new T.Scene(), crowd = new DemoCrowd([...library.values()], scene, 42, undefined, library);
        const meshes = scene.children.filter((o): o is T.InstancedMesh => o instanceof T.InstancedMesh && o.name.startsWith('crowd-variant'));
        const phones = scene.getObjectByName('crowd-phone-screens') as T.InstancedMesh;
        for (const mesh of meshes) {
            const g = mesh.geometry;
            expect(Object.keys(g.attributes).length + 4).toBeLessThanOrEqual(16);
            expect(g.attributes.poseRaised.count).toBe(g.attributes.position.count);
            expect(Array.from(g.attributes.poseRaised.array)).not.toEqual(Array.from(g.attributes.position.array));
            expect(Array.from(g.attributes.poseClapClosed.array)).not.toEqual(Array.from(g.attributes.poseClapOpen.array));
        }
        for (const count of [0, 1, 2, 7, 15, 38, 81, 159, 160]) {
            crowd.update(10, count / 160, .8, false, {}, 'phone_lights');
            expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(count);
            expect(phones.count).toBeLessThanOrEqual(count);
        }
        const snapshot = () => meshes.map(m => ({ matrices: Array.from(m.instanceMatrix.array), motion: Array.from(m.geometry.attributes.crowdMotion.array) }));
        crowd.update(10, 1, .9, false, {}, 'phone_lights');
        expect(phones.count).toBeGreaterThan(0);
        expect(phones.count).toBeLessThan(160);
        const state = snapshot();
        crowd.update(90, 1, .9, false, {}, 'jump');
        expect(phones.count).toBe(0);
        expect(snapshot()).not.toEqual(state);
        crowd.update(10, 1, .9, false, {}, 'phone_lights');
        expect(snapshot()).toEqual(state);
        crowd.update(8, 1, .9, true, {}, 'bounce');
        const reduced = snapshot();
        crowd.update(88, 1, .9, true, {}, 'bounce');
        expect(snapshot()).toEqual(reduced);
        crowd.dispose();
        disposeModel(scene);
        library.forEach(disposeModel);
    });
});
