import * as T from 'three';
import type { Musician } from '@/features/gig-demo-3d/performers';

export type AvatarV2PerformancePreset =
  | 'backstage'
  | 'vocals'
  | 'electric_guitar'
  | 'bass_guitar'
  | 'rock_drums';

export interface AvatarV2PerformanceQaIssue {
  code: string;
  message: string;
}

export interface AvatarV2PerformanceQaReport {
  valid: boolean;
  preset: AvatarV2PerformancePreset;
  maxLeftGripError: number | null;
  maxRightGripError: number | null;
  maxDrumstickError: number | null;
  drumsticks: number;
  issues: AvatarV2PerformanceQaIssue[];
}

const SAMPLE_TIMES = [0, .35, .8, 1.4, 2.2, 3.1];
const HAND_LIMIT = .14;
const STICK_LIMIT = .14;

const finiteWorldMatrix = (object: T.Object3D) =>
  object.matrixWorld.elements.every(Number.isFinite);

export function inspectAvatarV2Performance(
  actor: Musician,
  preset: AvatarV2PerformancePreset,
): AvatarV2PerformanceQaReport | null {
  if (preset === 'backstage') return null;

  const issues: AvatarV2PerformanceQaIssue[] = [];
  const left = actor.bones.get('Hand.L');
  const right = actor.bones.get('Hand.R');
  const rig = actor.instrumentRig;

  if (!rig) {
    return {
      valid: false,
      preset,
      maxLeftGripError: null,
      maxRightGripError: null,
      maxDrumstickError: null,
      drumsticks: 0,
      issues: [{ code: 'missing-instrument-rig', message: 'The performance preset did not create an instrument rig.' }],
    };
  }

  const needsLeft = preset !== 'vocals';
  if (needsLeft && !left) issues.push({ code: 'missing-left-hand', message: 'The normalized V2 rig is missing Hand.L.' });
  if (!right) issues.push({ code: 'missing-right-hand', message: 'The normalized V2 rig is missing Hand.R.' });

  let maxLeft = 0;
  let maxRight = 0;
  let maxStick = 0;
  const sticks = preset === 'rock_drums'
    ? rig.tools.filter(tool => /^playing-stick(?:-|$)/.test(tool.name))
    : [];

  for (const seconds of SAMPLE_TIMES) {
    actor.update(seconds, .82, false);
    actor.root.updateMatrixWorld(true);
    actor.equipment?.updateMatrixWorld(true);

    for (const [name, bone] of actor.bones) {
      if (!finiteWorldMatrix(bone)) {
        issues.push({ code: `non-finite-bone:${name}`, message: `${name} produced an invalid world transform during the performance test.` });
        break;
      }
    }

    if (needsLeft && left) {
      const distance = left.getWorldPosition(new T.Vector3())
        .distanceTo(rig.left.getWorldPosition(new T.Vector3()));
      if (Number.isFinite(distance)) maxLeft = Math.max(maxLeft, distance);
      else issues.push({ code: 'invalid-left-grip', message: 'Left-hand grip distance became non-finite.' });
    }

    if (right) {
      const distance = right.getWorldPosition(new T.Vector3())
        .distanceTo(rig.right.getWorldPosition(new T.Vector3()));
      if (Number.isFinite(distance)) maxRight = Math.max(maxRight, distance);
      else issues.push({ code: 'invalid-right-grip', message: 'Right-hand grip distance became non-finite.' });
    }

    if (preset === 'rock_drums' && sticks.length >= 2 && left && right) {
      const hands = [left, right] as const;
      for (let index = 0; index < 2; index++) {
        const distance = sticks[index].getWorldPosition(new T.Vector3())
          .distanceTo(hands[index].getWorldPosition(new T.Vector3()));
        if (Number.isFinite(distance)) maxStick = Math.max(maxStick, distance);
        else issues.push({ code: `invalid-drumstick-${index}`, message: 'A drumstick produced an invalid transform.' });
      }
    }
  }

  if (needsLeft && left && maxLeft > HAND_LIMIT) {
    issues.push({
      code: 'left-grip-clearance',
      message: `Left-hand grip drift reached ${maxLeft.toFixed(3)}m; target is ≤ ${HAND_LIMIT.toFixed(2)}m.`,
    });
  }
  if (right && maxRight > HAND_LIMIT) {
    issues.push({
      code: 'right-grip-clearance',
      message: `Right-hand grip drift reached ${maxRight.toFixed(3)}m; target is ≤ ${HAND_LIMIT.toFixed(2)}m.`,
    });
  }

  if (preset === 'rock_drums') {
    if (sticks.length < 2) {
      issues.push({ code: 'missing-drumsticks', message: 'The drum rig must expose two visible playing-stick tools.' });
    } else if (left && right && maxStick > STICK_LIMIT) {
      issues.push({
        code: 'drumstick-hand-clearance',
        message: `Drumstick hand drift reached ${maxStick.toFixed(3)}m; target is ≤ ${STICK_LIMIT.toFixed(2)}m.`,
      });
    }
  }

  const uniqueIssues = [...new Map(issues.map(issue => [issue.code, issue])).values()];
  return {
    valid: uniqueIssues.length === 0,
    preset,
    maxLeftGripError: needsLeft && left ? maxLeft : null,
    maxRightGripError: right ? maxRight : null,
    maxDrumstickError: preset === 'rock_drums' && sticks.length >= 2 && left && right ? maxStick : null,
    drumsticks: sticks.length,
    issues: uniqueIssues,
  };
}
