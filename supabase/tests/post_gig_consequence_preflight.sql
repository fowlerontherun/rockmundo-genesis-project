-- Read-only production preflight for #2158. Execute before deploying migrations.
-- Expected legacy deployment: 37 distinct gigs, 283 processing rows,
-- 246 duplicate processing rows, 0 consequence snapshots.
WITH ranked AS (
 SELECT p.gig_id,p.id,row_number() OVER (PARTITION BY p.gig_id ORDER BY p.created_at,p.id) AS ordinal
 FROM public.gig_post_processing p
)
SELECT count(*) AS processing_rows,
       count(DISTINCT gig_id) AS distinct_gigs,
       count(*) FILTER (WHERE ordinal>1) AS duplicate_rows_to_archive
FROM ranked;
SELECT count(*) AS existing_snapshots FROM public.gig_consequence_snapshots;
SELECT count(*) AS ready_gigs_without_outcomes
FROM public.gigs g
WHERE g.status='completed' AND g.result_ready_at IS NOT NULL
AND EXISTS (SELECT 1 FROM public.gig_post_processing p WHERE p.gig_id=g.id)
AND NOT EXISTS (SELECT 1 FROM public.gig_outcomes o
  WHERE o.gig_id=g.id AND o.completed_at IS NOT NULL AND o.overall_rating IS NOT NULL);
SELECT table_name,column_name,data_type,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
('gig_post_processing','gig_consequence_snapshots')
AND column_name IN ('processing_version','source_factors','status')
ORDER BY table_name,column_name;
