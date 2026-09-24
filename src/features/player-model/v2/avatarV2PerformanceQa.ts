import * as T from 'three';
import type { Musician } from '@/features/gig-demo-3d/performers';
import { handContactPoint } from '@/features/gig-demo-3d/instrumentHandPose';

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
  maxFingerContactError: number | null;
  drumsticks: number;
  guitarPicks: number;
  issues: AvatarV2PerformanceQaIssue[];
}

const SAMPLE_TIMES = [0, .35, .8, 1.4, 2.2, 3.1];
const HAND_LIMIT = .14;
const STICK_LIMIT = .14;
const FINGER_CONTACT_LIMIT = .20;

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
      maxFingerContactError: null,
      drumsticks: 0,
      guitarPicks: 0,
      issues: [{ code: 'missing-instrument-rig', message: 'The performance preset did not create an instrument rig.' }],
    };
  }

  const needsLeft = preset !== 'vocals';
  if (needsLeft && !left) issues.push({ code: 'missing-left-hand', message: 'The normalized V2 rig is missing Hand.L.' });
  if (!right) issues.push({ code: 'missing-right-hand', message: 'The normalized V2 rig is missing Hand.R.' });

  let maxLeft = 0;
  let maxRight = 0;
  let maxStick = 0;
  let maxFinger = 0;
  let fingerSamples = 0;
  const sticks = preset === 'rock_drums'
    ? rig.tools.filter(tool => /^playing-stick(?:-|$)/.test(tool.name))
    : [];
  const guitarPicks = preset === 'electric_guitar'
    ? actor.root.getObjectsByProperty('name', 'playing-guitar-pick').length
    : 0;

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

    const contactSamples: Array<[T.Vector3 | null, T.Object3D]> = [];
    if (preset === 'electric_guitar' || preset === 'bass_guitar') {
      contactSamples.push(
        [handContactPoint(actor.bones, 'L', ['Index', 'Middle', 'Ring', 'Pinky']), rig.left],
        [handContactPoint(actor.bones, 'R', preset === 'bass_guitar' ? ['Index', 'Middle'] : ['Thumb', 'Index']), rig.right],
      );
    } else if (preset === 'vocals') {
      contactSamples.push([
        handContactPoint(actor.bones, 'R', ['Thumb', 'Index', 'Middle', 'Ring']),
        rig.right,
      ]);
    }
    for (const [contact, target] of contactSamples) {
      if (!contact) continue;
      const distance = contact.distanceTo(target.getWorldPosition(new T.Vector3()));
      if (Number.isFinite(distance)) {
        maxFinger = Math.max(maxFinger, distance);
        fingerSamples += 1;
      } else {
        issues.push({ code: 'invalid-finger-contact', message: 'Finger contact distance became non-finite.' });
      }
    }

    if (preset === 'rock_drums' && sticks.length >= 2 && left && right) {
      const hands = [left, right] as const;
      for (let index = 0; index < 2; index++) {
        const stickWorld = sticks[index].getWorldPosition(new T.Vector3());
        const distance = stickWorld.distanceTo(hands[index].getWorldPosition(new T.Vector3()));
        if (Number.isFinite(distance)) maxStick = Math.max(maxStick, distance);
        else issues.push({ code: `invalid-drumstick-${index}`, message: 'A drumstick produced an invalid transform.' });

        const side = index === 0 ? 'L' : 'R';
        const fingerGrip = handContactPoint(actor.bones, side, ['Thumb', 'Index']);
        if (fingerGrip) {
          const fingerDistance = fingerGrip.distanceTo(stickWorld);
          if (Number.isFinite(fingerDistance)) {
            maxFinger = Math.max(maxFinger, fingerDistance);
            fingerSamples += 1;
          }
        }
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

  if (preset === 'electric_guitar' && guitarPicks < 1) {
    issues.push({ code: 'missing-guitar-pick', message: 'Guitar performance should expose a visible pick between the thumb and index finger.' });
  }
  if (fingerSamples === 0) {
    issues.push({ code: 'missing-finger-contact', message: 'No usable finger contact chain was found for this close-up performance.' });
  } else if (maxFinger > FINGER_CONTACT_LIMIT) {
    issues.push({
      code: 'finger-contact-clearance',
      message: `Finger contact drift reached ${maxFinger.toFixed(3)}m; target is ≤ ${FINGER_CONTACT_LIMIT.toFixed(2)}m.`,
    });
  }

  const uniqueIssues = [...new Map(issues.map(issue => [issue.code, issue])).values()];
  return {
    valid: uniqueIssues.length === 0,
    preset,
    maxLeftGripError: needsLeft && left ? maxLeft : null,
    maxRightGripError: right ? maxRight : null,
    maxDrumstickError: preset === 'rock_drums' && sticks.length >= 2 && left && right ? maxStick : null,
    maxFingerContactError: fingerSamples ? maxFinger : null,
    drumsticks: sticks.length,
    guitarPicks,
    issues: uniqueIssues,
  };
}
