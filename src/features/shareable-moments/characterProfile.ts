import type { AvatarCapture } from './avatarCapture';
import { loadCaptureImage } from './avatarCapture';
import { SHARE_FORMATS, type ShareFormat, type ShareMoment } from './types';
import { renderShareMoment } from './canvas';

export interface CharacterProfileShareMoment extends ShareMoment {
  type: 'character_profile';
  avatar?: AvatarCapture | null;
}

export async function renderCharacterProfileCard(
  canvas: HTMLCanvasElement,
  moment: CharacterProfileShareMoment,
  format: ShareFormat,
): Promise<void> {
  renderShareMoment(canvas, moment, format);
  if (!moment.avatar) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    const image = await loadCaptureImage(moment.avatar);
    const { width, height } = SHARE_FORMATS[format];
    const maxW = format === 'landscape' ? width * .38 : width * .64;
    const maxH = format === 'story' ? height * .5 : height * .52;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale, drawH = image.height * scale;
    const x = format === 'landscape' ? width - drawW - width * .05 : width - drawW - width * .04;
    const y = format === 'story' ? height * .38 : height - drawH - height * .06;
    ctx.drawImage(image, x, y, drawW, drawH);
  } catch {
    // The branded base card remains usable if WebGL capture cannot be decoded.
  }
}
