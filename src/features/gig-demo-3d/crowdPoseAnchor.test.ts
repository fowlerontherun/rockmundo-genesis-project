import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { blendedCrowdHand, crowdPoseAnchor, type CrowdPoseAnchors } from './crowdPoseAnchor';

const poses: CrowdPoseAnchors = {
  idle: new T.Vector3(.3, .8, .1), raised: new T.Vector3(.25, 2, .15),
  clapOpen: new T.Vector3(.26, 1.35, .4), clapClosed: new T.Vector3(.035, 1.35, .44),
  danceLeft: new T.Vector3(.4, 1.2, .25), danceRight: new T.Vector3(.15, .9, .25),
  runLeft: new T.Vector3(.27, 1.14, .4), runRight: new T.Vector3(.27, 1.14, -.04),
};

describe('crowd phone attachment', () => {
  it('follows the raising hand instead of floating at the final raised pose', () => {
    const packed = (blend: number) => new Float32Array([5 + blend * .5, 16 * 102, 1, 1]);
    const hand = (blend: number) => {
      const values = packed(blend);
      return blendedCrowdHand(poses, values[0], values[1], values[2], values[3], 0);
    };
    expect(hand(0).y).toBeCloseTo(poses.idle.y);
    expect(hand(.5).y).toBeCloseTo((poses.idle.y + poses.raised.y) / 2);
    expect(hand(1)).toEqual(poses.raised);
  });
  it('follows the new clap pose while lowering a phone, with no mutated anchors', () => {
    const before = JSON.stringify(poses);
    const packed = new Float32Array([3 + 5 * 16 + .25, 16 * 255, 1, .8]);
    const sample = () => blendedCrowdHand(poses, packed[0], packed[1], packed[2], packed[3], 2);
    const expected = poses.raised.clone().lerp(crowdPoseAnchor(poses, 3, 2, packed[3]), .5);
    expect(sample().distanceTo(expected)).toBeLessThan(1e-6);
    crowdPoseAnchor(poses, 7, 90, .8);
    expect(sample().distanceTo(expected)).toBeLessThan(1e-6);
    expect(JSON.stringify(poses)).toBe(before);
  });
  it('has finite anchors for all supported animation modes', () => {
    for (let mode = 0; mode <= 9; mode++) {
      for (const phase of [0, .2, 5, 120]) expect(crowdPoseAnchor(poses, mode, phase, .7).toArray().every(Number.isFinite)).toBe(true);
    }
  });
});
