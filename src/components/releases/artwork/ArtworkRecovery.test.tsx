import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ArtworkRecovery } from './ArtworkRecovery';
import { downloadArtworkFile, newArtworkDesign } from './design';
vi.mock('./design', async original => ({ ...await original<typeof import('./design')>(), downloadArtworkFile: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
const recovery = () => ({ releaseId: 'release-1', title: 'Night Shift', profileId: 'profile-1', file: new File(['png'], 'cover.png'), draft: { design: newArtworkDesign('Night Shift'), surface: 'cover' as const }, error: 'Upload failed', retry: vi.fn().mockResolvedValue(undefined) });
it('keeps files downloadable after another attachment failure', async () => {
  const r = recovery(); r.retry.mockRejectedValue(new Error('Still offline'));
  const saved = vi.fn();
  render(<ArtworkRecovery recovery={r} onSaved={saved} onFinish={vi.fn()} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry artwork attachment' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Still offline'));
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Download artwork' }));
  expect(downloadArtworkFile).toHaveBeenCalledWith(r.file, 'cover.png');
  expect(screen.getByRole('button', { name: 'Download editable design' })).toBeEnabled();
});
it('finishes only after a successful attachment and reports busy state', async () => {
  const saved = vi.fn(), busy = vi.fn();
  render(<ArtworkRecovery recovery={recovery()} onSaved={saved} onFinish={vi.fn()} onBusyChange={busy} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry artwork attachment' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(busy.mock.calls).toEqual([[true], [false]]);
});
it('prevents retry for another active character but permits backup download', () => {
  const r = recovery();
  render(<ArtworkRecovery recovery={r} disabled onSaved={vi.fn()} onFinish={vi.fn()} onBusyChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Retry artwork attachment' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download artwork' })).toBeEnabled();
});
