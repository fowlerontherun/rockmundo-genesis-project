import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

function headMotionGallery() {
  const original = sourceGallery();
  return {
    ...original,
    frames: original.frames.map(entry => {
      const headMotion = `${entry.frame}/${entry.frame}-HEAD-RIG-EXPERIMENT-not-validated.glb`;
      const headMotionViews = Object.fromEntries(VIEWS.map(view => [
        view, `${entry.frame}/${entry.frame}-head-rig-experiment-${view}.png`,
      ]));
      [headMotion, ...Object.values(headMotionViews)].forEach(file =>
        original.files.push({ file, bytes: 4096, sha256: 'b'.repeat(64) }));
      return {
        ...entry,
        headMotion,
        headMotionViews,
        headMotionEvidence: {
          schema: 'rockmundo.avatar-v2-head-rig-experiment', version: 1,
          frame: entry.frame, headTurnDegrees: 16, eyeCounterTurnDegrees: -7,
          headMeanDisplacementMm: 27., torsoMeanDisplacementMm: 0.,
          eyeMeanDisplacementMm: { L: 17.9, R: 18.1 },
          gltfJointCount: 62, gltfSkinnedPrimitives: 18,
          actualSkinBuffers: true, draftWeightsOnly: true,
          guideHeadPivotStillUnfitted: true, artistReviewed: false,
          fullBodySkinned: false, faceMorphsAuthored: false, productionValidated: false,
        },
      };
    }),
  };
}

function actualStarterGallery() {
  const base = sourceGallery();
  const styles = {
    'logo-tee': 'clothing.starter.logo-tee',
    'plain-black-tee': 'clothing.starter.plain-black-tee',
    'plain-white-tee': 'clothing.starter.plain-white-tee',
    'vintage-charcoal-tee': 'clothing.starter.vintage-charcoal-tee',
  } as const;
  return {
    ...base,
    frames: base.frames.map(frame => ({
      ...frame,
      starterTees: Object.entries(styles).map(([style, catalogueKey]) => {
        const preview = `${frame.frame}/${frame.frame}-starter-${style}-LOOKDEV-ONLY-not-validated.glb`;
        const views = {
          front: `${frame.frame}/${frame.frame}-starter-${style}-front.png`,
          quarter: `${frame.frame}/${frame.frame}-starter-${style}-quarter.png`,
        };
        [preview, ...Object.values(views)].forEach(file =>
          base.files.push({ file, bytes: 4096, sha256: 'c'.repeat(64) }));
        return {
          style, catalogueKey, preview, views,
          evidence: {
            sourceSurfaceVertices: 1300, sourceSelectedFaces: 1450, averageOffsetMm: 14,
            smoothedRealBoundaryVertices: 124, smoothingReprojectedOnOriginalCC0: true,
            postSmoothingBoundaryClearanceMm: 14,
            actualOriginalCC0SourceSurface: true,
            gltfConformingOriginalLogo: style === 'logo-tee',
            gltfRealSurfaceHems: true,
            realGarmentArtistApproved: false,
            requiresManualFullBodyRigAndGarmentWeighting: true,
            productionValidated: false,
          },
        };
      }),
    })),
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

  it('shows actual Blender head/eye movement and can inspect the deliberately unfinished skinned GLB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => headMotionGallery(),
    }));
    render(<AvatarV2PublicPreview frame="masculine" />);
    const img = await screen.findByAltText('masculine actual V2 Blender head and eye deformation experiment front proof');
    expect(img).toHaveAttribute('src', expect.stringContaining('masculine-head-rig-experiment-front.png'));
    expect(screen.getByText(/27.0 mm/)).toBeInTheDocument();
    expect(screen.queryByTestId('v2-preview-3d')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect the experimental skinned mesh in 3D' }));
    expect(await screen.findByTestId('v2-preview-3d'))
      .toHaveAttribute('data-url', expect.stringContaining('masculine-HEAD-RIG-EXPERIMENT-not-validated.glb'));
    expect(screen.getByText(/full rigging, facial animation, clothing and LOD validation/)).toBeInTheDocument();
  });

  it('shows all FOUR original source-fitted Starter wardrobe tees and never loads outfit 3D without a click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => actualStarterGallery(),
    }));
    render(<AvatarV2PublicPreview frame="feminine" />);
    expect(await screen.findByText('Real Starter Wardrobe T-shirt prototypes')).toBeInTheDocument();
    expect(screen.getByAltText('feminine real sculpt-fitted clothing.starter.logo-tee front Blender material proof'))
      .toHaveAttribute('src', expect.stringContaining('feminine-starter-logo-tee-front.png'));
    expect(screen.getByAltText('feminine real sculpt-fitted clothing.starter.plain-white-tee front Blender material proof'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('v2-preview-3d')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Starter garment proof angle' }))
      .getByRole('button', { name: 'Three-quarter' }));
    expect(screen.getByAltText('feminine real sculpt-fitted clothing.starter.logo-tee quarter Blender material proof'))
      .toHaveAttribute('src', expect.stringContaining('feminine-starter-logo-tee-quarter.png'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect real dressed source in 3D' })[0]);
    expect(await screen.findByTestId('v2-preview-3d'))
      .toHaveAttribute('data-url', expect.stringContaining('feminine-starter-logo-tee-LOOKDEV-ONLY-not-validated.glb'));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect actual V2 in interactive 3D' }));
    expect(screen.getAllByTestId('v2-preview-3d')).toHaveLength(1);
    expect(screen.getByTestId('v2-preview-3d'))
      .toHaveAttribute('data-url', expect.stringContaining('feminine-LOOKDEV-ONLY-not-validated.glb'));
    expect(screen.getByText(/purchased V1 clothing and item boosts are unchanged/)).toBeInTheDocument();
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
