import { describe, expect, it } from 'vitest';
import { avatarQualityProfile } from './avatarVisualQuality';

describe('avatar visual quality profiles', () => {
  it('raises texture/shadow quality progressively without affecting crowd cost', () => {
    const crowd = avatarQualityProfile('crowd');
    const high = avatarQualityProfile('high');
    const ultra = avatarQualityProfile('ultra');
    expect(crowd.textureSize).toBe(0);
    expect(high.textureSize).toBeGreaterThan(crowd.textureSize);
    expect(ultra.textureSize).toBeGreaterThanOrEqual(1024);
    expect(ultra.shadowMapSize).toBeGreaterThan(high.shadowMapSize);
    expect(ultra.previewPixelRatioCap).toBeGreaterThan(high.previewPixelRatioCap);
  });
});
