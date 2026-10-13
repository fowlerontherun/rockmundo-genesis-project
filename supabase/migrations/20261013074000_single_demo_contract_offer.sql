-- Exactly one contract offer can originate from a given demo submission.
-- Existing live data was checked for duplicates before authoring this migration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_label_contracts_one_offer_per_demo
 ON public.artist_label_contracts(demo_submission_id)
 WHERE demo_submission_id IS NOT NULL;
