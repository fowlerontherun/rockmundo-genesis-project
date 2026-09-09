// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { SKILL_TREE_DEFINITIONS } from '@/data/skillTree';
import { disposeModel } from '@/features/player-model/model';
import { STAGE_INSTRUMENTS, stageAssignment, type InstrumentId } from './instrumentCatalog';
import { Musician } from './performers';
const models: T.Object3D[] = [];
beforeAll(async () => { for (const name of ['casual', 'female-casual']) {
    const file = readFileSync(resolve(`public/gig-demo-3d/${name}.glb`));
    models.push((await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, '')).scene);
} });
describe('complete stage instrument coverage', () => {
    it('covers every instrument skill, tier, and displayed name', () => {
        const skills = SKILL_TREE_DEFINITIONS.filter(s => /^instruments_basic_/.test(s.slug));
        expect(skills).toHaveLength(98);
        expect(Object.keys(STAGE_INSTRUMENTS).sort()).toEqual(skills.map(s => s.slug.replace('instruments_basic_', '')).sort());
        for (const skill of skills) {
            const id = skill.slug.replace('instruments_basic_', '');
            for (const tier of ['basic', 'professional', 'mastery'])
                expect(stageAssignment(`instruments_${tier}_${id}`).instrument).toBe(id);
            expect(stageAssignment(skill.display_name ?? '').instrument).toBe(id);
        }
    });
    it.each(Object.keys(STAGE_INSTRUMENTS) as InstrumentId[])('%s has a finite stage model, reachable grips and stable replay poses on both frames', id => {
        for (const model of models) {
            const spec = STAGE_INSTRUMENTS[id], actor = new Musician(model, spec.role, [0, 0, 0], 0, undefined, undefined, id);
            const rig = actor.instrumentRig!;
            expect(rig.root.userData.instrumentId).toBe(id);
            const bounds = new T.Box3().setFromObject(rig.root);
            expect(bounds.isEmpty()).toBe(false);
            expect(bounds.getSize(new T.Vector3()).length()).toBeLessThan(4.5);
            for (const t of [0, 2.17, 18.4]) {
                actor.update(t, .8, false);
                for (const bone of actor.bones.values())
                    expect(bone.matrixWorld.elements.every(Number.isFinite)).toBe(true);
                for (const [side, grip] of [['L', rig.left], ['R', rig.right]] as const) {
                    if (spec.family === 'voice' && side === 'L')
                        continue;
                    const distance = actor.bones.get(`Hand.${side}`)!.getWorldPosition(new T.Vector3()).distanceTo(grip.getWorldPosition(new T.Vector3()));
                    expect(distance, `${id} ${model.name} ${side} grip error ${distance}`).toBeLessThan(.13);
                }
            }
            actor.update(2.17, .8, false);
            const pose = rig.right.getWorldPosition(new T.Vector3());
            actor.update(88, .8, false);
            actor.update(2.17, .8, false);
            expect(rig.right.getWorldPosition(new T.Vector3())).toEqual(pose);
            actor.update(4, .8, true);
            const still = actor.bones.get('Hand.R')!.matrixWorld.toArray();
            actor.update(9, .8, true);
            expect(actor.bones.get('Hand.R')!.matrixWorld.toArray()).toEqual(still);
            disposeModel(actor.root);
            if (actor.equipment)
                disposeModel(actor.equipment);
        }
    });
    it('retains combined instrument and vocal duties and safely handles unknown labels', () => {
        expect(stageAssignment('Bass Guitar / Backing Vocals')).toMatchObject({ instrument: 'bass_guitar', role: 'bass', vocal: 'backing' });
        expect(stageAssignment('Lead Vocals + Acoustic Guitar')).toMatchObject({ instrument: 'acoustic_guitar', role: 'guitar', vocal: 'lead' });
        expect(stageAssignment('Bassoon')).toMatchObject({ instrument: 'bassoon', role: 'woodwind' });
        expect(stageAssignment('unknown')).toMatchObject({ instrument: null, role: 'other' });
        const actor = new Musician(models[0], 'bass', [0, 0, 0], 0, undefined, undefined, 'bass_guitar', 'backing');
        expect(actor.equipment?.children.length).toBeGreaterThan(0);
        expect(actor.instrumentRig?.root.parent).toBe(actor.root);
    });
});
