import type { PerformanceSection, StageRole } from './liveTypes';

/** Named stage moves layered over each performer's base mark. */
export type StageMovePose = 'none' | 'roam' | 'face_off' | 'crowd_lean' | 'jump' | 'headbang' | 'lean_back' | 'spotlight_pose';

export interface StageMove {
    dx: number;
    dy: number;
    dz: number;
    yaw: number;
    pose: StageMovePose;
    /** 0-1 strength of the named pose for torso/head layering. */
    weight: number;
}

const still: StageMove = { dx: 0, dy: 0, dz: 0, yaw: 0, pose: 'none', weight: 0 };
const smooth = (v: number) => { const x = Math.min(1, Math.max(0, v)); return x * x * (3 - 2 * x); };
/** Window that eases in at `start` and out at `end` within a repeating cycle. */
const windowed = (clock: number, start: number, end: number, ease = .6) =>
    smooth((clock - start) / ease) * (1 - smooth((clock - end) / ease));

/**
 * Deterministic stage movement for one performer. Same inputs always give the
 * same move so replays, exports and broadcasts stay reproducible.
 */
export function stageMove(options: {
    role: StageRole;
    t: number;
    phase: number;
    section: PerformanceSection | undefined;
    sectionProgress: number;
    energy: number;
    stationary: boolean;
    /** Base stage x: negative is stage left of centre. */
    baseX: number;
    focused?: boolean;
}): StageMove {
    const { role, t, phase, section, energy, stationary, baseX } = options;
    if (energy <= 0 || role === 'fan') return still;
    const e = Math.min(1.2, energy);
    if (role === 'drums' || stationary) {
        // Seated players stay on their kit but bang heads in heavy sections.
        const heavy = section === 'breakdown' || section === 'chorus' ? 1 : 0;
        return { ...still, pose: heavy ? 'headbang' : 'none', weight: heavy * e * .8 };
    }
    const wide = section === 'chorus' ? 1.5 : section === 'breakdown' ? .6 : section === 'solo' ? .8 : 1;
    // Slow figure-of-eight wander around the mark: never more than ~40 cm.
    const roamX = (Math.sin(t * .23 + phase) * .26 + Math.sin(t * .11 + phase * 2.3) * .1) * wide * e;
    const roamZ = Math.sin(t * .46 + phase * 1.3) * .12 * wide * e;
    const move: StageMove = { dx: roamX, dy: 0, dz: roamZ, yaw: Math.sin(t * .23 + phase + Math.PI / 2) * .08 * e, pose: 'roam', weight: .4 * e };

    const cycle = ((t + phase * 3.1) % 24 + 24) % 24;
    if (role === 'vocals') {
        // Stride to the front edge and lean over the crowd.
        const lean = windowed(cycle, 6, 11) * (section === 'chorus' || section === 'outro' ? 1 : .5);
        if (lean > .01) return { ...move, dz: move.dz + .32 * lean * e, dx: move.dx * (1 - lean), pose: 'crowd_lean', weight: lean * e };
    }
    if (role === 'guitar' || role === 'bass') {
        if (section === 'solo' && options.focused) {
            return { ...move, dx: move.dx * .3, pose: 'lean_back', weight: smooth(options.sectionProgress / .15) * e };
        }
        // Guitar and bass turn in to face each other for a few bars.
        const faceOff = windowed(cycle, 14, 19);
        if (faceOff > .01) {
            const inward = baseX === 0 ? 0 : -Math.sign(baseX);
            return { ...move, dx: move.dx + inward * .22 * faceOff * e, yaw: move.yaw + inward * .55 * faceOff, pose: 'face_off', weight: faceOff * e };
        }
        if (section === 'breakdown') return { ...move, pose: 'headbang', weight: .9 * e };
    }
    // Chorus hits: a short jump on the big downbeat.
    if (section === 'chorus' && e > .75) {
        const hop = ((t + phase) % 8 + 8) % 8;
        if (hop < .45) {
            const arc = Math.sin((hop / .45) * Math.PI);
            return { ...move, dy: arc * .16 * e, pose: 'jump', weight: arc };
        }
    }
    if (section === 'outro' && options.sectionProgress > .85) {
        return { ...move, dx: move.dx * .2, dz: move.dz + .15, pose: 'spotlight_pose', weight: smooth((options.sectionProgress - .85) / .15) * e };
    }
    return move;
}
