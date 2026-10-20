import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArtworkAttachment, getCreatedReleaseSummary } from './attachArtwork';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), readSingle: vi.fn(), single: vi.fn(), update: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: () => ({ data: { publicUrl: '/uploaded-art.png' } }) }) },
  from: mocks.from,
} }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.single.mockResolvedValue({ data: { id: 'release-1' }, error: null });
  mocks.from.mockReturnValue({ update: mocks.update, select: () => ({ eq: () => ({ single: mocks.readSingle }) }) });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: () => ({ single: mocks.single }) });
});
const file = new File(['png'], 'cover.png', { type: 'image/png' });
describe('artwork-only recovery', () => {
  it('attaches to the specified existing release', async () => {
    await createArtworkAttachment('release-1', file)();
    expect(mocks.from).toHaveBeenCalledWith('releases');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'release-1');
    expect(mocks.update).toHaveBeenCalledWith({ artwork_url: '/uploaded-art.png' });
  });
  it('retries a failed upload without trying to attach an absent file', async () => {
    mocks.upload.mockResolvedValueOnce({ error: new Error('Storage unavailable') });
    const retry = createArtworkAttachment('release-1', file);
    await expect(retry()).rejects.toThrow('Storage unavailable');
    expect(mocks.update).not.toHaveBeenCalled();
    await retry();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it('reuses the uploaded file when the database attachment fails', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: new Error('Update denied') });
    const retry = createArtworkAttachment('release-1', file);
    await expect(retry()).rejects.toThrow('Update denied');
    await retry();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it('rejects an unconfirmed update', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(createArtworkAttachment('release-1', file)()).rejects.toThrow('not confirmed');
  });
  it('coalesces concurrent retries', async () => {
    const retry = createArtworkAttachment('release-1', file);
    const first = retry();
    expect(retry()).toBe(first);
    await first;
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});

describe('post-creation refresh', () => {
  it('keeps the committed release ID if the read fails', async () => {
    mocks.readSingle.mockResolvedValueOnce({ data: null, error: new Error('Read denied') });
    await expect(getCreatedReleaseSummary('release-1')).resolves.toEqual({ id: 'release-1', manufacturing_complete_at: null, scheduled_release_date: null });
    mocks.readSingle.mockRejectedValueOnce(new Error('Offline'));
    await expect(getCreatedReleaseSummary('release-1')).resolves.toHaveProperty('id', 'release-1');
  });
  it('uses the confirmed schedule when available', async () => {
    const row = { id: 'release-1', manufacturing_complete_at: '2026-11-01T10:00:00Z', scheduled_release_date: null };
    mocks.readSingle.mockResolvedValueOnce({ data: row, error: null });
    await expect(getCreatedReleaseSummary('release-1')).resolves.toEqual(row);
  });
});
