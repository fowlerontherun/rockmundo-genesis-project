import { describe, expect, it } from 'vitest';
import { curatedGarmentShape } from './curatedDonorGarments';

const item = (category: string, name: string, shape?: string) => ({
  category, name, render_config: { curatedSource: { kind: 'avatar-part', shape } },
}) as any;

describe('curated garment base shapes', () => {
  it('a t-shirt gets the short-sleeve tee shape', () => {
    expect(curatedGarmentShape(item('t-shirt', 'Mod Stripe Tee'), 'body')).toBe('tee');
  });
  it('jeans get full-length trousers, not shorts', () => {
    expect(curatedGarmentShape(item('jeans', 'Baggy Stonewash Jeans'), 'legs')).toBe('trousers');
  });
  it('shorts stay shorts', () => {
    expect(curatedGarmentShape(item('shorts', 'Denim Shorts'), 'legs')).toBe('shorts');
  });
  it('jackets are not trimmed into tees', () => {
    expect(curatedGarmentShape(item('jacket', 'Terrace Parka'), 'body')).toBe('outerwear');
  });
  it('an explicit shape overrides the guess', () => {
    expect(curatedGarmentShape(item('t-shirt', 'Long tee', 'as-is'), 'body')).toBe('as-is');
  });
});
