import { describe, expect, it } from 'vitest';
import { stageMove } from './stageMoves';

const base = { phase: .7, sectionProgress: .5, energy: 1, stationary: false, baseX: -1.2 } as const;

describe('stage moves', () => {
    it('is deterministic and keeps roaming within a small area of the mark', () => {
        for (let t = 0; t < 120; t += .37) {
            const a = stageMove({ ...base, role: 'guitar', t, section: 'chorus' });
            expect(a).toEqual(stageMove({ ...base, role: 'guitar', t, section: 'chorus' }));
            expect(Math.abs(a.dx)).toBeLessThan(.75);
            expect(Math.abs(a.dz)).toBeLessThan(.6);
            expect(a.dy).toBeGreaterThanOrEqual(0);
            expect(a.dy).toBeLessThan(.25);
        }
    });

    it('uses a varied set of moves across a show', () => {
        const poses = new Set<string>();
        for (const role of ['vocals', 'guitar', 'bass', 'drums'] as const)
            for (const section of ['verse', 'chorus', 'breakdown', 'solo', 'outro'] as const)
                for (let t = 0; t < 60; t += .2)
                    poses.add(stageMove({ ...base, role, t, section, focused: true, sectionProgress: (t % 10) / 10, stationary: role === 'drums' }).pose);
        for (const pose of ['roam', 'face_off', 'crowd_lean', 'jump', 'headbang', 'lean_back', 'spotlight_pose'])
            expect(poses.has(pose), pose).toBe(true);
    });

    it('keeps drummers and stationary players on their marks and stops without energy', () => {
        for (let t = 0; t < 30; t += .5) {
            const drum = stageMove({ ...base, role: 'drums', t, section: 'chorus', stationary: true });
            expect([drum.dx, drum.dy, drum.dz, drum.yaw]).toEqual([0, 0, 0, 0]);
        }
        expect(stageMove({ ...base, role: 'vocals', t: 3, section: 'chorus', energy: 0 }).pose).toBe('none');
    });

    it('turns guitar and bass inward toward the centre during a face-off', () => {
        for (let t = 0; t < 48; t += .1) {
            const left = stageMove({ ...base, role: 'bass', t, section: 'verse', baseX: -1.4 });
            if (left.pose === 'face_off' && left.weight > .5) expect(left.yaw).toBeGreaterThan(0);
        }
    });
});
