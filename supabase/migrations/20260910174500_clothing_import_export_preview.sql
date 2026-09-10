-- Clothing import/export + preview readiness

ALTER TABLE public.avatar_clothing_items
  ADD COLUMN IF NOT EXISTS external_key text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS preview_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS preview_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_preview_error text;

ALTER TABLE public.avatar_clothing_items
  DROP CONSTRAINT IF EXISTS avatar_clothing_items_preview_status_check;
ALTER TABLE public.avatar_clothing_items
  ADD CONSTRAINT avatar_clothing_items_preview_status_check
  CHECK (preview_status IN ('pending','ready','failed'));

CREATE UNIQUE INDEX IF NOT EXISTS avatar_clothing_items_external_key_uidx
  ON public.avatar_clothing_items (external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS avatar_clothing_items_import_batch_idx
  ON public.avatar_clothing_items (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS avatar_clothing_items_preview_status_idx
  ON public.avatar_clothing_items (preview_status, collection_id);

CREATE TABLE IF NOT EXISTS public.admin_clothing_transfer_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN ('import','export')),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES public.skin_collections(id) ON DELETE SET NULL,
  performed_by uuid NOT NULL DEFAULT auth.uid(),
  source_filename text,
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_clothing_transfer_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view clothing transfer audit" ON public.admin_clothing_transfer_audit;
CREATE POLICY "Admins can view clothing transfer audit"
  ON public.admin_clothing_transfer_audit
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create clothing transfer audit" ON public.admin_clothing_transfer_audit;
CREATE POLICY "Admins can create clothing transfer audit"
  ON public.admin_clothing_transfer_audit
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON COLUMN public.avatar_clothing_items.preview_manifest IS
  'Versioned preview metadata. May contain turntable frames, thumbnails, renderer hints and fidelity state.';
COMMENT ON COLUMN public.avatar_clothing_items.external_key IS
  'Stable portable identifier used by clothing import/export to match an item across environments.';
COMMENT ON TABLE public.admin_clothing_transfer_audit IS
  'Admin-only audit trail for portable clothing item and skin collection imports/exports.';
