import type { ShareMoment } from './types';

/**
 * Rehydrate a missing avatar only for the player's own share cards.
 * Public band posters can be saved by spectators, so their missing
 * portrait must not be replaced with the viewer's character.
 */
export function shouldCaptureGalleryAvatar(moment: ShareMoment | null, primaryBandId: string | null | undefined): boolean {
  if (!moment) return false;

  if (moment.type === 'band_profile') {
    if (moment.avatar) return true; // Historical captured portrait stays frozen.
    const savedBandId = moment.id?.replace(/^promo:/, '') ?? null;
    return Boolean(primaryBandId && savedBandId === primaryBandId);
  }

  return ['character_profile', 'gig_result', 'achievement', 'tour', 'release', 'chart'].includes(moment.type);
}
