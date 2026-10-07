import { describe, expect, it, vi } from 'vitest';
import { captureAvatarCanvas } from './avatarCapture';

describe('avatar share capture', () => {
  it('captures the canonical renderer without owning avatar rendering', () => {
    const source = { width: 800, height: 1000, toDataURL: vi.fn(() => 'data:image/png;base64,abc') } as unknown as HTMLCanvasElement;
    expect(captureAvatarCanvas(source)).toEqual({ dataUrl: 'data:image/png;base64,abc', width: 800, height: 1000 });
    expect(source.toDataURL).toHaveBeenCalledWith('image/png');
  });
});
