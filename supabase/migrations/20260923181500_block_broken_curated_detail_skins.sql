-- Temporarily withdraw the first rig-detail Punk cosmetics after visual QA.
-- The donor-backed base garments remain published. These four items should only
-- return to sale once their detail placement is reworked and revalidated.

UPDATE public.avatar_clothing_items
SET curated_asset_status = 'blocked',
    validation_notes = COALESCE(validation_notes, '{}'::jsonb) || jsonb_build_object(
      'result', 'blocked',
      'reason', 'Visual QA found rig-attached detail placement needs correction before release.'
    )
WHERE curated_asset_key IN (
  'clothing.punk.safety-pin-tee',
  'clothing.punk.patch-jacket',
  'clothing.punk.double-eyelet-belt',
  'clothing.punk.wrist-cuffs'
);

NOTIFY pgrst, 'reload schema';
