-- Strengthen the published curated catalogue's visual QA contract.
-- Graphics/details must be surface-bound, aligned and readable at normal gameplay distance.

UPDATE public.avatar_clothing_items
SET
  render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
    'attachmentPolicy', 'surface-bound-v1',
    'surfaceDetailQuality', 'high',
    'floatingDetailTolerance', 0.004,
    'previewQuality', 'high'
  ),
  validation_notes = COALESCE(validation_notes, '{}'::jsonb)
    || jsonb_build_object(
      'checks',
      COALESCE(validation_notes->'checks', '{}'::jsonb)
        || '{"surface_attachment":true,"graphic_alignment":true,"distance_readability":true}'::jsonb
    )
WHERE curated_asset_status = 'published'
  AND curated_asset_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
