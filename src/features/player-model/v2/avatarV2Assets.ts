import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelLibrary } from '../model';

/**
 * Avatar V2 assets live at public/avatar-v2, not under the legacy gig-demo-3d
 * donor asset directory. Keep this resolver separate so nested admin routes and
 * file:// desktop builds resolve the same files.
 */
export function avatarV2AssetUrl(file: string) {
  const safe = file.replace(/^\/+/, '');
  if (!safe.startsWith('avatar-v2/')) {
    throw new Error(`Avatar V2 asset must live below avatar-v2/: ${file}`);
  }
  return `${document.location.protocol === 'file:' ? './' : '/'}${safe}`;
}

export function isAvatarV2AssetFile(file: string) {
  return file.replace(/^\/+/, '').startsWith('avatar-v2/');
}

export async function loadOptionalAvatarV2Assets(
  library: ModelLibrary,
  files: string[],
  manager?: T.LoadingManager,
) {
  const loader = new GLTFLoader(manager);
  await Promise.all([...new Set(files)].map(async file => {
    if (library.has(file)) return;
    try {
      const gltf = await loader.loadAsync(avatarV2AssetUrl(file));
      library.set(file, gltf.scene);
    } catch (error) {
      // Optional cosmetics must not prevent a stage from falling back to V1.
      console.warn('[avatar-v2] optional asset unavailable', file, error);
    }
  }));
}
