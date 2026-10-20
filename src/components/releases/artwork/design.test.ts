import { describe, expect, it } from 'vitest';
import { newArtworkDesign, parseArtworkDesign } from './design';

describe('portable artwork designs', () => {
  it('round trips all editable properties without executing player text', () => {
    const design = { ...newArtworkDesign('<script>alert(1)</script>', 'War Dogs'), vinylStyle: 'splatter' as const, pattern: 'circles' as const };
    expect(parseArtworkDesign(JSON.stringify(design))).toEqual(design);
  });
  it.each([{ version: 2 }, { background: 'url(https://example.com)' }, { title: 'x'.repeat(101) }, { font: 'anything' }, { pattern: 'bad' }, { vinylStyle: 'unknown' }, { vinylColour: 'red' }])('rejects malformed design properties %j', patch => {
    expect(() => parseArtworkDesign(JSON.stringify({ ...newArtworkDesign(), ...patch }))).toThrow();
  });
  it('rejects null and strips unrecognised fields', () => {
    expect(() => parseArtworkDesign('null')).toThrow();
    expect(parseArtworkDesign(JSON.stringify({ ...newArtworkDesign(), remoteImage: 'https://example.com' }))).not.toHaveProperty('remoteImage');
  });
});
