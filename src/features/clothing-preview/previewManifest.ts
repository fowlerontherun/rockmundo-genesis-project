export const CLOTHING_PREVIEW_RENDERER_VERSION = 'fitted-curated-v3-cinematic';

export const CLOTHING_TURNTABLE_VIEWS = [
  { key: 'front', yaw: 0 },
  { key: 'front_right', yaw: 45 },
  { key: 'right', yaw: 90 },
  { key: 'back_right', yaw: 135 },
  { key: 'back', yaw: 180 },
  { key: 'back_left', yaw: 225 },
  { key: 'left', yaw: 270 },
  { key: 'front_left', yaw: 315 },
] as const;

export type ClothingPreviewViewKey = typeof CLOTHING_TURNTABLE_VIEWS[number]['key'];

export interface ClothingPreviewFrame {
  key: ClothingPreviewViewKey;
  yaw: number;
  url?: string;
  width?: number;
  height?: number;
}

export interface ClothingPreviewManifest {
  schemaVersion: 1;
  rendererVersion: string;
  itemId: string;
  generatedAt: string;
  mode: 'turntable' | 'live-plus-turntable';
  thumbnail?: string;
  frames: ClothingPreviewFrame[];
  stale?: boolean;
}

export function createClothingPreviewManifest(itemId: string, frameUrls: Partial<Record<ClothingPreviewViewKey, string>>, generatedAt = new Date().toISOString()): ClothingPreviewManifest {
  return {
    schemaVersion: 1,
    rendererVersion: CLOTHING_PREVIEW_RENDERER_VERSION,
    itemId,
    generatedAt,
    mode: 'live-plus-turntable',
    thumbnail: frameUrls.front,
    frames: CLOTHING_TURNTABLE_VIEWS.map(view => ({
      ...view,
      ...(frameUrls[view.key] ? { url: frameUrls[view.key] } : {}),
    })),
  };
}

export function usablePreviewFrames(manifest: unknown): ClothingPreviewFrame[] {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return [];
  const record = manifest as Record<string, unknown>;
  if (record.stale === true || !Array.isArray(record.frames)) return [];

  const validKeys = new Set<string>(CLOTHING_TURNTABLE_VIEWS.map(view => view.key));
  return record.frames.filter((frame): frame is ClothingPreviewFrame => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return false;
    const candidate = frame as Record<string, unknown>;
    return (
      typeof candidate.key === 'string' &&
      validKeys.has(candidate.key) &&
      typeof candidate.yaw === 'number' &&
      Number.isFinite(candidate.yaw) &&
      typeof candidate.url === 'string' &&
      /^https?:\/\//.test(candidate.url)
    );
  });
}
