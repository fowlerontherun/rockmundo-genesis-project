import { describe, expect, it } from 'vitest';
import { referralUrlWithParams, withReferral } from './share';

describe('referral social attribution', () => {
  it('replaces existing referral and source values', () => {
    const url = new URL(withReferral('https://rockmundo.uk/auth?ref=OLD&source=old', 'rm123456', 'gig_share'));
    expect(url.searchParams.getAll('ref')).toEqual(['RM123456']);
    expect(url.searchParams.getAll('source')).toEqual(['gig_share']);
  });

  it('preserves unrelated tracking and the URL fragment', () => {
    const url = new URL(withReferral('https://rockmundo.uk/auth?utm_medium=social#signup', 'rm123456', 'referral_hub', 'october', 'avatar_card'));
    expect(url.searchParams.get('utm_medium')).toBe('social');
    expect(url.hash).toBe('#signup');
    expect(url.searchParams.get('campaign')).toBe('october');
    expect(url.searchParams.get('creative')).toBe('avatar_card');
  });

  it('builds band recruitment links through the shared referral helper', () => {
    const url = new URL(referralUrlWithParams('rm123456', { source: 'band_recruitment', band: 'band-42' }, 'https://rockmundo.uk'));
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('ref')).toBe('RM123456');
    expect(url.searchParams.get('source')).toBe('band_recruitment');
    expect(url.searchParams.get('band')).toBe('band-42');
  });
});
