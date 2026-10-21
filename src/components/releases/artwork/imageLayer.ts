export interface ArtworkImageLayer { dataUrl: string; zoom: number; x: number; y: number }
export const MAX_DESIGN_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_DATA = 6 * 1024 * 1024;

export function validateImageLayer(value: unknown): ArtworkImageLayer | undefined {
  if (value === undefined) return undefined; // Older design files have no image.
  const layer = value as ArtworkImageLayer;
  if (!layer || typeof layer.dataUrl !== 'string' || layer.dataUrl.length > MAX_IMAGE_DATA || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(layer.dataUrl)) throw new Error('The design must contain an embedded PNG image.');
  const header = atob(layer.dataUrl.split(',')[1].slice(0, 44));
  const uint = (offset: number) => Array.from(header.slice(offset, offset + 4)).reduce((n, char) => n * 256 + char.charCodeAt(0), 0);
  if (header.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || header.slice(12, 16) !== 'IHDR' || !uint(16) || !uint(20) || uint(16) > 1024 || uint(20) > 1024) throw new Error('The embedded image must be a PNG no larger than 1024 pixels per side.');
  for (const [key, min, max] of [['zoom', 1, 3], ['x', -1, 1], ['y', -1, 1]] as const) if (!Number.isFinite(layer[key]) || layer[key] < min || layer[key] > max) throw new Error('Invalid image crop.');
  return { dataUrl: layer.dataUrl, zoom: layer.zoom, x: layer.x, y: layer.y };
}

export function imageCrop(width: number, height: number, layer: Pick<ArtworkImageLayer, 'zoom' | 'x' | 'y'>) {
  const size = Math.min(width, height) / layer.zoom;
  return { sx: (width - size) * (layer.x + 1) / 2, sy: (height - size) * (layer.y + 1) / 2, size };
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be decoded. Choose another PNG, JPEG or WebP.'));
    img.src = src;
  });
}
export async function loadArtworkImage(layer: ArtworkImageLayer) {
  validateImageLayer(layer);
  return loadImage(layer.dataUrl);
}

/** Embed a bounded raster; never retain local paths, remote URLs or SVG markup. */
export async function importArtworkImage(file: File): Promise<ArtworkImageLayer> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP image up to 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > 16384 || img.naturalHeight > 16384) throw new Error('Image dimensions are too large.');
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return validateImageLayer({ dataUrl: canvas.toDataURL('image/png'), zoom: 1, x: 0, y: 0 })!;
  } finally { URL.revokeObjectURL(url); }
}
