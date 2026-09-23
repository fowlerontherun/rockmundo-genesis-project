-- Record the current quality pass on the existing published catalogue.
-- Preview jobs already queued will render these items with the new mesh-bound
-- macro shading/material profile once this frontend is deployed.

UPDATE public.avatar_clothing_items
SET
  render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
    'qualityPass', 'construction-and-material-v2',
    'meshBoundMacroShading', true,
    'itemSpecificMaterialProfile', true
  ),
  preview_status = 'pending'
WHERE curated_asset_status = 'published'
  AND curated_asset_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
