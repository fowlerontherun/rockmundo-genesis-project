import { describe, expect, it } from 'vitest';
import { CLOTHING_TURNTABLE_VIEWS, createClothingPreviewManifest, usablePreviewFrames } from './previewManifest';

describe('clothing preview manifest', () => {
  it('defines a stable eight-angle turntable', () => {
    expect(CLOTHING_TURNTABLE_VIEWS).toHaveLength(8);
    expect(CLOTHING_TURNTABLE_VIEWS.map(view => view.yaw)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });

  it('uses the front frame as thumbnail and preserves view order', () => {
    const manifest = createClothingPreviewManifest('item-1', {
      front: 'https://cdn.example/front.webp',
      back: 'https://cdn.example/back.webp',
    }, '2026-09-10T16:50:00.000Z');
    expect(manifest.thumbnail).toBe('https://cdn.example/front.webp');
    expect(manifest.frames[0]).toMatchObject({ key: 'front', yaw: 0, url: 'https://cdn.example/front.webp' });
    expect(manifest.frames[4]).toMatchObject({ key: 'back', yaw: 180, url: 'https://cdn.example/back.webp' });
  });

  it('only exposes frames with http(s) asset URLs as usable fallbacks', () => {
    expect(usablePreviewFrames({ frames: [
      { key: 'front', yaw: 0, url: 'https://cdn.example/front.webp' },
      { key: 'back', yaw: 180 },
      { key: 'left', yaw: 270, url: 'javascript:alert(1)' },
    ] })).toHaveLength(1);
  });

  it('does not expose retained stale frames while a garment is pending regeneration', () => {
    expect(usablePreviewFrames({
      stale: true,
      frames: [{ key: 'front', yaw: 0, url: 'https://cdn.example/old-front.webp' }],
    })).toEqual([]);
  });
});
