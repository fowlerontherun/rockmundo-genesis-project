-- #2158: bring legacy deployed consequence tables to the Phase 9 contract.
-- Production has integer processing_version, JSONB source_factors, and no
-- processing_id/audit columns. Keep historical version 1 as the v1 string.
ALTER TABLE public.gig_post_processing
  ALTER COLUMN processing_version DROP DEFAULT;
ALTER TABLE public.gig_post_processing
  ALTER COLUMN processing_version TYPE text USING processing_version::text;
ALTER TABLE public.gig_post_processing
  ALTER COLUMN processing_version SET DEFAULT 'post-gig-consequences-v1';
ALTER TABLE public.gig_post_processing
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS audit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.gig_post_processing
SET processing_version = 'post-gig-consequences-v1'
WHERE processing_version = '1';
-- Keep historical snapshots intact while aligning their source factor type.
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors DROP DEFAULT;
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors TYPE text[] USING
    CASE WHEN jsonb_typeof(source_factors) = 'array' THEN
      ARRAY(SELECT jsonb_array_elements_text(source_factors))
    ELSE ARRAY[]::text[] END;
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors SET DEFAULT '{}'::text[];
ALTER TABLE public.gig_consequence_snapshots
  ADD COLUMN IF NOT EXISTS processing_id uuid REFERENCES public.gig_post_processing(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.gig_consequence_snapshots s SET processing_id = p.id
FROM public.gig_post_processing p
WHERE s.gig_id = p.gig_id AND s.processing_id IS NULL;
-- Historical orphan snapshots remain nullable and require manual review.
CREATE UNIQUE INDEX IF NOT EXISTS gig_post_processing_gig_id_unique
  ON public.gig_post_processing(gig_id);
