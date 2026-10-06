import { expect, it } from 'vitest';
import * as T from 'three';
import { clothingPatternTexture, twoToneUVs } from './clothingPatterns';
import { appearanceSchema, CLOTHING_PATTERNS, defaultAppearance } from './appearance';

it.each(CLOTHING_PATTERNS)('renders %s with exact user-selected colours', pattern => {
  const map = clothingPatternTexture(pattern, '#ff0000', '#00ff00');
  const pixels = map.image.data;
  const colours = new Set<string>();
  for (let i = 0; i < pixels.length; i += 4) colours.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
  expect(colours).toEqual(new Set(pattern === 'solid' ? ['255,0,0'] : ['255,0,0','0,255,0']));
  map.dispose();
});
it('round-trips styles and rejects invalid patterns and colours', () => {
  const avatar = defaultAppearance();
  avatar.equipment.top.pattern = 'checks'; avatar.equipment.top.secondaryColor = '#ed4495';
  expect(appearanceSchema.parse(JSON.parse(JSON.stringify(avatar)))).toEqual(avatar);
  expect(appearanceSchema.safeParse({ ...avatar, equipment: { ...avatar.equipment, top: { ...avatar.equipment.top, pattern: 'unknown' } } }).success).toBe(false);
  expect(appearanceSchema.safeParse({ ...avatar, equipment: { ...avatar.equipment, top: { ...avatar.equipment.top, secondaryColor: 'bad' } } }).success).toBe(false);
});

it('keeps two-tone colours aligned across body and attached details using shared bounds', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 2, 0], 3));
  twoToneUVs(geometry, new T.Matrix4(), false, { low: 0, high: 2 });
  const uv = geometry.getAttribute('uv');
  // Texture's first half is the primary colour: it belongs at the top.
  expect(uv.getY(2)).toBeLessThan(.01);
  expect(uv.getY(0)).toBeGreaterThan(.99);
  expect(uv.getY(1)).toBeCloseTo(.5);
  const detail = new T.BufferGeometry();
  detail.setAttribute('position', new T.Float32BufferAttribute([0, 1, 0, 0, 3, 0], 3));
  twoToneUVs(detail, new T.Matrix4(), false, { low: 0, high: 2 });
  expect(detail.getAttribute('uv').getY(0)).toBeCloseTo(uv.getY(1));
  expect(detail.getAttribute('uv').getY(1)).toBeGreaterThan(0);
  geometry.dispose(); detail.dispose();
});
