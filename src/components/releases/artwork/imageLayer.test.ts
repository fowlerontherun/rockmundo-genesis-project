import { describe, expect, it } from 'vitest';
import { imageCrop, importArtworkImage, validateImageLayer } from './imageLayer';
import { newArtworkDesign, parseArtworkDesign } from './design';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHosAAAAASUVORK5CYII=';
const layer = { dataUrl: png, zoom: 1, x: 0, y: 0 };
describe('embedded artwork images', () => {
  it('round trips a bounded PNG and crop inside the editable design', () => {
    expect(parseArtworkDesign(JSON.stringify({ ...newArtworkDesign(), image: layer })).image).toEqual(layer);
  });
  it('continues to open existing designs without images', () => {
    expect(parseArtworkDesign(JSON.stringify(newArtworkDesign())).image).toBeUndefined();
  });
  it.each(['https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA'])('rejects remote or invalid image sources: %s', dataUrl => {
    expect(() => validateImageLayer({ ...layer, dataUrl })).toThrow();
  });
  it.each([{ zoom: 0 }, { zoom: 4 }, { x: -2 }, { y: Infinity }])('rejects invalid crop values %j', patch => {
    expect(() => validateImageLayer({ ...layer, ...patch })).toThrow('crop');
  });
  it('rejects oversized PNG dimensions before decoding', () => {
    const raw = atob(png.split(',')[1]);
    const modified = raw.slice(0, 16) + String.fromCharCode(0, 0, 8, 0) + raw.slice(20);
    expect(() => validateImageLayer({ ...layer, dataUrl: `data:image/png;base64,${btoa(modified)}` })).toThrow('1024');
  });
  it('keeps crops inside image bounds at maximum zoom and both pan extremes', () => {
    for (const [width, height] of [[1000, 200], [200, 1000], [500, 500]]) for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const crop = imageCrop(width, height, { zoom: 3, x, y });
      expect(crop.sx).toBeGreaterThanOrEqual(0); expect(crop.sy).toBeGreaterThanOrEqual(0);
      expect(crop.sx + crop.size).toBeLessThanOrEqual(width); expect(crop.sy + crop.size).toBeLessThanOrEqual(height);
    }
  });
  it('centres a square crop for wide images', () => {
    expect(imageCrop(1000, 500, layer)).toEqual({ sx: 250, sy: 0, size: 500 });
  });
  it('rejects unsupported uploads before creating an image', async () => {
    await expect(importArtworkImage(new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG, JPEG or WebP');
  });
});
