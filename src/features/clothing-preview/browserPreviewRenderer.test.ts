import { describe, expect, it } from 'vitest';
import { CLOTHING_PREVIEW_BUCKET, clothingPreviewStoragePath } from './browserPreviewRenderer';
import { CLOTHING_PREVIEW_RENDERER_VERSION } from './previewManifest';

describe('browser clothing preview renderer', () => {
  it('stores generated WebP frames under an immutable job-scoped path', () => {
    expect(clothingPreviewStoragePath('item-123', 'job-456', 'front')).toBe(
      `item-123/${CLOTHING_PREVIEW_RENDERER_VERSION}/job-456/front.webp`,
    );
  });

  it('uses the dedicated public clothing preview bucket', () => {
    expect(CLOTHING_PREVIEW_BUCKET).toBe('clothing-previews');
  });
});
