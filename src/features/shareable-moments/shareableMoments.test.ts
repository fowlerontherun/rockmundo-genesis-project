import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARE_FORMATS, type ShareMoment } from './types';
import { canShareFile, nativeShare, referralUrl, withReferral } from './share';
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
    expect(withReferral('https://rockmundo.uk/auth', 'rm123456', 'referral_hub', 'creator_october', 'short_video_hook1')).toBe('https://rockmundo.uk/auth?ref=RM123456&source=referral_hub&campaign=creator_october&creative=short_video_hook1');
  });
  it('creates safe branded filenames', () => {
    expect(shareFilename(moment, 'story')).toBe('rockmundo-first-stadium-story.png');
  });
});

describe('mobile referral artwork sharing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('includes the referral link in the text accompanying a shared image', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const file = new File(['png'], 'rockmundo.png', { type: 'image/png' });
    expect(await nativeShare({ title: 'Join RockMundo', text: 'Join my band', url: 'https://rockmundo.uk/auth?ref=RM123456', file })).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Join RockMundo',
      text: 'Join my band\\nhttps://rockmundo.uk/auth?ref=RM123456',
      files: [file],
    });
  });

  it('shares the URL without the image when canShare throws', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => { throw new Error('Unsupported'); } });
    const file = new File(['png'], 'rockmundo.png', { type: 'image/png' });
    expect(canShareFile(file)).toBe(false);
    expect(await nativeShare({ title: 'Join', text: 'Play', url: 'https://rockmundo.uk/auth?ref=RM123456', file })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Join', text: 'Play', url: 'https://rockmundo.uk/auth?ref=RM123456' });
  });

  it('returns cancelled when the user dismisses native sharing', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue({ name: 'AbortError' }) });
    expect(await nativeShare({ title: 'Join', text: 'Play', url: 'https://rockmundo.uk/auth?ref=RM123456' })).toBe('cancelled');
  });
});
