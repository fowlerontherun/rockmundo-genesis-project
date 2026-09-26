import type { AvatarV2Frame } from './avatarV2Contract';

export type AvatarV2ReferenceVariant = 'source' | 'lookdev';
export type AvatarV2ReferenceView = 'front' | 'quarter' | 'side' | 'face';

const REFERENCE_BASE =
  'https://raw.githubusercontent.com/fowlerontherun/rockmundo-genesis-project/avatar-v2-reference-previews';
const FRAMES: readonly AvatarV2Frame[] = ['masculine', 'feminine'];
const VIEWS: readonly AvatarV2ReferenceView[] = ['front', 'quarter', 'side', 'face'];

interface ReferenceFrame {
  frame: AvatarV2Frame;
  source: string;
  lookdev: string;
  sourceViews: Record<AvatarV2ReferenceView, string>;
  lookdevViews: Record<AvatarV2ReferenceView, string>;
}

export interface AvatarV2ReferenceManifest {
  schema: 'rockmundo.avatar-v2-reference-previews';
  version: 1;
  source: 'blender-human-base-meshes-v1.4.1';
  previewOnly: true;
  productionValidated: false;
  frames: ReferenceFrame[];
  files: Array<{ file: string; bytes: number; sha256: string }>;
}

export const avatarV2ReferenceManifestUrl = `${REFERENCE_BASE}/preview-manifest.json`;

export function avatarV2ReferenceModelUrl(frame: AvatarV2Frame, variant: AvatarV2ReferenceVariant) {
  const role = variant === 'lookdev' ? 'LOOKDEV-ONLY' : 'SOURCE-ONLY';
  return `${REFERENCE_BASE}/${frame}/${frame}-${role}-not-validated.glb`;
}

export function avatarV2ReferenceImageUrl(
  frame: AvatarV2Frame,
  variant: AvatarV2ReferenceVariant,
  view: AvatarV2ReferenceView,
) {
  return `${REFERENCE_BASE}/${frame}/${frame}-${variant === 'lookdev' ? 'lookdev-' : ''}${view}.png`;
}

/**
 * The gallery is deliberately stricter than an arbitrary remote image viewer.
 * Only a complete, explicitly non-production, source-verified pair is shown.
 * The asset names are reconstructed locally, never taken as arbitrary URLs
 * from the remote manifest. This is a *preview* check, not the GLB release gate.
 */
export function parseAvatarV2ReferenceManifest(raw: unknown): AvatarV2ReferenceManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const manifest = raw as Record<string, unknown>;
  if (manifest.schema !== 'rockmundo.avatar-v2-reference-previews' ||
      manifest.version !== 1 ||
      manifest.source !== 'blender-human-base-meshes-v1.4.1' ||
      manifest.previewOnly !== true ||
      manifest.productionValidated !== false ||
      !Array.isArray(manifest.frames) ||
      manifest.frames.length !== 2 ||
      !Array.isArray(manifest.files)) return null;

  const inventory = new Map<string, { bytes: number; sha256: string }>();
  for (const entry of manifest.files) {
    if (!entry || typeof entry !== 'object') return null;
    const file = entry as Record<string, unknown>;
    if (typeof file.file !== 'string' || typeof file.bytes !== 'number' ||
        !Number.isInteger(file.bytes) || file.bytes < 1024 ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) ||
        inventory.has(file.file)) return null;
    inventory.set(file.file, { bytes: file.bytes, sha256: file.sha256 });
  }

  for (const frame of FRAMES) {
    const item = manifest.frames.find((candidate: unknown) =>
      !!candidate && typeof candidate === 'object' && (candidate as Record<string, unknown>).frame === frame,
    ) as Record<string, unknown> | undefined;
    if (!item) return null;
    const expected = (variant: AvatarV2ReferenceVariant, view?: AvatarV2ReferenceView) =>
      view
        ? `${frame}/${frame}-${variant === 'lookdev' ? 'lookdev-' : ''}${view}.png`
        : `${frame}/${frame}-${variant === 'lookdev' ? 'LOOKDEV-ONLY' : 'SOURCE-ONLY'}-not-validated.glb`;
    if (item.source !== expected('source') || item.lookdev !== expected('lookdev')) return null;
    for (const variant of ['source', 'lookdev'] as const) {
      const views = item[`${variant}Views`];
      if (!views || typeof views !== 'object') return null;
      for (const view of VIEWS) {
        if ((views as Record<string, unknown>)[view] !== expected(variant, view)) return null;
        if (!inventory.has(expected(variant, view))) return null;
      }
      if (!inventory.has(expected(variant))) return null;
    }
  }

  return manifest as unknown as AvatarV2ReferenceManifest;
}
