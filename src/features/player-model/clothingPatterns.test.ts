import { expect, it } from 'vitest';
import { clothingPatternTexture } from './clothingPatterns';
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
