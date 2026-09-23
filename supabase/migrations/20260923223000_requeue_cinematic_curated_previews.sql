-- Regenerate existing curated store artwork with the cinematic visual-quality renderer.
-- Old preview manifests are marked stale so the store cannot keep showing pre-upgrade images.

UPDATE public.avatar_clothing_items
SET
  preview_status = 'pending',
  preview_manifest = COALESCE(preview_manifest, '{}'::jsonb) || '{"stale":true}'::jsonb,
  preview_generated_at = NULL,
  last_preview_error = NULL,
  render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
    'previewRenderer', 'fitted-curated-v3-cinematic',
    'previewTextureQuality', 'cinematic-2k',
    'previewResolution', '1440x1800'
  )
WHERE curated_asset_status = 'published'
  AND curated_asset_key IS NOT NULL;

INSERT INTO public.avatar_item_preview_jobs(
  clothing_item_id,
  collection_id,
  requested_by,
  job_type,
  status
)
SELECT
  item.id,
  item.collection_id,
  NULL,
  'full_set',
  'queued'
FROM public.avatar_clothing_items item
WHERE item.curated_asset_status = 'published'
  AND item.curated_asset_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.avatar_item_preview_jobs job
    WHERE job.clothing_item_id = item.id
      AND job.status IN ('queued', 'processing')
  );

NOTIFY pgrst, 'reload schema';
