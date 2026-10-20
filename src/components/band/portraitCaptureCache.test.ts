import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/features/player-model/appearance';
const capture = vi.hoisted(() => vi.fn());
vi.mock('@/features/shareable-moments/avatarCapture', () => ({ captureAvatarV1ForShare: capture }));
beforeEach(() => { vi.resetModules(); capture.mockReset(); });
describe('portrait render queue', () => {
  it('serialises rendering and reuses an unchanged appearance', async () => {
    const { portraitCapture } = await import('./portraitCaptureCache');
    let finish: ((canvas: unknown) => void) | undefined;
    capture.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const visual = { appearance: defaultAppearance() };
    const first = portraitCapture(visual, () => false);
    const second = portraitCapture(visual, () => false);
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    finish!({ toDataURL: () => 'portrait-1' });
    expect(await first).toBe('portrait-1');
    expect(await second).toBe('portrait-1');
    expect(capture).toHaveBeenCalledTimes(1);
  });
  it('renders again when the outfit changes', async () => {
    const { portraitCapture } = await import('./portraitCaptureCache');
    capture.mockResolvedValue({ toDataURL: () => 'portrait' });
    const appearance = defaultAppearance();
    await portraitCapture({ appearance }, () => false);
    appearance.equipment.top.color = '#ff0000';
    await portraitCapture({ appearance }, () => false);
    expect(capture).toHaveBeenCalledTimes(2);
  });
  it('skips cancelled work without allocating a renderer', async () => {
    const { portraitCapture } = await import('./portraitCaptureCache');
    expect(await portraitCapture({ appearance: defaultAppearance() }, () => true)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });
});
