import type { AvatarShareVisual } from '@/features/shareable-moments/avatarCapture';
const cache = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();

/** Serial WebGL snapshots avoid allocating one active renderer per band member. */
export function portraitCapture(visual: AvatarShareVisual, cancelled: () => boolean): Promise<string | null> {
  const key = JSON.stringify(visual);
  const job = queue.then(async () => {
    if (cancelled()) return null;
    const hit = cache.get(key);
    if (hit) return hit;
    const { captureAvatarV1ForShare } = await import('@/features/shareable-moments/avatarCapture');
    if (cancelled()) return null;
    const canvas = await captureAvatarV1ForShare(visual);
    const image = canvas.toDataURL('image/png');
    cache.set(key, image);
    while (cache.size > 12) cache.delete(cache.keys().next().value!);
    return image;
  });
  queue = job.catch(() => undefined);
  return job;
}
