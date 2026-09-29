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
CREATE OR REPLACE FUNCTION public._gig_jsonb_source_factors(p_value jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $body$
  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_value) = 'array' THEN p_value ELSE '[]'::jsonb END) AS t(value);
$body$;
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors DROP DEFAULT;
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors TYPE text[] USING public._gig_jsonb_source_factors(source_factors);
ALTER TABLE public.gig_consequence_snapshots
  ALTER COLUMN source_factors SET DEFAULT '{}'::text[];
DROP FUNCTION public._gig_jsonb_source_factors(jsonb);
ALTER TABLE public.gig_consequence_snapshots
  ADD COLUMN IF NOT EXISTS processing_id uuid REFERENCES public.gig_post_processing(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
WITH canonical AS (
  SELECT DISTINCT ON (gig_id) gig_id,id
  FROM public.gig_post_processing ORDER BY gig_id,created_at,id
)
UPDATE public.gig_consequence_snapshots s SET processing_id = p.id
FROM canonical p WHERE s.gig_id=p.gig_id AND s.processing_id IS NULL;
-- Archive the exact legacy records before consolidation so audit data,
-- timestamps, and original statuses remain recoverable for administrators.
CREATE TABLE IF NOT EXISTS public.gig_post_processing_legacy_archive (
  id uuid PRIMARY KEY,
  gig_id uuid NOT NULL,
  original_record jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gig_post_processing_legacy_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_post_processing_legacy_archive FROM PUBLIC, anon, authenticated;
WITH ranked AS (
 SELECT p.*, row_number() OVER (PARTITION BY gig_id ORDER BY created_at,id) AS ordinal
 FROM public.gig_post_processing p
)
INSERT INTO public.gig_post_processing_legacy_archive (id,gig_id,original_record)
SELECT id,gig_id,to_jsonb(ranked) - 'ordinal' FROM ranked WHERE ordinal>1
ON CONFLICT (id) DO NOTHING;
-- The deployed legacy table contains multiple processing rows per gig.
-- Retain the earliest row, preserve discarded row IDs in its audit history,
-- and reparent any historical snapshots before removing duplicates.
WITH ranked AS (
  SELECT id,gig_id,first_value(id) OVER (PARTITION BY gig_id ORDER BY created_at,id) AS keep_id
  FROM public.gig_post_processing
)
UPDATE public.gig_consequence_snapshots s SET processing_id = r.keep_id
FROM ranked r WHERE s.processing_id = r.id AND r.id <> r.keep_id;
WITH ranked AS (
  SELECT id,gig_id,first_value(id) OVER (PARTITION BY gig_id ORDER BY created_at,id) AS keep_id
  FROM public.gig_post_processing
), discarded AS (
  SELECT keep_id,jsonb_agg(id::text ORDER BY id) AS ids FROM ranked
  WHERE id <> keep_id GROUP BY keep_id
)
UPDATE public.gig_post_processing p SET
  audit_history = coalesce(p.audit_history,'[]'::jsonb) ||
    jsonb_build_array(jsonb_build_object('event','legacy_duplicate_rows_consolidated','discarded_ids',d.ids,'at',now()))
FROM discarded d WHERE p.id=d.keep_id;
WITH ranked AS (
  SELECT id,row_number() OVER (PARTITION BY gig_id ORDER BY created_at,id) AS ordinal
  FROM public.gig_post_processing
)
DELETE FROM public.gig_post_processing p USING ranked r
WHERE p.id=r.id AND r.ordinal>1;
-- Historical orphan snapshots remain nullable and require manual review.
CREATE UNIQUE INDEX IF NOT EXISTS gig_post_processing_gig_id_unique
  ON public.gig_post_processing(gig_id);

-- Legacy snapshots defaulted to 'applied', which violates the new directional
-- status constraint. Existing 'applied' rows retain their meaning in metadata.
UPDATE public.gig_consequence_snapshots
SET metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('legacy_status',status),
    status = 'neutral'
WHERE status = 'applied';
ALTER TABLE public.gig_consequence_snapshots ALTER COLUMN status SET DEFAULT 'neutral';
-- Restore constraints omitted by the legacy production schema.
ALTER TABLE public.gig_post_processing
  ADD CONSTRAINT gig_post_processing_status_valid CHECK
  (status IN ('pending','processing','completed','partially_failed','retry_required','skipped'));
ALTER TABLE public.gig_consequence_snapshots
  ADD CONSTRAINT gig_consequence_snapshots_status_valid CHECK
  (status IN ('positive','neutral','negative'));
