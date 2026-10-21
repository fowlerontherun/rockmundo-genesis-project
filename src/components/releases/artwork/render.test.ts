import { describe, expect, it, vi } from 'vitest';
import { drawArtwork, newArtworkDesign, type ArtworkSurface } from './design';

function canvasSpy() {
  const ctx = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
    arc: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
  };
  const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

describe.each<ArtworkSurface>(['cover', 'cd', 'vinyl'])('%s text panels', surface => {
  it.each([
    { title: '', artist: '', subtitle: '', panels: 0, texts: [] },
    { title: '  ', artist: '\t', subtitle: ' ', panels: 0, texts: [] },
    { title: 'My album', artist: '', subtitle: '', panels: 1, texts: ['My album'] },
    { title: '', artist: 'My band', subtitle: '', panels: 1, texts: ['My band'] },
    { title: '', artist: '', subtitle: 'SIDE B', panels: 1, texts: ['SIDE B'] },
    { title: 'My album', artist: 'My band', subtitle: 'SIDE B', panels: 2, texts: ['My band', 'My album', 'SIDE B'] },
  ])('renders only occupied text areas: $title / $artist / $subtitle', ({ panels, texts, ...fields }) => {
    const { canvas, ctx } = canvasSpy();
    drawArtwork(canvas, { ...newArtworkDesign(), ...fields }, surface);
    // Background and vinyl fills cover 1200px; only text backing panels are narrower.
    expect(ctx.fillRect.mock.calls.filter(call => call[2] < 1200)).toHaveLength(panels);
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(texts);
  });
});
