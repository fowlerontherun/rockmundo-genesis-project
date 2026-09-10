import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClothingItem } from '@/hooks/useSkinStore';
import {
  CLOTHING_PREVIEW_BUCKET,
  clothingPreviewStoragePath,
  renderClothingTurntable,
} from '@/features/clothing-preview/browserPreviewRenderer';
import {
  CLOTHING_PREVIEW_RENDERER_VERSION,
  CLOTHING_TURNTABLE_VIEWS,
  createClothingPreviewManifest,
  type ClothingPreviewViewKey,
} from '@/features/clothing-preview/previewManifest';

export interface ClothingPreviewWorkerStatus {
  state: 'stopped' | 'claiming' | 'idle' | 'rendering' | 'uploading' | 'error';
  itemName?: string;
  completedViews?: number;
  totalViews?: number;
  message?: string;
}

interface Props {
  collectionId: string;
  active: boolean;
  onStatusChange?: (status: ClothingPreviewWorkerStatus) => void;
  onJobCompleted?: () => void;
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

function requestedViewDefinitions(jobType: string, requestedViews: unknown) {
  const requested = Array.isArray(requestedViews) ? new Set(requestedViews.map(String)) : null;
  if (jobType === 'thumbnail') return [CLOTHING_TURNTABLE_VIEWS[0]];
  const filtered = requested
    ? CLOTHING_TURNTABLE_VIEWS.filter(view => requested.has(view.key))
    : [...CLOTHING_TURNTABLE_VIEWS];
  return filtered.length ? filtered : [...CLOTHING_TURNTABLE_VIEWS];
}

function previousPreviewPaths(item: ClothingItem, replacementJobId: string) {
  const manifest = item.preview_manifest as any;
  const previousJobId = String(manifest?.storage?.jobId || '');
  const rendererVersion = String(manifest?.rendererVersion || '');
  const bucket = String(manifest?.storage?.bucket || '');
  if (!previousJobId || previousJobId === replacementJobId || bucket !== CLOTHING_PREVIEW_BUCKET || rendererVersion !== CLOTHING_PREVIEW_RENDERER_VERSION) return [];
  return CLOTHING_TURNTABLE_VIEWS.map(view => `${item.id}/${rendererVersion}/${previousJobId}/${view.key}.webp`);
}

async function removePreviewPaths(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(CLOTHING_PREVIEW_BUCKET).remove(paths);
  if (error) console.warn('[clothing-preview-worker] preview cleanup failed', error);
}

export function ClothingPreviewRenderWorker({ collectionId, active, onStatusChange, onJobCompleted }: Props) {
  const stopRef = useRef(false);
  const callbacksRef = useRef({ onStatusChange, onJobCompleted });
  callbacksRef.current = { onStatusChange, onJobCompleted };
  const [status, setStatus] = useState<ClothingPreviewWorkerStatus>({ state: 'stopped' });

  useEffect(() => {
    const publish = (next: ClothingPreviewWorkerStatus) => {
      setStatus(next);
      callbacksRef.current.onStatusChange?.(next);
    };

    stopRef.current = !active;
    if (!active) {
      publish({ state: 'stopped' });
      return;
    }

    stopRef.current = false;
    let mounted = true;

    const run = async () => {
      while (mounted && !stopRef.current) {
        let claimedJobId: string | null = null;
        let uploadedPaths: string[] = [];
        try {
          publish({ state: 'claiming' });
          const { data: claimData, error: claimError } = await supabase.rpc(
            'claim_clothing_preview_job_for_collection' as any,
            { p_collection_id: collectionId } as any,
          );
          if (claimError) throw claimError;
          const claim = Array.isArray(claimData) ? claimData[0] : claimData;
          if (!claim?.job_id || !claim?.clothing_item_id) {
            publish({ state: 'idle', message: 'No queued previews in this collection.' });
            await sleep(1800);
            continue;
          }

          claimedJobId = String(claim.job_id);
          const { data: itemData, error: itemError } = await (supabase.from('avatar_clothing_items') as any)
            .select('*')
            .eq('id', claim.clothing_item_id)
            .single();
          if (itemError) throw itemError;
          const item = itemData as ClothingItem;
          const views = requestedViewDefinitions(String(claim.job_type || 'full_set'), claim.requested_views);

          publish({ state: 'rendering', itemName: item.name, completedViews: 0, totalViews: views.length });
          const frames = await renderClothingTurntable(item, { views });

          const urls: Partial<Record<ClothingPreviewViewKey, string>> = {};
          publish({ state: 'uploading', itemName: item.name, completedViews: 0, totalViews: frames.length });
          for (let index = 0; index < frames.length; index++) {
            const frame = frames[index];
            const path = clothingPreviewStoragePath(item.id, claimedJobId, frame.key);
            const { error: uploadError } = await supabase.storage
              .from(CLOTHING_PREVIEW_BUCKET)
              .upload(path, frame.blob, {
                contentType: 'image/webp',
                cacheControl: '31536000',
                upsert: true,
              });
            if (uploadError) throw uploadError;
            uploadedPaths.push(path);
            const { data: publicData } = supabase.storage.from(CLOTHING_PREVIEW_BUCKET).getPublicUrl(path);
            urls[frame.key] = publicData.publicUrl;
            publish({ state: 'uploading', itemName: item.name, completedViews: index + 1, totalViews: frames.length });
          }

          const manifest = createClothingPreviewManifest(item.id, urls);
          manifest.frames = manifest.frames.map(frame => {
            const rendered = frames.find(candidate => candidate.key === frame.key);
            return rendered ? { ...frame, width: rendered.width, height: rendered.height } : frame;
          });
          (manifest as any).storage = { bucket: CLOTHING_PREVIEW_BUCKET, jobId: claimedJobId };
          (manifest as any).source = 'admin-browser-webgl';

          const { error: completeError } = await supabase.rpc(
            'complete_clothing_preview_job' as any,
            { p_job_id: claimedJobId, p_manifest: manifest } as any,
          );
          if (completeError) throw completeError;

          const supersededPaths = previousPreviewPaths(item, claimedJobId);
          if (supersededPaths.length) void removePreviewPaths(supersededPaths);
          uploadedPaths = [];
          callbacksRef.current.onJobCompleted?.();
        } catch (error: any) {
          const message = error?.message || 'Clothing preview generation failed.';
          publish({ state: 'error', message });
          if (uploadedPaths.length) await removePreviewPaths(uploadedPaths);
          if (claimedJobId) {
            try {
              await supabase.rpc('fail_clothing_preview_job' as any, {
                p_job_id: claimedJobId,
                p_error: message,
                p_retry: true,
              } as any);
              callbacksRef.current.onJobCompleted?.();
            } catch (failError) {
              console.error('[clothing-preview-worker] could not mark job failed', failError);
            }
          }
          if (!stopRef.current) await sleep(1800);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
      stopRef.current = true;
    };
  }, [active, collectionId]);

  return <span className="sr-only" aria-live="polite">
    {status.state === 'rendering' || status.state === 'uploading'
      ? `${status.itemName || 'Clothing'} preview ${status.state}: ${status.completedViews || 0} of ${status.totalViews || 0}`
      : status.message || status.state}
  </span>;
}
