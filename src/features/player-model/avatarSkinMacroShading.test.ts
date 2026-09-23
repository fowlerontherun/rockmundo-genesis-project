import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from './appearance';
import { applyAvatarSkinMacroShading } from './avatarSkinMacroShading';

describe('avatar skin macro shading', () => {
  it('adds subtle face colour variation without moving geometry', () => {
    const appearance = defaultAppearance('face-shading');
    const geometry = new T.SphereGeometry(.3, 24, 16);
    const before = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
    applyAvatarSkinMacroShading(geometry, 'head', appearance, 'ultra');
    const after = Array.from(geometry.getAttribute('position').array as ArrayLike<number>);
    expect(after).toEqual(before);
    const colors = geometry.getAttribute('color') as T.BufferAttribute;
    expect(colors).toBeTruthy();
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < colors.count; i++) {
      min = Math.min(min, colors.getX(i), colors.getY(i), colors.getZ(i));
      max = Math.max(max, colors.getX(i), colors.getY(i), colors.getZ(i));
    }
    expect(max - min).toBeGreaterThan(.01);
  });

  it('skips extra colour work for crowd avatars', () => {
    const appearance = defaultAppearance('crowd-shading');
    const geometry = new T.SphereGeometry(.3, 12, 8);
    applyAvatarSkinMacroShading(geometry, 'head', appearance, 'crowd');
    expect(geometry.getAttribute('color')).toBeUndefined();
  });
});
