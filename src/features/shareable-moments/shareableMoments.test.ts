import { describe, expect, it } from 'vitest';
import { SHARE_FORMATS, type ShareMoment } from './types';
import { referralUrl, withReferral } from './share';
import { shareFilename } from './canvas';

const moment: ShareMoment = { version: 1, type: 'achievement', headline: 'First Stadium!', createdAt: '2026-10-07T00:00:00Z' };

describe('shareable moments foundation', () => {
  it('defines canonical social formats', () => {
    expect(SHARE_FORMATS.square).toEqual({ width: 1080, height: 1080 });
    expect(SHARE_FORMATS.story).toEqual({ width: 1080, height: 1920 });
    expect(SHARE_FORMATS.landscape).toEqual({ width: 1200, height: 630 });
  });
  it('builds referral destinations using the existing auth contract', () => {
    expect(referralUrl(' ab12 ', 'https://rockmundo.uk')).toBe('https://rockmundo.uk/auth?ref=AB12');
    expect(withReferral('https://rockmundo.uk/song/1?x=y', 'abc')).toBe('https://rockmundo.uk/song/1?x=y&ref=ABC');
  });
  it('creates safe branded filenames', () => {
    expect(shareFilename(moment, 'story')).toBe('rockmundo-first-stadium-story.png');
  });
});
