import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AvatarV2PublicPreview } from './AvatarV2PublicPreview';

vi.mock('./AvatarV2ReferenceCanvas', () => ({
  AvatarV2ReferenceCanvas: ({ url, focus }: { url: string; focus: string }) => (
    <div data-testid="v2-preview-3d" data-url={url} data-focus={focus}>Actual unrigged Blender model</div>
  ),
}));

const FRAMES = ['masculine', 'feminine'] as const;
const VIEWS = ['front', 'quarter', 'side', 'face'] as const;
function sourceGallery() {
  const files: Array<{ file: string; bytes: number; sha256: string }> = [];
  const frames = FRAMES.map(frame => {
    const source = `${frame}/${frame}-SOURCE-ONLY-not-validated.glb`;
    const lookdev = `${frame}/${frame}-LOOKDEV-ONLY-not-validated.glb`;
    const sourceViews = Object.fromEntries(VIEWS.map(view => [view, `${frame}/${frame}-${view}.png`]));
    const lookdevViews = Object.fromEntries(VIEWS.map(view => [view, `${frame}/${frame}-lookdev-${view}.png`]));
    [source, lookdev, ...Object.values(sourceViews), ...Object.values(lookdevViews)].forEach(file =>
      files.push({ file, bytes: 4096, sha256: 'a'.repeat(64) }));
    return { frame, source, lookdev, sourceViews, lookdevViews };
  });
  return {
    schema: 'rockmundo.avatar-v2-reference-previews',
    version: 1,
    source: 'blender-human-base-meshes-v1.4.1',
    previewOnly: true,
    productionValidated: false,
    frames,
    files,
  };
}

describe('player-visible real Avatar V2 preview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => sourceGallery(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows genuine source and new lookdev proofs without loading 3D until requested', async () => {
    render(<AvatarV2PublicPreview frame="masculine" />);
    expect(await screen.findByText('See the real Avatar V2 progress')).toBeInTheDocument();
    const enhanced = screen.getByAltText('masculine improved V2 Blender lookdev front proof');
    expect(enhanced).toHaveAttribute('src', expect.stringContaining('masculine-lookdev-front.png'));
    expect(screen.getByAltText('masculine original CC0 body front proof'))
      .toHaveAttribute('src', expect.stringContaining('masculine-front.png'));
    expect(screen.queryByTestId('v2-preview-3d')).not.toBeInTheDocument();
    expect(screen.getByText(/live character and gig visuals remain on V1/)).toBeInTheDocument();
  });

  it('follows the avatar draft frame and permits source/lookdev and face inspection', async () => {
    const { rerender } = render(<AvatarV2PublicPreview frame="masculine" />);
    await screen.findByText('Improved V2 lookdev');
    fireEvent.click(screen.getByRole('button', { name: 'Face detail' }));
    rerender(<AvatarV2PublicPreview frame="feminine" />);
    expect(screen.getByAltText('feminine improved V2 Blender lookdev face proof'))
      .toHaveAttribute('src', expect.stringContaining('feminine-lookdev-face.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect actual V2 in interactive 3D' }));
    expect(await screen.findByTestId('v2-preview-3d'))
      .toHaveAttribute('data-url', expect.stringContaining('feminine-LOOKDEV-ONLY-not-validated.glb'));
    expect(screen.getByTestId('v2-preview-3d')).toHaveAttribute('data-focus', 'face');
    fireEvent.click(screen.getByRole('button', { name: 'Original source model' }));
    expect(await screen.findByTestId('v2-preview-3d'))
      .toHaveAttribute('data-url', expect.stringContaining('feminine-SOURCE-ONLY-not-validated.glb'));
    fireEvent.click(screen.getByRole('button', { name: 'Close interactive 3D' }));
    expect(screen.queryByTestId('v2-preview-3d')).not.toBeInTheDocument();
  });

  it('rejects a forged production claim rather than displaying misleading assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ ...sourceGallery(), productionValidated: true }),
    }));
    render(<AvatarV2PublicPreview frame="masculine" />);
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
    expect(screen.queryByAltText('masculine improved V2 Blender lookdev front proof')).not.toBeInTheDocument();
  });

  it('allows a failed proof fetch to retry safely', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValue({ ok: true, json: async () => sourceGallery() });
    vi.stubGlobal('fetch', fetcher);
    render(<AvatarV2PublicPreview frame="feminine" />);
    await screen.findByText(/could not be reached/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry genuine V2 preview' }));
    expect(await screen.findByAltText('feminine improved V2 Blender lookdev front proof')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
